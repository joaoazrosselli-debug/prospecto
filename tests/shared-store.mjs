import assert from 'node:assert/strict';
import {SharedStore} from '../public/shared.js';
import {normalizeLead} from '../public/core.js';
import {cleanRecord,changedConflicts} from '../lib/studio-validation.js';
import {conflictPresentation} from '../public/sync-conflict.js';
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const server={settings:{studio:'Meu estúdio',city:'Curitiba / PR',price:500,goal:3000,promptTemplate:'',_revision:0},leads:[],expenses:[],access:[],user:{name:'Teste',email:'teste@prospecto.test'},storage:{database:true,files:true}};
let posts=0,fail=false;
globalThis.fetch=async(url,options={})=>{
 if(fail)throw Error('Sem rede');
 if(url==='/api/bootstrap')return Response.json(server);
 const {kind,id,base,changes}=JSON.parse(options.body);posts++;assert.ok(posts<25,'Não deve entrar em um ciclo de gravações.');
 const collection=kind==='lead'?server.leads:server.expenses;
 const old=kind==='settings'?server.settings:collection.find(x=>x.id===id);
 const conflicts=old?changedConflicts(old,base,changes):[];
 if(conflicts.length)return Response.json({error:'Conflito',code:'conflict',current:old,fields:conflicts},{status:409});
 const next={...cleanRecord(kind,{...old,...changes},id),_revision:(old?._revision||0)+1};
 if(kind==='settings')server.settings=next;else if(old)collection.splice(collection.indexOf(old),1,next);else collection.push(next);
 return Response.json({record:next});
};
const make=state=>new SharedStore(state,{save(){},onStatus(){},onChange(){},onConflict(){},onDenied(error){throw error;}});
const client=normalizeLead({id:'legacy-client',name:'Cadastro do navegador',city:'Curitiba / PR',value:500,received:250});
const state={version:2,settings:{promptTemplate:'',goal:3000,price:500,city:'Curitiba / PR',studio:'Meu estúdio'},leads:[client],expenses:[]};
const store=make(state);await store.connect();assert.equal(store.dirty(),false);assert.equal(server.leads.length,1);assert.equal(server.leads[0].received,250);assert.equal(posts,2);
console.log('PASS: migração da base do navegador, IDs e valores preservados, sem ciclo por ordem dos campos.');
state.leads[0].headline='Rascunho sem rede';fail=true;store.schedule();await store.flush();assert.equal(store.online,false);assert.equal(state.leads[0].headline,'Rascunho sem rede');
fail=false;server.leads[0].hours='Horário alterado pela equipe';await store.connect();assert.equal(server.leads[0].headline,'Rascunho sem rede');assert.equal(state.leads[0].hours,'Horário alterado pela equipe');assert.equal(store.dirty(),false);
console.log('PASS: rascunho offline preservado e combinado com alteração da equipe em outro campo.');
state.leads[0].headline='Minha edição';server.leads[0].headline='Edição da equipe';server.leads[0].hours='Novo horário';await store.connect();assert.ok(store.blocked);assert.equal(state.leads[0].headline,'Minha edição');assert.equal(state.leads[0].hours,'Novo horário');
store.resolve('remote');await new Promise(r=>setTimeout(r,0));assert.equal(state.leads[0].headline,'Edição da equipe');assert.equal(state.leads[0].hours,'Novo horário');assert.equal(store.dirty(),false);
console.log('PASS: conflito explícito e resolução sem apagar campos independentes.');
// A second device must get the shared records and not duplicate a legacy semantic match.
values.clear();const duplicate=normalizeLead({...client,id:'other-local-id'});const secondState={version:2,settings:{...server.settings},leads:[duplicate],expenses:[]};const second=make(secondState);await second.connect();assert.equal(secondState.leads.length,1);assert.equal(secondState.leads[0].id,'legacy-client');assert.equal(server.leads.length,1);
console.log('PASS: segundo dispositivo e migração sem duplicar empresa já presente na nuvem.');

// A reload normalizes an old absent trash field to ''. That is not a local
// restore, even if another device has since archived the shared record.
values.clear();
const legacy=normalizeLead({id:'trash-legacy',name:'Empresa antiga',city:'Curitiba / PR'});delete legacy.archivedAt;
const archivedAt='2026-10-30T09:00:00.000Z';
server.leads=[{...legacy,archivedAt,publicEnabled:false,_revision:2}];
values.set('prospecto.cloud.base.v2',JSON.stringify({'settings:studio':server.settings,'lead:trash-legacy':legacy}));
const phoneState={settings:{...server.settings},leads:[normalizeLead(legacy)],expenses:[]};
const phone=make(phoneState),beforePosts=posts;await phone.connect();
assert.equal(phone.blocked,null);assert.equal(phoneState.leads[0].archivedAt,archivedAt);assert.equal(phone.dirty(),false);assert.equal(posts,beforePosts);assert.equal(server.leads[0].publicEnabled,false);
console.log('PASS: celular com cache anterior à lixeira adota o arquivamento remoto sem criar restauração ou conflito falso.');

// A real offline restore racing with a different archive still needs a choice.
phoneState.leads[0].archivedAt='';phoneState.leads[0].notes='Anotação independente';
server.leads[0].archivedAt='2026-10-30T10:00:00.000Z';await phone.connect();
assert.ok(phone.blocked);assert.deepEqual(phone.blocked.error.fields,['archivedAt']);
const presentation=conflictPresentation(phone.blocked,phoneState.leads[0]);
assert.match(presentation.description,/Empresa antiga/);assert.equal(presentation.fields[0].label,'Situação na lixeira');assert.equal(presentation.fields[0].local,'Ativa na base');assert.match(presentation.fields[0].remote,/Na lixeira desde/);assert.ok(!JSON.stringify(presentation).includes('archivedAt'));
phone.resolve('remote');await new Promise(r=>setTimeout(r,0));
assert.equal(phoneState.leads[0].archivedAt,server.leads[0].archivedAt);assert.equal(server.leads[0].notes,'Anotação independente');assert.equal(phone.dirty(),false);
console.log('PASS: conflito real de restauração continua explícito, com nome da empresa, estados legíveis e preservação de anotações.');
assert.deepEqual(changedConflicts({archivedAt:''},{},{archivedAt}),[]);
assert.deepEqual(changedConflicts({}, {archivedAt:''},{archivedAt}),[]);
assert.deepEqual(changedConflicts({archivedAt},{},{archivedAt:''}),['archivedAt']);
assert.deepEqual(changedConflicts({archivedAt:'2026-10-30T10:00:00.000Z'},{archivedAt},{archivedAt:''}),['archivedAt']);
console.log('PASS: servidor equipara ausência/vazio sem liberar sobrescrita de arquivamentos reais.');
