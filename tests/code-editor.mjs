import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {compileCode,pageCSP} from '../public/source-code.js';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const root=path.resolve('dist/server'),names=['index.js',...(await readdir(root,{recursive:true})).filter(f=>f.endsWith('.js')&&f!=='index.js')];
const mf=new Miniflare({modules:names.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PROSPECTO_OWNER_EMAIL:'qa.owner@prospecto.test'},cf:false});
const identities={owner:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'qa.owner@prospecto.test'},outsider:{'oai-authenticated-user-id':'outsider','oai-authenticated-user-email':'outside@example.test'}};
async function req(url,{method='GET',body,as='owner',headers={}}={}){return mf.dispatchFetch('https://qa.example.test'+url,{method,headers:{...identities[as],'Content-Type':'application/json','X-Prospecto-Request':'1',...headers},body:body===undefined?undefined:JSON.stringify(body)});}
const get=async url=>(await req(url)).json();
async function post(url,body,status=200){const r=await req(url,{method:'POST',body});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
const id='qa-code',oldHtml='<!doctype html><html><head><style>body{color:navy}</style></head><body><h1>Página anterior</h1></body></html>';
const files={html:'<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="menu">Menu</button><div id="links" hidden>Serviços</div></body></html>',css:'body{background:#faf7ef}button:hover{background:orange}',js:'document.querySelector("#menu").onclick=()=>{document.querySelector("#links").hidden=false};',scriptsEnabled:true,scriptMode:'classic'};
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await post('/api/records',{kind:'lead',id,base:{},changes:{name:'Empresa de QA',city:'Curitiba',sector:'Teste',value:990,received:100,stage:'contato',customHtml:oldHtml,notes:'NOTA_PRIVADA_NAO_EXPORTAR'}});
 assert.equal((await req('/api/code/'+id,{as:'anonymous'})).status,401);assert.equal((await req('/api/code/'+id,{as:'outsider'})).status,403);
 assert.equal((await req('/api/code/'+id,{method:'POST',body:{},headers:{Origin:'https://other.example'}})).status,403);
 const initial=await get('/api/code/'+id);assert.equal(initial.revision,0);assert.ok(initial.files.html.includes('Página anterior'));assert.ok(!JSON.stringify(initial).includes('NOTA_PRIVADA_NAO_EXPORTAR'));
 await post('/api/code/'+id,{expected_revision:0,files,label:'Primeira edição'});
 let saved=await get('/api/code/'+id);assert.equal(saved.revision,1);assert.equal(saved.history.versions.length,1);
 let lead=(await get('/api/bootstrap')).leads[0];assert.equal(lead.customHtml,oldHtml);assert.equal(lead.value,990);assert.equal(lead.stage,'contato');
 await post('/api/code/'+id,{expected_revision:0,files},409);
 const parallel=await Promise.all([req('/api/code/'+id,{method:'POST',body:{expected_revision:1,files:{...files,css:'body{color:green}'}}}),req('/api/code/'+id,{method:'POST',body:{expected_revision:1,files:{...files,css:'body{color:blue}'}}})]);assert.deepEqual(parallel.map(r=>r.status).sort(),[200,409]);
 saved=await get('/api/code/'+id);assert.equal(saved.revision,2);assert.equal(saved.history.versions.length,2);
 await post('/api/code/'+id+'/apply',{expected_revision:1,expected_lead_revision:lead._revision},409);
 const applied=await post('/api/code/'+id+'/apply',{expected_revision:2,expected_lead_revision:lead._revision});assert.equal(applied.record.stage,'contato');assert.equal(applied.record.value,990);assert.equal(applied.record.received,100);assert.equal(applied.record.pageScriptsEnabled,true);assert.ok(applied.record.customHtml.includes(files.js));
 const previous=await get('/api/code/'+id+'/versions/'+applied.previousVersion);assert.equal(previous.files.html,oldHtml);
 await post('/api/code/'+id,{expected_revision:2,files:previous.files,label:'Restauração como rascunho'});assert.equal((await get('/api/bootstrap')).leads[0].customHtml,applied.record.customHtml);
 console.log('PASS: rascunho separado, versões atômicas, concorrência, restauração sem aplicar e preservação financeira.');
 lead=(await get('/api/bootstrap')).leads[0];const token='ab'.repeat(16);await post('/api/records',{kind:'lead',id,base:lead,changes:{publicEnabled:true,publicToken:token}});
 const pub=await req('/p/'+token,{as:'anonymous'});assert.equal(pub.status,200);const csp=pub.headers.get('Content-Security-Policy');assert.ok(csp.includes('sandbox')&&csp.includes('allow-scripts')&&!csp.includes('allow-same-origin')&&csp.includes("connect-src 'none'"));
 lead=(await get('/api/bootstrap')).leads[0];await post('/api/code/'+id+'/apply',{expected_revision:3,expected_lead_revision:lead._revision},409);
 await post('/api/records',{kind:'lead',id,base:lead,changes:{publicEnabled:false,pageScriptsEnabled:false,customHtml:'<!doctype html><h1>Outra versão manual</h1>'}});
 const history=await get('/api/code/'+id+'/history');assert.ok(history.versions.some(v=>v.kind==='before_apply'&&v.id!==applied.previousVersion));
 console.log('PASS: páginas públicas e aprovadas protegidas; alterações de HTML fora do editor também criam cópia anterior.');
 const rpc=await post('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'prospecto_get_code',arguments:{lead_id:id}}});assert.equal(rpc.result.isError,false);assert.equal(rpc.result.structuredContent.revision,3);
 const write=await post('/mcp',{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'prospecto_save_code',arguments:{lead_id:id,expected_revision:3,files,label:'Rascunho pelo chat'}}});assert.equal(write.result.isError,false);assert.equal(write.result.structuredContent.applied,false);
 await post('/api/code/'+id,{expected_revision:4,files:{html:'x',css:12,js:''}},400);
 assert.ok(pageCSP(false,{publicPage:true}).includes("script-src 'none'"));
 const escaped=compileCode({html:'<p>Teste</p>',css:'p::after{content:"</style>"}',js:'const end="</script>";',scriptsEnabled:true});assert.ok(escaped.includes('<\\/script>')&&escaped.includes('<\\/style>'));
 console.log('PASS: MCP de código privado, validação sem truncamento e políticas de execução isolada.');
}finally{await mf.dispose();}
