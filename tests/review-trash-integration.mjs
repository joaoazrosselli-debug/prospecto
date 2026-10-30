import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const root=path.resolve('dist/server'),names=['index.js',...(await readdir(root,{recursive:true})).filter(f=>f.endsWith('.js')&&f!=='index.js')];
const mf=new Miniflare({modules:names.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PROSPECTO_OWNER_EMAIL:'qa.owner@prospecto.test'},cf:false});
async function req(url,{method='GET',body,anonymous=false}={}){return mf.dispatchFetch('https://qa.prospecto.test'+url,{method,headers:{...(!anonymous?{'oai-authenticated-user-id':'qa-owner','oai-authenticated-user-email':'qa.owner@prospecto.test'}:{}),'Content-Type':'application/json','X-Prospecto-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});}
async function json(url,options={},status=200){const r=await req(url,options),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
async function update(base,changes){return (await json('/api/records',{method:'POST',body:{kind:'lead',id:'archive-client',base,changes}})).record;}
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const token='12'.repeat(16),html='<!doctype html><html lang="pt-BR"><head><title>Cliente de QA</title></head><body><main><h1>Conteúdo preservado</h1></main></body></html>';
 let lead=await update({},{name:'Cliente de QA',city:'Curitiba / PR',value:600,received:200,stage:'novo',customHtml:html,publicEnabled:true,publicToken:token});
 await json('/api/code/archive-client',{method:'POST',body:{expected_revision:0,files:{html,css:'',js:''},label:'Versão preservada'}});
 assert.equal((await req('/p/'+token,{anonymous:true})).status,200);
 const before=await json('/api/code/archive-client');
 lead=await update(lead,{archivedAt:'2026-10-29T20:00:00Z'});assert.equal(lead.publicEnabled,false);assert.equal(lead.value,600);assert.equal(lead.received,200);assert.equal(lead.customHtml,html);
 assert.equal((await req('/p/'+token,{anonymous:true})).status,404);
 const code=await json('/api/code/archive-client');assert.deepEqual(code.files,before.files);assert.deepEqual(code.history,before.history);
 await json('/api/code/archive-client/apply',{method:'POST',body:{expected_revision:1,expected_lead_revision:lead._revision}},409);
 const q=await json('/api/outreach');assert.equal(q.rows.length,0);
 const rpc=await json('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'prospecto_list_leads',arguments:{query:'Cliente de QA'}}}});assert.equal(rpc.result.structuredContent.total,0);
 lead=await update(lead,{archivedAt:''});assert.equal(lead.publicEnabled,false);assert.equal(lead.received,200);assert.equal((await json('/api/outreach')).rows.length,1);
 await json('/api/outreach',{anonymous:true},401);
 console.log('PASS: lixeira compartilhada revoga apresentação pública, preserva código, versões e valores, exclui da fila/MCP e restaura sem reativar links.');
}finally{await mf.dispose();}
