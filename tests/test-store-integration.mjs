import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {summarize} from '../public/core.js';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wranglerRequire('miniflare');
const root=path.resolve('dist/server'),names=['index.js',...(await readdir(root,{recursive:true})).filter(f=>f.endsWith('.js')&&f!=='index.js')];
const mf=new Miniflare({modules:names.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PROSPECTO_OWNER_EMAIL:'qa.owner@prospecto.test'},cf:false});
async function request(route,{anonymous=false,method='GET',body,headers={}}={}){return mf.dispatchFetch('https://qa.prospecto.test'+route,{method,headers:{...(!anonymous?{'oai-authenticated-user-id':'qa-owner','oai-authenticated-user-email':'qa.owner@prospecto.test'}:{}),'Content-Type':'application/json','X-Prospecto-Request':'1',...headers},body:body===undefined?undefined:JSON.stringify(body)});}
async function json(route,options={},status=200){const r=await request(route,options),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
async function mcp(name,args={}){const r=await json('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}});assert.equal(r.result.isError,false,r.result.content?.[0]?.text);return r.result.structuredContent;}
try{
  const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  await json('/api/ai/test-store',{anonymous:true,method:'POST',body:{}},401);
  await json('/api/ai/test-store',{method:'POST',body:{},headers:{Origin:'https://outside.test'}},403);
  await json('/api/ai/test-store',{method:'POST',body:{value:900}},400);
  const made=await Promise.all([json('/api/ai/test-store',{method:'POST',body:{owner_name:'Pessoa de teste',business_phone:'41999990000',contact_email:'qa@prospecto.test'}}),json('/api/ai/test-store',{method:'POST',body:{}})]);
  assert.deepEqual(made.map(x=>x.created).sort(),[false,true]);let lead=made.find(x=>x.created).lead;
  assert.equal(lead.isTest,true);assert.equal(lead.phone,'');assert.equal(lead.products.length,6);assert.equal(lead.value,0);assert.equal(lead.publicEnabled,false);
  assert.equal((await mcp('prospecto_create_test_business',{})).created,false);
  await json('/api/records',{method:'POST',body:{kind:'lead',id:lead.id,base:lead,changes:{headline:'Minha edição'}}});
  const repeat=await mcp('prospecto_create_test_business',{owner_name:'Não sobrescrever'});assert.equal(repeat.lead.headline,'Minha edição');lead=repeat.lead;
  await json('/api/records',{method:'POST',body:{kind:'lead',id:lead.id,base:lead,changes:{publicEnabled:true,publicToken:'a'.repeat(32)}}},400);
  const kept=await json('/api/records',{method:'POST',body:{kind:'lead',id:lead.id,base:lead,changes:{isTest:false,stage:'fechado',value:9999,received:9999}}});assert.equal(kept.record.isTest,true);
  const ws=await mcp('prospecto_workspace');assert.equal(ws.counts.tests,1);assert.equal(ws.counts.leads,0);
  let boot=await json('/api/bootstrap');assert.equal(summarize(boot.leads).received,0);
  await db.prepare("UPDATE studio_records SET data=json_set(data,'$.publicEnabled',json('true'),'$.publicToken',?) WHERE key=?").bind('a'.repeat(32),'lead:'+lead.id).run();assert.equal((await request('/p/'+'a'.repeat(32),{anonymous:true})).status,404);
  const q=await mcp('prospecto_prepare_outreach');assert.equal(q.canSend,false);assert.equal(q.backgroundRunning,false);assert.equal(q.ready,0);assert.ok(q.rows[0].reasons.some(r=>r.includes('teste')));assert.ok(q.rows.every(row=>!Object.hasOwn(row,'value')&&!Object.hasOwn(row,'received')&&!Object.hasOwn(row,'notes')));
  const read=await mcp('prospecto_get_lead',{lead_id:lead.id});assert.equal(read.lead.isTest,true);assert.equal(read.lead.dados_de_teste,true);
  await json('/api/outreach',{anonymous:true},401);
  await db.prepare('DELETE FROM studio_records WHERE key=?').bind('lead:'+lead.id).run();
  assert.equal((await request('/api/code/'+lead.id)).status,404);
  await mcp('prospecto_create_test_business',{business_phone:'4130000000',contact_email:'qa.seed@prospecto.test'});
  const seeded=await mcp('prospecto_save_code',{lead_id:lead.id,expected_revision:0,files:{html:'<!doctype html><html lang="pt-BR"><head><title>Teste</title></head><body><main><h1>Teste configurado</h1></main></body></html>',css:'',js:''},label:'Criação explícita do teste'});
  assert.equal(seeded.saved,true);assert.equal(seeded.applied,false);
  const seededLead=(await mcp('prospecto_get_lead',{lead_id:lead.id})).lead;
  assert.equal(seededLead.isTest,true);assert.equal(seededLead.businessPhone,'4130000000');assert.equal(seededLead.email,'qa.seed@prospecto.test');assert.equal(seededLead.pageScriptsEnabled,true);
  console.log('PASS: loja fictícia privada e idempotente, contatos opcionais, seis produtos, edições preservadas, bloqueio de publicação, exclusão das métricas e ferramentas MCP sem envio.');
}finally{await mf.dispose();}
