// Browser fixture only. Real API behavior is covered by production-review.mjs.
const deliveryFixtureFetch = window.fetch.bind(window), deliveryFixtureReviews = {};
window.fetch = async function (url, options = {}) {
  if (typeof url !== 'string' || !url.startsWith('/api/production/')) return deliveryFixtureFetch(url, options);
  const parts = url.split('?')[0].split('/').filter(Boolean), id = parts[2], lead = fixture.leads.find(l => l.id === id);
  if (!lead) return new Response(JSON.stringify({ error: 'Empresa de teste não encontrada.' }), { status: 404 });
  const { productionPlan, productionRequest, MANUAL_REVIEW_CHECKS } = await import('/production-plan.js');
  const { createPrompt, uid } = await import('/core.js');
  const draft = codeFixtureStates[id], body = options.body ? JSON.parse(options.body) : {};
  const scope = options.method === 'POST' ? body.scope : new URL(url, location.origin).searchParams.get('scope') || (draft?.revision ? 'draft' : 'active');
  const revision = scope === 'draft' ? draft?.revision : lead._revision;
  const fingerprint = JSON.stringify({ revision, scope, assets: lead.assets });
  const key = id + ':' + scope, saved = deliveryFixtureReviews[key];
  const automatic = { version: 1, kind: 'static_analysis', blockers: 0, warnings: 1, passed: 2, visualTested: false, notice: 'Análise estrutural de demonstração. Não comprova funcionamento ou qualidade visual.', checks: [{ id: 'title', label: 'Título da página', status: 'pass', detail: 'Exemplo de indício estrutural.' }, { id: 'hover', label: 'Estado de hover declarado', status: 'warn', detail: 'Conferir os controles no navegador.' }, { id: 'image_alt', label: 'Alternativas das imagens', status: 'pass', detail: 'Conferir os textos alternativos.' }] };
  if (options.method === 'POST') {
    if (body.fingerprint !== fingerprint) return new Response(JSON.stringify({ error: 'Esta versão mudou. Atualize a análise.' }), { status: 409 });
    deliveryFixtureReviews[key] = { id: uid(), fingerprint, checks: body.checks, note: body.note, createdAt: new Date().toISOString(), status: MANUAL_REVIEW_CHECKS.every(([key]) => body.checks[key]) ? 'reviewed' : 'pending' };
    return Response.json({ saved: true, applied: false, published: false });
  }
  return Response.json({ lead: { id, name: lead.name }, source: { scope, revision, fingerprint, leadRevision: lead._revision, hasDraft: !!draft?.revision }, plan: productionPlan(lead, { hasDraft: !!draft?.revision, reviewed: !!saved && saved.fingerprint === fingerprint && saved.status === 'reviewed' }), automatic, review: saved ? { ...saved, current: saved.fingerprint === fingerprint } : null, manualChecks: MANUAL_REVIEW_CHECKS, request: productionRequest(lead, createPrompt(lead, fixture.settings)), runtime: { mode: 'chat_mcp', backgroundRunning: false, apiBillingConnected: false } });
};
