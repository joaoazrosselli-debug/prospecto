import assert from 'node:assert/strict';
import {normalizeLead} from '../public/core.js';
import {discoveryQuery,discoveryArea,discoveryCircle,normalizeOsmResults,normalizeLocationResults,validMapPoint,distanceKm} from '../public/discovery-data.js';

const input={segment:'restaurant',region:'map',center:{lat:.04015,lon:-51.05696,label:'Macapá · Amapá',city:'Macapá / AP',state:'AP'},radius_km:3,limit:50,require_contact:true};
assert.equal(discoveryArea(input).radiusKm,3);
const circle=discoveryCircle(discoveryArea(input));assert.equal(circle.geometry.coordinates[0].length,65);for(const [lon,lat] of circle.geometry.coordinates[0])assert.ok(Math.abs(distanceKm(input.center,{lat,lon})-3)<.00001);
assert.match(discoveryQuery(input),/around:3000,0.04015,-51.05696/);
assert.throws(()=>discoveryQuery({...input,center:{lat:0,lon:0}}));
assert.throws(()=>discoveryQuery({...input,radius_km:1000}));
assert.throws(()=>discoveryQuery({...input,segment:'restaurant"];out;'}));
assert.equal(validMapPoint(0,-51),true);
assert.equal(validMapPoint('0',-51),false);
assert.equal(validMapPoint(Infinity,-51),false);
assert.ok(Math.abs(distanceKm({lat:0,lon:-51},{lat:.01,lon:-51})-1.11195)<.001);
const items=normalizeOsmResults({elements:[
 {id:1,type:'node',lat:0,lon:-51.05696,tags:{name:'Fora do raio',phone:'(96) 3000-0001'}},
 {id:2,type:'node',lat:.041,lon:-51.05696,tags:{name:'Empresa AP',phone:'(96) 3000-0002','addr:city':'Macapá','addr:state':'Amapá',opening_hours:'Mo-Fr 09:00-18:00',description:'Descrição da fonte'}},
 {id:3,type:'way',center:{lat:.04,lon:-51.058},tags:{name:'Empresa sem cidade confirmada',phone:'(96) 3000-0003'}},
 {id:4,type:'node',tags:{name:'Sem coordenadas',phone:'(96) 3000-0004'}},
 {id:5,type:'node',lat:.04,lon:-51.057,tags:{name:'Sem telefone'}},
]},input);
assert.equal(items.length,3);assert.ok(!items.some(i=>i.id==='node/1'));
const company=items.find(i=>i.id==='node/2');assert.equal(company.city,'Macapá / AP');assert.ok(!company.city.includes('/ PR'));assert.equal(company.cityConfirmed,true);assert.equal(company.openingHours,'Mo-Fr 09:00-18:00');assert.equal(company.description,'Descrição da fonte');
assert.equal(items.find(i=>i.id==='way/3').cityConfirmed,false);
assert.equal(items.find(i=>i.id==='node/4').lat,undefined,'Unknown coordinates must not be invented at the circle centre.');
const zero=normalizeOsmResults({elements:[{id:6,type:'node',lat:0,lon:-51,tags:{name:'Empresa no Equador',phone:'9630000006','addr:city':'Macapá'}}]},{...input,center:{lat:0,lon:-51,label:'Equador',city:'Macapá / AP',state:'AP'}})[0];
assert.equal(zero.lat,0);
const lead=normalizeLead({...company,discovery:{provider:'osm',externalId:company.id,lat:company.lat,lon:company.lon}});assert.equal(lead.discovery.lat,company.lat);
const raw={features:[
 {geometry:{coordinates:[-51,.04]},properties:{name:'Macapá',city:'Macapá',state:'Amapá',countrycode:'BR',type:'city'}},
 {geometry:{coordinates:[-63,-5]},properties:{name:'Macapa',state:'Amazonas',countrycode:'BR',type:'district'}},
 {geometry:{coordinates:[-51,.04]},properties:{name:'Macapá',city:'Macapá',state:'Amapá',countrycode:'BR',type:'city'}},
 {geometry:{coordinates:[-58,-34]},properties:{name:'Outro país',countrycode:'AR',type:'city'}},
 {geometry:{coordinates:[0,0]},properties:{name:'Coordenadas indevidas',countrycode:'BR',type:'city'}},
]};
const locations=normalizeLocationResults(raw,'Macapa');assert.equal(locations.length,2);assert.equal(locations[0].city,'Macapá / AP');assert.equal(locations[0].lat,.04);assert.equal(locations[0].state,'AP');
console.log('PASS: busca nacional por ponto e raio, cidades/UF corretas, distância e limite espacial, Equador, coordenadas ausentes, geocodificação restrita ao Brasil e preservação da origem no catálogo.');
