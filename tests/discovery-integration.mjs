import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,createFetchMock}=wr('miniflare');
const root=path.resolve('dist/server'),names=['index.js',...(await readdir(root,{recursive:true})).filter(f=>f.endsWith('.js')&&f!=='index.js')],fetchMock=createFetchMock();fetchMock.disableNetConnect();
const mf=new Miniflare({modules:names.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PROSPECTO_OWNER_EMAIL:'qa.owner@prospecto.test'},fetchMock,cf:false});
async function req(url,{method='GET',body,anonymous=false,headers={}}={}){return mf.dispatchFetch('https://qa.prospecto.test'+url,{method,headers:{...(!anonymous?{'oai-authenticated-user-id':'qa-owner','oai-authenticated-user-email':'qa.owner@prospecto.test'}:{}),'Content-Type':'application/json','X-Prospecto-Request':'1',...headers},body:body===undefined?undefined:JSON.stringify(body)});}
async function json(url,options={},status=200){const r=await req(url,options),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));assert.match(r.headers.get('cache-control'),/no-store/);return data;}
const post=(url,body,status=200)=>json(url,{method:'POST',body},status);
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await json('/api/discovery/status',{anonymous:true},401);await json('/api/discovery/status',{headers:{'oai-authenticated-user-email':'stranger@prospecto.test'}},403);
 assert.equal((await json('/api/discovery/status')).google.configured,false);
 const input={segment:'restaurant',region:'bacacheri',limit:10,require_contact:true};
 await json('/api/discovery/search',{method:'POST',body:input,headers:{Origin:'https://evil.example'}},403);await post('/api/discovery/search',{...input,limit:1000},400);await post('/api/discovery/search',{...input,raw_query:'BAD'},400);
 fetchMock.get('https://overpass.private.coffee').intercept({path:'/api/interpreter',method:'POST'}).reply(200,{elements:[{id:551,type:'node',tags:{name:'Cozinha QA',phone:'(41) 3000-1234',website:'https://cozinha.example','addr:street':'Rua Teste','addr:housenumber':'30'}}]});
 const found=await post('/api/discovery/search',input);assert.equal(found.items.length,1);assert.equal(found.cached,false);assert.equal(found.items[0].whatsapp,'');assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM studio_records WHERE kind='lead'").first()).n,0);
 const same=await post('/api/discovery/search',input);assert.equal(same.cached,true);assert.equal(same.batchId,found.batchId);
 await post('/api/discovery/search',{...input,segment:'pet'},429);
 const selection={batch_id:found.batchId,item_id:found.items[0].id};await post('/api/discovery/import',{...selection,name:'Attacker'},400);
 fetchMock.get('https://cozinha.example').intercept({path:'/',method:'GET'}).reply(200,'<!doctype html><meta name="description" content="Descrição da cozinha"><a href="https://instagram.com/cozinhaqa">Instagram</a><a href="https://facebook.com/sharer.php?u=abc">Compartilhar</a><a href="https://wa.me/5541999991234">WhatsApp</a>',{headers:{'Content-Type':'text/html'}});
 const enriched=await post('/api/discovery/enrich',selection);assert.equal(enriched.item.instagram,'https://instagram.com/cozinhaqa');assert.equal(enriched.item.facebook,'');assert.equal(enriched.item.whatsapp,'5541999991234');assert.ok(enriched.item.officialFields.includes('instagram'));
 const [first,repeat]=await Promise.all([post('/api/discovery/import',selection),post('/api/discovery/import',selection)]);assert.equal(first.lead.id,repeat.lead.id);
 const key='lead:'+first.lead.id;let lead=JSON.parse((await db.prepare('SELECT data FROM studio_records WHERE key=?').bind(key).first()).data);assert.equal(lead.stage,'novo');assert.equal(lead.value,0);assert.equal(lead.phone,'5541999991234');assert.equal(lead.publicEnabled,false);assert.equal(lead.discovery.license,'ODbL-1.0');assert.equal(lead.pageTemplate,'studio');
 const saved=await post('/api/records',{kind:'lead',id:lead.id,base:lead,changes:{value:800,received:200,stage:'proposta',archivedAt:'2026-10-30T01:00:00Z',customHtml:'<main>Preservado</main>',promptOverride:'PROMPT_CUSTOM',lovablePrompt:'LOVABLE_CUSTOM',lovableProjectUrl:'https://lovable.dev/projects/qa',externalPreviewUrl:'https://qa.lovable.app',externalPreviewReviewed:true}});lead=saved.record;
 const duplicate=await post('/api/discovery/import',selection);assert.equal(duplicate.archived,true);const current=JSON.parse((await db.prepare('SELECT data FROM studio_records WHERE key=?').bind(key).first()).data);assert.equal(current.customHtml,'<main>Preservado</main>');assert.equal(current.value,800);assert.equal(current.promptOverride,'PROMPT_CUSTOM');assert.equal(current.lovablePrompt,'LOVABLE_CUSTOM');assert.equal(current.externalPreviewReviewed,true);
 await post('/api/discovery/google',selection,503);
 const row=await db.prepare('SELECT results FROM studio_discovery_batches WHERE id=?').bind(found.batchId).first();const poisoned=JSON.parse(row.results);poisoned[0].website='http://127.0.0.1/private';delete poisoned[0].officialCheckedAt;await db.prepare('UPDATE studio_discovery_batches SET results=? WHERE id=?').bind(JSON.stringify(poisoned),found.batchId).run();await db.prepare('DELETE FROM studio_discovery_limits WHERE bucket LIKE ?').bind('enrich:%').run();await post('/api/discovery/enrich',selection,400);
 await db.prepare('UPDATE studio_discovery_batches SET expires_at=? WHERE id=?').bind('2020-01-01T00:00:00Z',found.batchId).run();await post('/api/discovery/import',selection,410);
 fetchMock.assertNoPendingInterceptors();
 console.log('PASS: pesquisa autenticada, cache, limites, origem e entrada; enriquecimento com procedência; importação concorrente idempotente; valores, páginas, prompts e lixeira preservados; chave ausente e URLs internas bloqueadas.');
}finally{await mf.dispose();}
