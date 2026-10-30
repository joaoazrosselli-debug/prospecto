import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,createFetchMock}=wr('miniflare');
const root=path.resolve('dist/server'),names=['index.js',...(await readdir(root,{recursive:true})).filter(f=>f.endsWith('.js')&&f!=='index.js')],fetchMock=createFetchMock();fetchMock.disableNetConnect();
const mf=new Miniflare({modules:names.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PROSPECTO_OWNER_EMAIL:'qa.owner@prospecto.test'},fetchMock,cf:false});
async function req(route,body,{as='owner',origin}={}){return mf.dispatchFetch('https://qa.prospecto.test'+route,{method:body===undefined?'GET':'POST',headers:{...(as==='anonymous'?{}:{'oai-authenticated-user-id':as,'oai-authenticated-user-email':as==='owner'?'qa.owner@prospecto.test':'stranger@prospecto.test'}),'Content-Type':'application/json','X-Prospecto-Request':'1',...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
async function json(route,body,status=200,options={}){const r=await req('/api/discovery/'+route,body,options),data=await r.json();assert.equal(r.status,status,JSON.stringify(data));assert.match(r.headers.get('cache-control'),/no-store/);return data;}
const photonFeatures={features:[{geometry:{coordinates:[-51.05696,.04015]},properties:{name:'Macapá',city:'Macapá',state:'Amapá',countrycode:'BR',type:'city'}},{geometry:{coordinates:[-58,-34]},properties:{name:'Outro país',countrycode:'AR',type:'city'}}]};
const photonPath=query=>'/api/?'+new URLSearchParams({q:query,limit:'10',bbox:'-74,-34,-28,6'});
try{
 const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await json('locate',{query:'Macapá, AP'},401,{as:'anonymous'});await json('locate',{query:'Macapá, AP'},403,{as:'stranger'});await json('locate',{query:'Macapá, AP'},403,{origin:'https://outside.example'});
 await json('locate',{query:'AP'},400);await json('locate',{query:'Macapá',endpoint:'http://127.0.0.1'},400);
 fetchMock.get('https://photon.komoot.io').intercept({path:photonPath('Macapá, AP'),method:'GET'}).reply(200,photonFeatures);
 const located=await json('locate',{query:'Macapá, AP'});assert.equal(located.items.length,1);assert.equal(located.items[0].state,'AP');assert.equal(located.items[0].lat,.04015);assert.equal(located.cached,false);
 assert.equal((await json('locate',{query:'macapa, AP'})).cached,true);
 await json('locate',{query:'Curitiba, PR'},429);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM studio_records WHERE kind='lead'").first()).n,0,'Location lookup must not create businesses.');
 const base={segment:'restaurant',region:'map',center:{lat:located.items[0].lat,lon:located.items[0].lon,label:located.items[0].label,city:located.items[0].city,state:'AP'},radius_km:3,limit:50,require_contact:true};
 await json('search',{...base,center:undefined},400);await json('search',{...base,center:{lat:0,lon:0}},400);await json('search',{...base,radius_km:21},400);await json('search',{...base,limit:51},400);await json('search',{...base,region:'bacacheri'},400);
 fetchMock.get('https://overpass.private.coffee').intercept({path:'/api/interpreter',method:'POST'}).reply(200,{elements:[{id:701,type:'node',lat:.041,lon:-51.057,tags:{name:'Cozinha AP · teste',phone:'(96) 3000-1234',website:'https://cozinha.example','addr:city':'Macapá','addr:state':'AP',opening_hours:'Mo-Fr 09:00-18:00',description:'Dados fictícios para o teste da importação',image:'https://images.example/foto.jpg','contact:instagram':'https://instagram.com/cozinhaqa'}},{id:702,type:'node',lat:-23.55,lon:-46.63,tags:{name:'Empresa fora do raio',phone:'1130001234'}}]});
 const found=await json('search',base);assert.equal(found.items.length,1);assert.equal(found.area.radiusKm,3);assert.equal(found.area.state,'AP');assert.equal(found.items[0].city,'Macapá / AP');assert.equal(found.items[0].lat,.041);
 assert.equal((await json('search',base)).batchId,found.batchId);
 const selected={batch_id:found.batchId,item_id:found.items[0].id};const imported=await json('import',selected),again=await json('import',selected);assert.equal(imported.lead.id,again.lead.id);
 const record=JSON.parse((await db.prepare('SELECT data FROM studio_records WHERE key=?').bind('lead:'+imported.lead.id).first()).data);
 assert.equal(record.city,'Macapá / AP');assert.equal(record.businessPhone,'(96) 3000-1234');assert.equal(record.instagram,'https://instagram.com/cozinhaqa');assert.equal(record.discovery.lat,.041);assert.equal(record.hours,'Mo-Fr 09:00-18:00');assert.equal(record.phone,'');assert.equal(record.value,0);assert.equal(record.stage,'novo');assert.equal(record.publicEnabled,false);assert.equal(record.contactAllowed,false);assert.ok(record.research.sources.some(s=>s.url==='https://images.example/foto.jpg'));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM studio_assets').first()).n,0);
 const mcp=await req('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'prospecto_locate_region',arguments:{query:'Macapá, AP'}}});assert.equal(mcp.status,200);const rpc=await mcp.json();assert.equal(rpc.result.isError,false);assert.equal(rpc.result.structuredContent.items[0].state,'AP');
 await db.prepare("DELETE FROM studio_discovery_limits WHERE bucket LIKE 'location:%'").run();
 fetchMock.get('https://photon.komoot.io').intercept({path:photonPath('Curitiba, PR'),method:'GET'}).reply(503,'Unavailable');
 await json('locate',{query:'Curitiba, PR'},502);assert.equal((await json('locate',{query:'Macapá, AP'})).items[0].state,'AP');
 fetchMock.assertNoPendingInterceptors();console.log('PASS: localização com autenticação, cache, origem, cotas e falha da fonte; pesquisa nacional por raio; importação idempotente com telefone, redes, cidade/UF, coordenadas e referência de foto; sem criação na localização, download de mídia, publicação ou envio; acesso equivalente via MCP.');
}finally{await mf.dispose();}
