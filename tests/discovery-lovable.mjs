import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {outreachMessage} from '../public/outreach.js';
import {normalizeLead,createSite,toCSV,parseCSV} from '../public/core.js';
import {discoveryQuery,normalizeOsmResults,siteAssessmentLabel} from '../public/discovery-data.js';
import {createLovablePrompt,lovableLink,validLovableProject} from '../public/lovable.js';
const request={segment:'restaurant',region:'bacacheri',limit:10,require_contact:true};
const payload={elements:[
 {id:1,type:'node',lat:-25.389,lon:-49.235,tags:{name:'Cozinha de teste',phone:'(41) 3000-1234',website:'https://instagram.com/cozinha', 'addr:street':'Rua de teste','addr:housenumber':'15'}},
 {id:2,type:'node',tags:{name:'Sem telefone',website:'https://restaurante.example'}},
 {id:3,type:'node',tags:{name:'WhatsApp confirmado', 'contact:whatsapp':'(41) 99999-1234',website:'https://restaurante.example'}},
 {id:3,type:'node',tags:{name:'Duplicata',phone:'4130001234'}},
 {id:4,type:'node',tags:{name:'Fechado',disused:'yes',phone:'4130001234'}},
]};
const items=normalizeOsmResults(payload,request,'2026-10-30T01:00:00Z');assert.equal(items.length,2);assert.equal(items[0].businessPhone,'(41) 3000-1234');assert.equal(items[0].whatsapp,'');assert.equal(items[0].website,'');assert.equal(items[0].instagram,'https://instagram.com/cozinha');assert.equal(items[0].websiteAssessment,'not_found');assert.match(siteAssessmentLabel(items[0]),/não localizado/);assert.equal(items[1].whatsapp,'(41) 99999-1234');assert.match(discoveryQuery(request),/contact:phone/);assert.throws(()=>discoveryQuery({...request,segment:'"];out;'}));
const lead=normalizeLead({name:'Loja Teste',sector:'Roupas',city:'Curitiba / PR',businessPhone:'4130001234',pageTemplate:'studio',projectType:'catalog',description:'Descrição confirmada.',notes:'NOTE_PRIVATE_ABC',value:1234567,received:20,products:[{title:'Produto A',price:159.9,priceMode:'fixed',kind:'product'}],facebook:'https://facebook.com/lojateste',assets:[]});
const prompt=createLovablePrompt(lead);assert.ok(!prompt.includes('NOTE_PRIVATE_ABC'));assert.ok(!prompt.includes('1234567'));assert.ok(!prompt.includes('/api/files/'));assert.match(prompt,/CATÁLOGO/);assert.match(prompt,/Telefone comercial/);assert.equal(new URL(lovableLink(prompt)).hash,'#prompt='+encodeURIComponent(prompt));assert.throws(()=>lovableLink(''));assert.throws(()=>lovableLink('x'.repeat(50001)));assert.equal(validLovableProject('https://lovable.dev/projects/abc'),'https://lovable.dev/projects/abc');assert.equal(validLovableProject('https://lovable.dev.evil.example/projects/abc'),'');assert.equal(validLovableProject('javascript:alert(1)'),'');
assert.ok(!outreachMessage({...lead,externalPreviewUrl:'https://preview.example',externalPreviewReviewed:false},{},1).includes('https://preview.example'));assert.ok(outreachMessage({...lead,externalPreviewUrl:'https://preview.example',externalPreviewReviewed:true},{},1).includes('https://preview.example'));
assert.ok(!createSite(lead,{accent:'red;</style><script>BAD</script>'}).includes('<script>BAD'))
const custom={...lead,customHtml:'<!doctype html><html><body>Custom preserved</body></html>'};assert.equal(createSite(custom),custom.customHtml);
for(const [sector,mode] of [['Restaurante','food'],['Loja de roupas','store'],['Oficina mecânica','service']]){
 const html=createSite({...lead,sector,projectType:'landing',publicPrices:false});assert.match(html,new RegExp('body class="'+mode+'"'));assert.ok(!html.includes('159,90'));assert.ok(html.includes('tel:+554130001234'));assert.ok(!html.includes('https://wa.me/'));assert.ok(!html.includes('NOTE_PRIVATE_ABC'));assert.match(html,/:hover/);assert.match(html,/:focus-visible/);assert.match(html,/prefers-reduced-motion/);assert.match(html,/data:font\/woff;base64/);
 const dom=parse(html),ids=new Set(),anchors=[];function walk(n){for(const a of n.attrs||[]){if(a.name==='id')ids.add(a.value);if(a.name==='href'&&a.value.startsWith('#'))anchors.push(a.value.slice(1));}for(const c of n.childNodes||[])walk(c);}walk(dom);assert.ok(anchors.every(id=>ids.has(id)),JSON.stringify(anchors));
}
assert.match(createSite({...lead,publicPrices:true}),/159,90/);
const exported=toCSV([normalizeLead({...lead,source:'https://www.openstreetmap.org/node/99'})]);assert.match(exported,/OpenStreetMap contributors/);const imported=parseCSV(exported)[0];assert.equal(imported.businessPhone,lead.businessPhone);assert.equal(imported.phone,'');assert.equal(imported.discovery.externalId,'node/99');
console.log('PASS: busca valida canais e fontes, não presume WhatsApp/site; prompt exclui dados comerciais internos; link Lovable é seguro e editável; novos modelos preservam HTML, preços e contatos.');
