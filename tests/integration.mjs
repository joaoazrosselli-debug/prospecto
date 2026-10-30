import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {normalizeLead,createPrompt,createSite,parseCSV,toCSV,summarize} from '../public/core.js';
import {zipFiles} from '../public/zip.js';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const root=path.resolve('dist/server');
const names=['index.js',...(await readdir(root,{recursive:true})).filter(f=>f.endsWith('.js')&&f!=='index.js')];
const mf=new Miniflare({modules:names.map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PROSPECTO_OWNER_EMAIL:'qa.owner@prospecto.test'},cf:false});
const identities={owner:{'oai-authenticated-user-id':'qa-owner','oai-authenticated-user-email':'qa.owner@prospecto.test'},member:{'oai-authenticated-user-id':'qa-member','oai-authenticated-user-email':'qa.member@prospecto.test'},stranger:{'oai-authenticated-user-id':'qa-stranger','oai-authenticated-user-email':'qa.stranger@prospecto.test'}};
async function request(route,{as='owner',method='GET',body,headers={}}={}){
 const h={...(identities[as]||{}),'X-Prospecto-Request':'1',...headers};
 if(body instanceof FormData){const encoded=new Request('https://qa.prospecto.test',{method:'POST',body});h['Content-Type']=encoded.headers.get('Content-Type');body=new Uint8Array(await encoded.arrayBuffer());}
 else if(body){body=JSON.stringify(body);h['Content-Type']='application/json';}
 return mf.dispatchFetch('https://qa.prospecto.test'+route,{method,headers:h,body});
}
async function getJSON(route,options,status=200){const r=await request(route,options);const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json;}
async function update(base,changes,as='owner'){return getJSON('/api/records',{as,method:'POST',body:{kind:'lead',id:'test-client',base,changes}});}
try{
 const db=await mf.getD1Database('DB');
 for(const filename of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+filename,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await getJSON('/api/bootstrap',{as:'anonymous'},401);
 await getJSON('/api/bootstrap',{as:'stranger'},403);
 await getJSON('/api/team',{method:'POST',body:{action:'add',email:'qa.member@prospecto.test'},headers:{Origin:'https://outside.test'}},403);
 await getJSON('/api/team',{method:'POST',body:{action:'add',email:'qa.member@prospecto.test'}});
 await getJSON('/api/team',{as:'member',method:'POST',body:{action:'add',email:'unwanted@prospecto.test'}},403);
 console.log('PASS: login, autorização por e-mail, administração e proteção de origem.');
 const lead=normalizeLead({id:'test-client',name:'Oficina <exemplo>',city:'Curitiba / PR',sector:'Assistência técnica',phone:'41999990000',notes:'NOTA_INTERNA_NAO_PUBLICAR',products:[{id:'item-1',title:'Diagnóstico',description:'Avaliação do aparelho.',price:49.9,priceMode:'fixed',kind:'service'}],publicPrices:true});
 let {record}=await update({},lead);
 let state=await getJSON('/api/bootstrap',{as:'member'});assert.equal(state.leads[0].name,lead.name);assert.equal(state.leads[0].products[0].price,49.9);
 const base={...record};
 await Promise.all([update(base,{headline:'Assistência para o seu aparelho.'}),update(base,{hours:'Segunda a sexta, das 9h às 18h.'},'member')]);
 state=await getJSON('/api/bootstrap');record=state.leads[0];assert.equal(record.headline,'Assistência para o seu aparelho.');assert.match(record.hours,/Segunda/);
 const races=await Promise.all([request('/api/records',{method:'POST',body:{kind:'lead',id:lead.id,base:record,changes:{headline:'Versão A'}}}),request('/api/records',{as:'member',method:'POST',body:{kind:'lead',id:lead.id,base:record,changes:{headline:'Versão B'}}})]);
 assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 const conflict=await races.find(r=>r.status===409).json();assert.equal(conflict.code,'conflict');assert.deepEqual(conflict.fields,['headline']);
 console.log('PASS: dados compartilhados, preços preservados e conflitos de edição sem sobrescrita silenciosa.');
 const fake=new FormData();fake.set('leadId',lead.id);fake.set('file',new File(['<script>alert(1)</script>'],'logo.png',{type:'image/png'}));
 await getJSON('/api/assets',{method:'POST',body:fake},400);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=','base64');
 const form=new FormData();form.set('leadId',lead.id);form.set('role','logo');form.set('alt','Logo fornecida para o teste');form.set('file',new File([png],'logo.png',{type:'image/png'}));
 const {asset}=await getJSON('/api/assets',{method:'POST',body:form},201);
 let media=await request(asset.url,{as:'member'});assert.equal(media.status,200);assert.equal(media.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await media.arrayBuffer()),png);
 await getJSON(asset.url,{as:'stranger'},403);
 media=await request(asset.url,{headers:{Range:'bytes=0-9'}});assert.equal(media.status,206);assert.equal((await media.arrayBuffer()).byteLength,10);
 await getJSON('/api/assets/'+asset.id,{method:'PATCH',body:{role:'hero',alt:'Imagem de teste'}});
 console.log('PASS: upload validado, bytes preservados, controle dos arquivos e leitura parcial de mídia.');
 const token='0123456789abcdef0123456789abcdef';
 assert.equal((await request('/p/'+token,{as:'anonymous'})).status,404);
 state=await getJSON('/api/bootstrap');record=state.leads[0];
 await update(record,{publicToken:token,publicEnabled:true,headline:'Oficina <exemplo>'});
 const page=await request('/p/'+token,{as:'anonymous'}),html=await page.text();assert.equal(page.status,200);assert.match(html,/Oficina &lt;exemplo&gt;/);assert.ok(!html.includes('NOTA_INTERNA_NAO_PUBLICAR'));assert.match(page.headers.get('Content-Security-Policy'),/script-src 'none'/);
 media=await request('/p/'+token+'/media/'+asset.id,{as:'anonymous'});assert.equal(media.status,200);assert.deepEqual(Buffer.from(await media.arrayBuffer()),png);
 assert.equal((await request('/p/'+token+'/media/not-this-client',{as:'anonymous'})).status,404);
 state=await getJSON('/api/bootstrap');record=state.leads[0];await update(record,{publicEnabled:false});
 assert.equal((await request('/p/'+token,{as:'anonymous'})).status,404);assert.equal((await request('/p/'+token+'/media/'+asset.id,{as:'anonymous'})).status,404);
 console.log('PASS: apresentação compartilhável, sem notas internas, e revogação de página e mídias.');
 await getJSON('/api/team',{method:'POST',body:{action:'remove',email:'qa.member@prospecto.test'}});await getJSON('/api/bootstrap',{as:'member'},403);
 await getJSON('/api/assets/'+asset.id,{method:'DELETE'});assert.equal((await request(asset.url)).status,404);
 const old=normalizeLead({id:'old-client',nome:'Cadastro anterior',servicos:'Venda\nAssistência',value:500,received:250,createdAt:'2026-10-28T10:00:00.000Z'});assert.equal(old.id,'old-client');assert.equal(old.received,250);
 assert.equal(summarize([{...old,stage:'fechado'}],[{value:50}]).cash,200);
 const csv=toCSV([{...old,name:'=1+1'}]);assert.match(csv,/'=1\+1/);assert.equal(parseCSV('nome;servicos\nLoja;"Venda\nAssistência"')[0].services,'Venda\nAssistência');
 const prompt=createPrompt({...lead,promptOverride:'Minha edição'},{promptTemplate:'Padrão'});assert.equal(prompt,'Minha edição');assert.ok(!createPrompt(lead,{}).includes('NOTA_INTERNA_NAO_PUBLICAR'));
 const noPrice=createSite({...lead,publicPrices:false});assert.ok(!noPrice.includes('49,90'));
 const zip=zipFiles([{name:'index.html',data:html},{name:'midias/teste.png',data:png}]);await writeFile('/workspace/scratch/0318c5b1a70f/prospecto-qa-export.zip',Buffer.from(await zip.arrayBuffer()));
 console.log('PASS: revogação de equipe, cadastro antigo, caixa manual, CSV, prompt editável e privacidade dos preços.');
 console.log('Integração completa aprovada. Banco e arquivos de teste são temporários.');
}finally{await mf.dispose();}
