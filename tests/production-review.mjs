import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { MANUAL_REVIEW_CHECKS } from '../public/production-plan.js';

const require = createRequire(import.meta.url), wr = createRequire(require.resolve('wrangler/package.json')), { Miniflare } = wr('miniflare');
const root = path.resolve('dist/server'), names = ['index.js', ...(await readdir(root, { recursive: true })).filter(f => f.endsWith('.js') && f !== 'index.js')];
const mf = new Miniflare({ modules: names.map(f => ({ type: 'ESModule', path: path.join(root, f) })), modulesRoot: root, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['BUCKET'], bindings: { PROSPECTO_OWNER_EMAIL: 'qa.owner@prospecto.test' }, cf: false });
const identity = { owner: { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'qa.owner@prospecto.test' }, outsider: { 'oai-authenticated-user-id': 'outsider', 'oai-authenticated-user-email': 'outside@example.test' } };
async function req(route, { as = 'owner', method = 'GET', body, headers = {} } = {}) {
  return mf.dispatchFetch('https://qa.example.test' + route, { method, headers: { ...identity[as], 'Content-Type': 'application/json', 'X-Prospecto-Request': '1', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const get = async route => (await req(route)).json();
async function post(route, body, status = 200) { const r = await req(route, { method: 'POST', body }); const value = await r.json(); assert.equal(r.status, status, JSON.stringify(value)); return value; }
const id = 'qa-delivery', checks = value => Object.fromEntries(MANUAL_REVIEW_CHECKS.map(([key]) => [key, value]));
const files = { html: '<!doctype html><html lang="pt-BR"><head><title>Oficina de exemplo</title><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Atendimento de exemplo"></head><body><header><nav><a href="#servicos">Serviços</a><a href="#contato">Contato</a></nav></header><main><h1>Uma oficina de exemplo.</h1><section id="servicos"><h2>Serviços</h2><p>Informações de teste.</p></section><section id="contato"><h2>Contato</h2><a href="tel:+554130000000">Ligar para a oficina</a></section></main></body></html>', css: 'body{color:#122;background:#fff}a:hover{color:#315}a:focus-visible{outline:2px solid}@media(max-width:620px){nav{display:block}}@media(prefers-reduced-motion:reduce){*{transition:none}}', js: '', scriptsEnabled: false, scriptMode: 'classic' };
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) for (const sql of (await readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
  await post('/api/records', { kind: 'lead', id, base: {}, changes: { name: 'Oficina de QA', city: 'Curitiba', sector: 'Oficina mecânica', services: 'Diagnóstico', businessPhone: '(41) 3000-0000', value: 912345.67, notes: 'NOTA_PRIVADA_NAO_EXPORTAR', stage: 'contato' } });
  assert.equal((await req('/api/production/' + id, { as: 'anonymous' })).status, 401);
  assert.equal((await req('/api/production/' + id, { as: 'outsider' })).status, 403);
  assert.equal((await req('/api/production/' + id + '?scope=invalid')).status, 400);
  assert.equal((await req('/api/production/' + id + '?scope=draft')).status, 404);
  let active = await get('/api/production/' + id);
  assert.equal(active.source.scope, 'active'); assert.equal(active.automatic.visualTested, false); assert.equal(active.runtime.backgroundRunning, false);
  assert.ok(active.request.includes('prospecto_save_code') && active.request.includes(id));
  assert.ok(!JSON.stringify(active).includes('NOTA_PRIVADA_NAO_EXPORTAR') && !JSON.stringify(active).includes('912345.67'));
  assert.equal((await req('/api/production/' + id + '/review', { method: 'POST', body: {}, headers: { Origin: 'https://outside.example' } })).status, 403);
  await post('/api/production/' + id + '/review', { scope: 'active', fingerprint: active.source.fingerprint, checks: checks(false), note: 'Revisão parcial, sem teste visual.' });
  active = await get('/api/production/' + id); assert.equal(active.review.current, true); assert.equal(active.review.status, 'pending');
  await post('/api/code/' + id, { expected_revision: 0, files, label: 'Página para revisão' });
  let draft = await get('/api/production/' + id);
  assert.equal(draft.source.scope, 'draft'); assert.equal(draft.automatic.blockers, 0); assert.equal(draft.review, null);
  const saved = await post('/api/production/' + id + '/review', { scope: 'draft', fingerprint: draft.source.fingerprint, checks: checks(true), note: 'Declaração de teste da equipe.' });
  assert.equal(saved.status, 'reviewed'); assert.equal(saved.applied, false); assert.equal(saved.published, false);
  let lead = (await get('/api/bootstrap')).leads[0]; assert.equal(lead.customHtml, ''); assert.equal(lead.stage, 'contato'); assert.equal(lead.value, 912345.67); assert.equal(lead.productionStatus, 'briefing');
  draft = await get('/api/production/' + id); assert.equal(draft.review.current, true);
  await post('/api/code/' + id, { expected_revision: 1, files: { ...files, css: files.css + '\np{max-width:60ch}' } });
  const stale = await get('/api/production/' + id); assert.equal(stale.review.current, false);
  await post('/api/production/' + id + '/review', { scope: 'draft', fingerprint: draft.source.fingerprint, checks: checks(true), note: '' }, 409);
  assert.equal((await get('/api/production/' + id + '?scope=active')).review.current, true);
  await db.prepare('INSERT INTO studio_assets(id,lead_id,object_key,name,mime,size,role,alt,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind('qa-asset', id, 'qa-object', 'imagem.png', 'image/png', 100, 'gallery', 'Foto de teste', new Date().toISOString(), 'owner').run();
  assert.equal((await get('/api/production/' + id + '?scope=active')).review.current, false);
  await post('/api/production/' + id + '/review', { scope: 'draft', fingerprint: stale.source.fingerprint, checks: { invented: true }, note: '' }, 400);
  const broken = { ...files, html: files.html.replace('href="#servicos"', 'href="#nao-existe"').replace('</main>', '<img src="midias/ausente.png"><script src="https://example.com/a.js"></script><form><button>Enviar</button></form></main>'), js: 'fetch("/api/bootstrap")', scriptsEnabled: true };
  await post('/api/code/' + id, { expected_revision: 2, files: broken });
  const report = await get('/api/production/' + id);
  for (const key of ['links', 'media_files', 'image_alt', 'external_scripts', 'blocked_elements']) assert.equal(report.automatic.checks.find(c => c.id === key).status, 'fail', key);
  assert.equal(report.automatic.checks.find(c => c.id === 'network').status, 'warn');
  const rpc = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'prospecto_prepare_production', arguments: { lead_id: id } } });
  assert.equal(rpc.result.isError, false); assert.equal(rpc.result.structuredContent.source.scope, 'draft'); assert.equal(rpc.result.structuredContent.automatic.visualTested, false);
  console.log('PASS: plano e análise privados, sem dados financeiros, sem publicar ou executar agentes fictícios.');
  console.log('PASS: revisão por versão, separação de rascunho e página, invalidação por código/mídia e conflitos explícitos.');
  console.log('PASS: âncoras, contato, mídias, acessibilidade estrutural, scripts e recursos incompatíveis detectados.');
} finally { await mf.dispose(); }
