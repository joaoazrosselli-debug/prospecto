import assert from 'node:assert/strict';
import {outreachQueue,outreachReviewBatch} from '../public/outreach.js';
import {normalizeLead,summarize} from '../public/core.js';
import {reviewLink,reviewLeadId} from '../public/review-links.js';
const pending=normalizeLead({id:'pending',name:'Pendente',phone:'',notes:'NOTA_INTERNA',value:850,received:200});
const test=normalizeLead({id:'test',name:'Loja fictícia',isTest:true});
const rows=outreachQueue([pending,test]);assert.equal(rows.filter(r=>r.ready).length,0);
const before=JSON.stringify(rows),batch=outreachReviewBatch(rows,'2026-10-29T20:00:00Z');
assert.deepEqual(batch.counts,{total:2,ready:0,pending:2,tests:1});assert.equal(batch.sent,false);assert.equal(batch.mode,'internal_review');
assert.ok(batch.contacts.every(r=>r.pending.length));assert.equal(JSON.stringify(rows),before);
assert.ok(!JSON.stringify(batch).includes('NOTA_INTERNA'));assert.ok(!JSON.stringify(batch).includes('850'));
const many=Array.from({length:35},(_,i)=>({...pending,id:'lead-'+i}));assert.equal(outreachReviewBatch(outreachQueue(many)).contacts.length,35);
const link=reviewLink('test-jzincu-fitness','https://prospecto.example');assert.equal(reviewLeadId(new URL(link).search),'test-jzincu-fitness');assert.equal(new URL(link).hash,'#producao');
assert.equal(reviewLeadId('?revisar=../../api/files'),'');assert.throws(()=>reviewLink('../outside','https://prospecto.example'));
const archived=normalizeLead({...pending,archivedAt:'2026-10-29T20:00:00Z',publicEnabled:false});assert.equal(outreachQueue([archived]).length,0);assert.equal(summarize([archived]).total,0);assert.equal(summarize([archived]).received,200);
const number='5541998765432',refused=normalizeLead({id:'refused',name:'Recusa antiga',phone:number,archivedAt:'2026-10-29T20:00:00Z',outreach:{permission:'blocked',permissionNumber:number}}),other=normalizeLead({id:'other',name:'Mesmo contato',phone:number,outreach:{qualified:true,permission:'allowed',permissionSource:'Teste de permissão',permissionNumber:number}});
assert.equal(outreachQueue([refused,other])[0].ready,false);
console.log('PASS: revisão disponível com zero contatos prontos, sem corte em 20 fichas, sem finanças/notas, link privado válido, lixeira fora da fila e histórico financeiro/recusas preservados.');

// Exercise the actual sign-in renderer: template expressions must not become
// literal text in a shared review URL.
const elements=new Map(),priorDocument=globalThis.document,priorLocation=globalThis.location;
globalThis.document={querySelector(selector){if(!elements.has(selector))elements.set(selector,{style:{},innerHTML:''});return elements.get(selector);},addEventListener(){}};
globalThis.location={pathname:'/',search:'?revisar=test-jzincu-fitness',hash:'#producao'};
try{
 const {configureSettings,renderAccessGate}=await import('../public/settings.js');configureSettings({icon:()=>''});
 for(const error of [{code:'signin',message:'Entre para revisar.'},{code:'membership',message:'Conta não autorizada.',email:'qa@example.test'}]){
  renderAccessGate(error);const html=elements.get('#view').innerHTML;
  const href=html.match(/href="([^"]*(?:signin|signout)-with-chatgpt[^"]*)"/)[1];
  assert.equal(new URL(href,'https://prospecto.example').searchParams.get('return_to'),'/?revisar=test-jzincu-fitness#producao');
  assert.ok(!href.includes('${'));
 }
 console.log('PASS: entrada e troca de conta mantêm o destino da revisão, sem expressões literais no link.');
}finally{globalThis.document=priorDocument;globalThis.location=priorLocation;}
