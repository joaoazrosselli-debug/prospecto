export const DISCOVERY_SEGMENTS=[
 ['all','Comércios locais',[['shop','*'],['amenity','restaurant|cafe|fast_food|car_wash|dentist|clinic|pharmacy'],['leisure','fitness_centre']]],
 ['restaurant','Restaurantes',[['amenity','restaurant']]],['food','Lanchonetes',[['amenity','fast_food']]],['cafe','Cafeterias',[['amenity','cafe']]],
 ['car_wash','Lava-jatos',[['amenity','car_wash']]],['pet','Pet shops e veterinárias',[['shop','pet'],['amenity','veterinary']]],
 ['beauty','Salões e barbearias',[['shop','hairdresser|beauty']]],['repair','Oficinas mecânicas',[['shop','car_repair']]],
 ['fitness','Academias',[['leisure','fitness_centre']]],['electronics','Eletrônicos e celulares',[['shop','electronics|mobile_phone|computer']]],
 ['bakery','Padarias',[['shop','bakery']]],['market','Mercados',[['shop','supermarket|convenience|greengrocer']]],
 ['pharmacy','Farmácias',[['amenity','pharmacy']]],['health','Clínicas e dentistas',[['amenity','clinic|doctors|dentist']]],
 ['clothes','Lojas de roupas',[['shop','clothes|shoes|sports']]],['furniture','Móveis e decoração',[['shop','furniture|interior_decoration']]],
];
// Search circles, not administrative boundaries. The UI displays each radius.
export const DISCOVERY_REGIONS=[
 ['bairro-alto','Bairro Alto e arredores','Curitiba / PR','Bairro Alto',-25.4025,-49.2086,2500],
 ['bacacheri','Bacacheri e arredores','Curitiba / PR','Bacacheri',-25.389,-49.235,2500],
 ['colombo','Colombo e arredores','Colombo / PR','',-25.2925,-49.2241,10000],
 ['curitiba','Curitiba e arredores','Curitiba / PR','',-25.4284,-49.2733,15000],
];
const typeLabels={restaurant:'Restaurante',cafe:'Cafeteria',fast_food:'Lanchonete',car_wash:'Lava-jato',pet:'Pet shop',veterinary:'Clínica veterinária',hairdresser:'Salão e barbearia',beauty:'Salão de beleza',car_repair:'Oficina mecânica',fitness_centre:'Academia',electronics:'Eletrônicos',mobile_phone:'Celulares',computer:'Informática',bakery:'Padaria',supermarket:'Supermercado',convenience:'Mercado',greengrocer:'Hortifruti',pharmacy:'Farmácia',dentist:'Dentista',clinic:'Clínica',doctors:'Consultório',clothes:'Loja de roupas',shoes:'Calçados',sports:'Artigos esportivos',furniture:'Móveis',interior_decoration:'Decoração'};
export const BRAZIL_BOUNDS={south:-34,north:6,west:-74,east:-28};
const states={'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA','Ceará':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Goiás':'GO','Maranhão':'MA','Mato Grosso':'MT','Mato Grosso do Sul':'MS','Minas Gerais':'MG','Pará':'PA','Paraíba':'PB','Paraná':'PR','Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ','Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO','Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE','Tocantins':'TO'};
export const validMapPoint=(lat,lon)=>typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=BRAZIL_BOUNDS.south&&lat<=BRAZIL_BOUNDS.north&&lon>=BRAZIL_BOUNDS.west&&lon<=BRAZIL_BOUNDS.east;
export function stateCode(value){const s=String(value||'').trim();return states[s]||Object.values(states).find(code=>code===s.toUpperCase())||'';}
export function discoveryArea(input){
 const region=DISCOVERY_REGIONS.find(r=>r[0]===input.region),point=input.region==='map'?input.center:null;
 const lat=point?.lat??region?.[4],lon=point?.lon??region?.[5],radiusKm=input.radius_km??(region?region[6]/1000:2.5);
 if(!validMapPoint(lat,lon)||typeof radiusKm!=='number'||!Number.isFinite(radiusKm)||radiusKm<.5||radiusKm>20)throw Error('Escolha um ponto no Brasil e um raio entre 0,5 e 20 km.');
 return {lat,lon,radiusKm,label:String(point?.label||region?.[1]||'Ponto escolhido no mapa').slice(0,180),city:String(point?.city||region?.[2]||'').slice(0,100),state:stateCode(point?.state||region?.[2]?.split('/').at(-1)),neighborhood:String(point?.neighborhood||region?.[3]||'').slice(0,100)};
}
export function distanceKm(a,b){const rad=n=>n*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 6371.0088*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function discoveryCircle(area){
 const lat=area.lat*Math.PI/180,lon=area.lon*Math.PI/180,angle=area.radiusKm/6371.0088;
 const coordinates=Array.from({length:65},(_,i)=>{const bearing=i/64*2*Math.PI,phi=Math.asin(Math.sin(lat)*Math.cos(angle)+Math.cos(lat)*Math.sin(angle)*Math.cos(bearing)),lambda=lon+Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(phi));return [lambda*180/Math.PI,phi*180/Math.PI];});
 return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coordinates]}};
}
export function normalizeLocationResults(payload,query=''){
 const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),term=normalized(query.split(',')[0]),seen=new Set();
 return (payload.features||[]).flatMap(feature=>{
  const p=feature.properties||{},[lon,lat]=feature.geometry?.coordinates||[];
  if(String(p.countrycode||'').toUpperCase()!=='BR'||!validMapPoint(lat,lon)||!p.name)return [];
  const state=stateCode(p.state),city=String(p.city||p.town||(['city','town','village'].includes(p.type)?p.name:'')).slice(0,100),parts=[p.name,city!==p.name?city:'',p.state,'Brasil'].filter(Boolean),label=[...new Set(parts)].join(' · ').slice(0,180),key=lat.toFixed(5)+','+lon.toFixed(5)+':'+label;
  if(seen.has(key))return [];seen.add(key);
  return [{lat,lon,label,name:String(p.name).slice(0,120),city:city+(city&&state?' / '+state:''),state,neighborhood:['district','locality'].includes(p.type)?String(p.name).slice(0,100):'',type:String(p.type||'place'),provider:'photon',rank:(normalized(p.name)===term?20:0)+(['city','town','village'].includes(p.type)?5:p.type==='state'?3:0)}];
 }).sort((a,b)=>b.rank-a.rank).slice(0,6).map(({rank,...location})=>location);
}
const text=(v,n=200)=>String(v??'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,n);
export function discoveryURL(v){try{const u=new URL(/^https?:\/\//i.test(v||'')?v:'https://'+v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:'';}catch{return '';}}
export function socialURL(v,network){const u=discoveryURL(v);if(!u)return '';const h=new URL(u).hostname.toLowerCase().replace(/^www\./,'');return (network==='instagram'?['instagram.com']:['facebook.com','m.facebook.com','fb.com']).includes(h)&&new URL(u).pathname!=='/'?u:'';}
export function websiteFrom(v){const u=discoveryURL(v);if(!u)return '';const h=new URL(u).hostname.toLowerCase().replace(/^www\./,'');return /(^|\.)(instagram\.com|facebook\.com|fb\.com|wa\.me|whatsapp\.com|google\.com|google\.com\.br|goo\.gl|maps\.app\.goo\.gl|linktr\.ee|tiktok\.com)$/.test(h)?'':u;}
export function contactPhone(v){return text(String(v||'').split(';')[0],40).replace(/[^\d+()\s-]/g,'').trim();}
export function contactDigits(v){let n=String(v||'').replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return /^55\d{10,11}$/.test(n)?n:'';}
export function normalizeOsmResults(payload,request,checkedAt=new Date().toISOString()){
 const segment=DISCOVERY_SEGMENTS.find(x=>x[0]===request.segment);if(!segment)return [];
 let area;try{area=discoveryArea(request);}catch{return [];}
 const seen=new Set(),items=[];
 for(const node of (payload.elements||[]).slice(0,250)){
  const t=node.tags||{},name=text(t.name,120),id=['node','way','relation'].includes(node.type)&&/^\d+$/.test(String(node.id))?`${node.type}/${node.id}`:'';
  if(!name||!id||seen.has(id)||t.disused==='yes'||t.abandoned==='yes')continue;seen.add(id);
  const rawWebsite=t['contact:website']||t.website||'',website=websiteFrom(rawWebsite),instagram=socialURL(t['contact:instagram']||t.instagram||rawWebsite,'instagram'),facebook=socialURL(t['contact:facebook']||t.facebook||rawWebsite,'facebook');
  const businessPhone=contactPhone(t['contact:phone']||t.phone||t['contact:mobile']||t.mobile),whatsapp=contactPhone(t['contact:whatsapp']||t.whatsapp);
  const street=[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),neighborhood=text(t['addr:suburb']||t['addr:neighbourhood'],100);
  const lat=node.lat??node.center?.lat,lon=node.lon??node.center?.lon,hasPoint=validMapPoint(lat,lon),state=stateCode(t['addr:state'])||area.state,city=t['addr:city']?[t['addr:city'],state].filter(Boolean).join(' / '):area.city;
  if(hasPoint&&distanceKm(area,{lat,lon})>area.radiusKm+.05)continue;
  const item={id,provider:'osm',name,sector:segment[0]==='all'?text(typeLabels[t.shop||t.amenity||t.leisure]||'Comércio local',80):segment[1],city:text(city,100),neighborhood,cityConfirmed:!!t['addr:city'],address:text([street,neighborhood,t['addr:postcode']].filter(Boolean).join(' · '),220),businessPhone,whatsapp:contactDigits(whatsapp)?whatsapp:'',website,instagram,facebook,officialSocials:false,description:text(t.description,1200),openingHours:text(t.opening_hours,240),photoUrl:discoveryURL(t.image||''),sourceUrl:'https://www.openstreetmap.org/'+id,checkedAt,websiteAssessment:website?'found':'not_found',distance:hasPoint?distanceKm(area,{lat,lon}):Number.MAX_SAFE_INTEGER,...(hasPoint?{lat,lon}:{})};
  if(request.require_contact&&!contactDigits(item.businessPhone)&&!contactDigits(item.whatsapp))continue;
  items.push(item);
 }
 return items.sort((a,b)=>Number(!!(contactDigits(b.businessPhone)||b.whatsapp))-Number(!!(contactDigits(a.businessPhone)||a.whatsapp))||a.distance-b.distance||a.name.localeCompare(b.name,'pt-BR')).slice(0,request.limit);
}
export function discoveryQuery(input){
 const r=discoveryArea(input),s=DISCOVERY_SEGMENTS.find(x=>x[0]===input.segment);if(!s)throw Error('Escolha um segmento disponível.');
 const contact=input.require_contact?'[~"^(phone|contact:phone|mobile|contact:mobile|whatsapp|contact:whatsapp)$"~"."]':'';
 const clauses=s[2].map(([k,v])=>`nwr(around:${Math.round(r.radiusKm*1000)},${r.lat},${r.lon})["${k}"${v==='*'?'':`~"^(${v})$"`}]["name"]${contact};`).join('');
 return `[out:json][timeout:18][maxsize:10000000];(${clauses});out center tags 150;`;
}
export const siteAssessmentLabel=item=>item.website?'Site encontrado':item.websiteAssessment==='not_found'?'Site não localizado na fonte':'Site a verificar';
