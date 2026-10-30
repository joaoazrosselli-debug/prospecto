import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,createFetchMock}=wr('miniflare');
const root=path.resolve('dist/server'),names=['index.js',...(await readdir(root,{recursive:true})).filter(f=>f.endsWith('.js')&&f!=='index.js')],fetchMock=createFetchMock();fetchMock.disableNetConnect();
const mf=new Miniflare({modules:names.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PROSPECTO_OWNER_EMAIL:'qa.owner@prospecto.test',GOOGLE_PLACES_API_KEY:'qa-key-never-real'},fetchMock,cf:false});
async function json(path,body,status=200){const r=await mf.dispatchFetch('https://qa.prospecto.test/api/discovery/'+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':'qa-owner','oai-authenticated-user-email':'qa.owner@prospecto.test','Content-Type':'application/json','X-Prospecto-Request':'1'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));assert.match(r.headers.get('cache-control'),/no-store/);return data;}
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 assert.equal((await json('status')).google.configured,true);
 const id='9dc140d9-6cda-4fba-8a78-c44a484087fa',items=[{id:'node/1',name:'Empresa de QA',address:'Rua exemplo, 1',city:'Curitiba / PR',provider:'osm',sourceUrl:'https://www.openstreetmap.org/node/1'}],raw=JSON.stringify(items),now=new Date().toISOString();
 await db.prepare('INSERT INTO studio_discovery_batches(id,query,results,created_at,expires_at) VALUES(?,?,?,?,?)').bind(id,'{}',raw,now,new Date(Date.now()+86400000).toISOString()).run();
 fetchMock.get('https://places.googleapis.com').intercept({path:'/v1/places:searchText',method:'POST',headers:{'x-goog-api-key':'qa-key-never-real'}}).reply(200,{places:[{id:'google-only',displayName:{text:'Nome vivo GOOGLE_EPHEMERAL_ABC'},formattedAddress:'Endereço vivo Google',rating:4.8,userRatingCount:123,googleMapsUri:'https://maps.google.com/?cid=1',attributions:[{provider:'Fonte de QA',providerUri:'https://example.com/attribution'}]}]});
 const result=await json('google',{batch_id:id,item_id:'node/1'});assert.equal(result.transient,true);assert.equal(result.matches[0].rating,4.8);assert.equal(result.matches[0].count,123);assert.ok(!JSON.stringify(result).includes('qa-key-never-real'));
 const after=(await db.prepare('SELECT results FROM studio_discovery_batches WHERE id=?').bind(id).first()).results;assert.equal(after,raw);assert.equal((await db.prepare("SELECT count(*) AS n FROM studio_records").first()).n,0);
 await json('google',{batch_id:id,item_id:'node/1'},429);
 fetchMock.assertNoPendingInterceptors();console.log('PASS: Google consultado com chave somente no servidor, atribuição e possíveis correspondências; conteúdo vivo não gravado em lote/CRM; ausência de cache HTTP e limite de consultas.');
}finally{await mf.dispose();}
