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
const text=(v,n=200)=>String(v??'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,n);
export function discoveryURL(v){try{const u=new URL(/^https?:\/\//i.test(v||'')?v:'https://'+v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:'';}catch{return '';}}
export function socialURL(v,network){const u=discoveryURL(v);if(!u)return '';const h=new URL(u).hostname.toLowerCase().replace(/^www\./,'');return (network==='instagram'?['instagram.com']:['facebook.com','m.facebook.com','fb.com']).includes(h)&&new URL(u).pathname!=='/'?u:'';}
export function websiteFrom(v){const u=discoveryURL(v);if(!u)return '';const h=new URL(u).hostname.toLowerCase().replace(/^www\./,'');return /(^|\.)(instagram\.com|facebook\.com|fb\.com|wa\.me|whatsapp\.com|google\.com|google\.com\.br|goo\.gl|maps\.app\.goo\.gl|linktr\.ee|tiktok\.com)$/.test(h)?'':u;}
export function contactPhone(v){return text(String(v||'').split(';')[0],40).replace(/[^\d+()\s-]/g,'').trim();}
export function contactDigits(v){let n=String(v||'').replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return /^55\d{10,11}$/.test(n)?n:'';}
export function normalizeOsmResults(payload,request,checkedAt=new Date().toISOString()){
 const region=DISCOVERY_REGIONS.find(x=>x[0]===request.region),segment=DISCOVERY_SEGMENTS.find(x=>x[0]===request.segment);
 if(!region||!segment)return [];
 const seen=new Set(),items=[];
 for(const node of (payload.elements||[]).slice(0,250)){
  const t=node.tags||{},name=text(t.name,120),id=['node','way','relation'].includes(node.type)&&/^\d+$/.test(String(node.id))?`${node.type}/${node.id}`:'';
  if(!name||!id||seen.has(id)||t.disused==='yes'||t.abandoned==='yes')continue;seen.add(id);
  const rawWebsite=t['contact:website']||t.website||'',website=websiteFrom(rawWebsite),instagram=socialURL(t['contact:instagram']||t.instagram||rawWebsite,'instagram'),facebook=socialURL(t['contact:facebook']||t.facebook||rawWebsite,'facebook');
  const businessPhone=contactPhone(t['contact:phone']||t.phone||t['contact:mobile']||t.mobile),whatsapp=contactPhone(t['contact:whatsapp']||t.whatsapp);
  const street=[t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),neighborhood=text(t['addr:suburb']||t['addr:neighbourhood'],100);
  const item={id,provider:'osm',name,sector:segment[0]==='all'?text(typeLabels[t.shop||t.amenity||t.leisure]||'Comércio local',80):segment[1],city:text(t['addr:city']?t['addr:city']+' / PR':region[2],100),neighborhood,cityConfirmed:!!t['addr:city'],address:text([street,neighborhood].filter(Boolean).join(' · '),220),businessPhone,whatsapp:contactDigits(whatsapp)?whatsapp:'',website,instagram,facebook,officialSocials:false,description:'',sourceUrl:'https://www.openstreetmap.org/'+id,checkedAt,websiteAssessment:website?'found':'not_found',distance:Math.hypot((Number(node.lat??node.center?.lat??region[4])-region[4])*111,(Number(node.lon??node.center?.lon??region[5])-region[5])*100)};
  if(request.require_contact&&!contactDigits(item.businessPhone)&&!contactDigits(item.whatsapp))continue;
  items.push(item);
 }
 return items.sort((a,b)=>Number(!!(contactDigits(b.businessPhone)||b.whatsapp))-Number(!!(contactDigits(a.businessPhone)||a.whatsapp))||a.distance-b.distance||a.name.localeCompare(b.name,'pt-BR')).slice(0,request.limit);
}
export function discoveryQuery(input){
 const r=DISCOVERY_REGIONS.find(x=>x[0]===input.region),s=DISCOVERY_SEGMENTS.find(x=>x[0]===input.segment);if(!r||!s)throw Error('Escolha um segmento e uma região disponíveis.');
 const contact=input.require_contact?'[~"^(phone|contact:phone|mobile|contact:mobile|whatsapp|contact:whatsapp)$"~"."]':'';
 const clauses=s[2].map(([k,v])=>`nwr(around:${r[6]},${r[4]},${r[5]})["${k}"${v==='*'?'':`~"^(${v})$"`}]["name"]${contact};`).join('');
 return `[out:json][timeout:18][maxsize:10000000];(${clauses});out center tags 150;`;
}
export const siteAssessmentLabel=item=>item.website?'Site encontrado':item.websiteAssessment==='not_found'?'Site não localizado na fonte':'Site a verificar';
