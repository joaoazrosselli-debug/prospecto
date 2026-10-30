import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {parse} from 'parse5';
import {StudioFailure,type StudioAccess} from './studio-auth';
import {saveRecord,unpackRecord,type StudioRow} from './studio-records';
import {isSameBusiness} from '../public/research-data.js';
import {DISCOVERY_REGIONS,DISCOVERY_SEGMENTS,discoveryQuery,discoveryArea,normalizeOsmResults,normalizeLocationResults,contactDigits,contactPhone,discoveryURL,socialURL,BRAZIL_BOUNDS} from '../public/discovery-data.js';

const centerSchema=z.object({lat:z.number().finite().min(BRAZIL_BOUNDS.south).max(BRAZIL_BOUNDS.north),lon:z.number().finite().min(BRAZIL_BOUNDS.west).max(BRAZIL_BOUNDS.east),label:z.string().trim().max(180).default('Ponto escolhido no mapa'),city:z.string().trim().max(100).default(''),state:z.string().trim().max(40).default(''),neighborhood:z.string().trim().max(100).default('')}).strict();
export const searchBusinessSchema=z.object({segment:z.enum(DISCOVERY_SEGMENTS.map(x=>x[0]) as [string,...string[]]),region:z.enum(['map',...DISCOVERY_REGIONS.map(x=>String(x[0]))] as [string,...string[]]),center:centerSchema.optional(),radius_km:z.number().finite().min(.5).max(20).optional(),limit:z.number().int().min(1).max(50).default(10),require_contact:z.boolean().default(true)}).strict().superRefine((input,ctx)=>{if(input.region==='map'&&!input.center)ctx.addIssue({code:'custom',message:'Escolha o centro da pesquisa.'});if(input.region!=='map'&&input.center)ctx.addIssue({code:'custom',message:'Use a região do mapa para um centro personalizado.'});});
const locationSchema=z.object({query:z.string().trim().min(3).max(160)}).strict();
const selectSchema=z.object({batch_id:z.string().uuid(),item_id:z.string().regex(/^(node|way|relation)\/\d+$/)}).strict();
type Candidate={id:string;provider:string;name:string;sector:string;city:string;neighborhood:string;address:string;businessPhone:string;whatsapp:string;website:string;instagram:string;facebook:string;officialSocials:boolean;description:string;sourceUrl:string;checkedAt:string;websiteAssessment:string;lat?:number;lon?:number;openingHours?:string;photoUrl?:string;cityConfirmed?:boolean;officialCheckedAt?:string;officialFields?:string[];enrichmentNote?:string};
type Batch={id:string;query:string;results:string;created_at:string;expires_at:string};
const sourceEndpoint='https://overpass.private.coffee/api/interpreter';
const runtime=env as unknown as {GOOGLE_PLACES_API_KEY?:string;PROSPECTO_GEOCODER_URL?:string};

export function discoveryStatus(){return {search:{provider:'osm',configured:true,requiresKey:false,country:'BR',regions:DISCOVERY_REGIONS.map(x=>({id:x[0],label:x[1],radiusMeters:x[6]})),maxResults:50,minRadiusKm:.5,maxRadiusKm:20,dailyLimit:40},map:{provider:'openfreemap',data:'openstreetmap',engine:'openlayers',interactive:true},geocoding:{provider:'photon',manualOnly:true,dailyLimit:100},google:{configured:!!runtime.GOOGLE_PLACES_API_KEY,mode:'live_only',dailyLimit:20},lovable:{configured:true,mode:'prefilled_link',accountConnected:false},sending:{connected:false}};}
async function quota(access:StudioAccess,action:string,seconds:number,maximum:number){
 const now=Date.now(),period=Math.floor(now/(seconds*1000)),key=`${action}:${period}`;
 const row=await access.db.prepare('INSERT INTO studio_discovery_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(key,new Date((period+2)*seconds*1000).toISOString(),maximum).first();
 if(!row)throw new StudioFailure(429,'Limite de consultas atingido. Aguarde antes de pesquisar novamente.',{retryAfter:Math.ceil(((period+1)*seconds*1000-now)/1000)});
}
async function responseJSON(response:Response,maximum=2_000_000){
 if(!response.ok)throw new StudioFailure(response.status===429?429:502,response.status===429?'O serviço de pesquisa pediu uma pausa. Tente novamente em alguns minutos.':'O serviço de pesquisa está indisponível. Seus cadastros foram preservados.');
 if(!response.body)throw new StudioFailure(502,'A pesquisa voltou sem conteúdo.');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maximum){await reader.cancel();throw new StudioFailure(502,'A resposta da pesquisa ultrapassou o limite. Reduza a região ou escolha um segmento.');}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new StudioFailure(502,'O serviço devolveu uma resposta inválida. Tente novamente mais tarde.');}
}
async function existingRecords(access:StudioAccess){return (await access.db.prepare("SELECT * FROM studio_records WHERE kind='lead'").all<StudioRow>()).results.map(unpackRecord);}
export async function locateDiscoveryArea(access:StudioAccess,raw:unknown){
 const {query}=locationSchema.parse(raw),key=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' '),now=new Date().toISOString();
 const cached=await access.db.prepare('SELECT data FROM studio_discovery_locations WHERE query=? AND expires_at>?').bind(key,now).first<{data:string}>();
 if(cached)return {items:JSON.parse(cached.data),cached:true,provider:'photon'};
 await quota(access,'location:short',5,1);await quota(access,'location:day',86400,100);
 const endpoint=new URL(runtime.PROSPECTO_GEOCODER_URL||'https://photon.komoot.io/api/');
 if(!officialSiteAllowed(endpoint.href)||endpoint.protocol!=='https:')throw new StudioFailure(503,'O serviço de localização precisa ser configurado com um endereço HTTPS válido.');
 endpoint.searchParams.set('q',query);endpoint.searchParams.set('limit','10');endpoint.searchParams.set('bbox','-74,-34,-28,6');
 let payload;
 try{payload=await responseJSON(await fetch(endpoint.href,{headers:{Accept:'application/json','User-Agent':'Prospecto/1.0 (+https://prospecto.example)'},signal:AbortSignal.timeout(12000),redirect:'manual'}),300_000);}
 catch(error){if(error instanceof StudioFailure)throw error;throw new StudioFailure(502,'A localização não respondeu a tempo. Você pode escolher o ponto diretamente no mapa.');}
 if(!Array.isArray(payload.features))throw new StudioFailure(502,'O serviço de localização devolveu uma resposta inválida. Escolha o ponto no mapa ou tente novamente.');
 const items=normalizeLocationResults(payload,query);
 await access.db.batch([access.db.prepare('DELETE FROM studio_discovery_locations WHERE expires_at<?').bind(now),access.db.prepare('INSERT INTO studio_discovery_locations(query,data,expires_at) VALUES(?,?,?) ON CONFLICT(query) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').bind(key,JSON.stringify(items),new Date(Date.now()+7*86400_000).toISOString())]);
 return {items,cached:false,provider:'photon'};
}
async function decorate(access:StudioAccess,items:Candidate[]){const existing=await existingRecords(access);return items.map(item=>{const match=existing.find(l=>l.discovery?.externalId===item.id||isSameBusiness(l,item));return {...item,existingLeadId:match?.id||'',existingArchived:!!match?.archivedAt};});}
export async function searchBusinesses(access:StudioAccess,raw:unknown){
 const input=searchBusinessSchema.parse(raw),area=discoveryArea(input),query=JSON.stringify(input),now=new Date().toISOString();
 const cached=await access.db.prepare('SELECT * FROM studio_discovery_batches WHERE query=? AND created_at>? AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(query,new Date(Date.now()-15*60_000).toISOString(),now).first<Batch>();
 if(cached)return {batchId:cached.id,provider:'osm',cached:true,checkedAt:cached.created_at,items:await decorate(access,JSON.parse(cached.results)),request:input,area,googleConnected:!!runtime.GOOGLE_PLACES_API_KEY};
 await quota(access,'search:short',15,1);await quota(access,'search:day',86400,40);
 let payload;
 try{payload=await responseJSON(await fetch(sourceEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Prospecto/1.0 (+https://prospecto.example)'},body:new URLSearchParams({data:discoveryQuery(input)}),signal:AbortSignal.timeout(25000),redirect:'manual'}));}
 catch(error){if(error instanceof StudioFailure)throw error;throw new StudioFailure(502,'A fonte de empresas não respondeu a tempo. Aguarde e tente novamente; a base não foi alterada.');}
 if(payload.remark||!Array.isArray(payload.elements))throw new StudioFailure(502,'A fonte não concluiu a consulta. Escolha uma região menor ou tente mais tarde.');
 const items=normalizeOsmResults(payload,input,now) as Candidate[],id=crypto.randomUUID();
 await access.db.batch([
  access.db.prepare('DELETE FROM studio_discovery_batches WHERE expires_at<?').bind(now),
  access.db.prepare('DELETE FROM studio_discovery_limits WHERE expires_at<?').bind(now),
  access.db.prepare('INSERT INTO studio_discovery_batches(id,query,results,created_at,expires_at) VALUES(?,?,?,?,?)').bind(id,query,JSON.stringify(items),now,new Date(Date.now()+86400_000).toISOString()),
 ]);
 return {batchId:id,provider:'osm',cached:false,checkedAt:now,items:await decorate(access,items),request:input,area,googleConnected:!!runtime.GOOGLE_PLACES_API_KEY};
}
async function selected(access:StudioAccess,raw:unknown){
 const input=selectSchema.parse(raw),batch=await access.db.prepare('SELECT * FROM studio_discovery_batches WHERE id=? AND expires_at>?').bind(input.batch_id,new Date().toISOString()).first<Batch>();
 if(!batch)throw new StudioFailure(410,'Esta pesquisa expirou. Faça uma nova busca antes de usar os dados.');
 const items:Candidate[]=JSON.parse(batch.results),item=items.find(i=>i.id===input.item_id);if(!item)throw new StudioFailure(404,'Empresa não encontrada neste lote.');return {batch,items,item};
}
export function officialSiteAllowed(value:string){
 try{const u=new URL(value),h=u.hostname.toLowerCase();return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&(!u.port||['80','443'].includes(u.port))&&h.includes('.')&&!/^[\d.]+$/.test(h)&&!h.includes(':')&&!/(^|\.)(local|localhost|internal|lan|test|invalid)$/.test(h)&&!['metadata.google.internal','host.docker.internal'].includes(h);}catch{return false;}
}
export function extractOfficialContacts(html:string,base:string){
 const document=parse(html),result={instagram:'',facebook:'',whatsapp:'',businessPhone:'',description:''};
 const visit=(node:any)=>{
  const attrs=Object.fromEntries((node.attrs||[]).map((a:any)=>[a.name,a.value]));
  if(node.tagName==='meta'&&attrs.name?.toLowerCase()==='description')result.description=String(attrs.content||'').replace(/\s+/g,' ').trim().slice(0,1200);
  if(node.tagName==='a'&&attrs.href){
   const href=String(attrs.href).trim();
   if(/^tel:/i.test(href)&&contactDigits(href))result.businessPhone=result.businessPhone||contactPhone(href);
   try{const u=new URL(href,base),h=u.hostname.toLowerCase().replace(/^www\./,'');
    if(!/(share|sharer|intent|dialog|login|accounts)/i.test(u.pathname)){
     result.instagram=result.instagram||socialURL(u.href,'instagram');result.facebook=result.facebook||socialURL(u.href,'facebook');
    }
    const phone=h==='wa.me'?u.pathname.slice(1):['api.whatsapp.com','web.whatsapp.com'].includes(h)&&u.pathname==='/send'?u.searchParams.get('phone'):'';
    if(contactDigits(phone))result.whatsapp=result.whatsapp||contactPhone(phone);
   }catch{}
  }
  for(const child of node.childNodes||[])visit(child);
 };visit(document);return result;
}
export async function enrichBusiness(access:StudioAccess,raw:unknown){
 const {batch,items,item}=await selected(access,raw);if(!item.website)throw new StudioFailure(400,'Esta fonte não informou um site próprio. Revise os outros canais antes de completar a ficha.');
 if(item.officialCheckedAt&&Date.now()-Date.parse(item.officialCheckedAt)<900_000)return {item};
 await quota(access,'enrich:short',3,1);await quota(access,'enrich:day',86400,60);
 let url=item.website,html='';
 try{for(let hop=0;hop<3;hop++){
  if(!officialSiteAllowed(url))throw new StudioFailure(400,'O endereço informado não pode ser consultado automaticamente.');
  const response=await fetch(url,{headers:{Accept:'text/html','User-Agent':'Prospecto/1.0 (+https://prospecto.example)'},redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)break;url=new URL(location,url).href;continue;}
  if(!response.ok||!response.body||!response.headers.get('content-type')?.includes('text/html'))break;
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0;
  for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>700_000){await reader.cancel();break;}html+=decoder.decode(p.value,{stream:true});}break;
 }}catch(error){if(error instanceof StudioFailure)throw error;throw new StudioFailure(502,'Não foi possível consultar o site agora. Os dados anteriores continuam disponíveis.');}
 if(!html)throw new StudioFailure(502,'O site não disponibilizou uma página legível para consulta. Confira o endereço manualmente.');
 const found=extractOfficialContacts(html,url),now=new Date().toISOString();
 Object.assign(item,{...Object.fromEntries(Object.entries(found).filter(([,v])=>!!v)),officialSocials:!!(found.instagram||found.facebook),officialFields:Object.keys(found).filter(k=>!!found[k as keyof typeof found]),officialCheckedAt:now,enrichmentNote:'Links extraídos do site informado. Confira se o site pertence à empresa antes de apresentar a proposta.'});
 // Only the selected item is changed; concurrent updates to other candidates survive.
 for(let n=0;n<3;n++){
  const current=await access.db.prepare('SELECT results FROM studio_discovery_batches WHERE id=?').bind(batch.id).first<{results:string}>();if(!current)throw new StudioFailure(410,'A pesquisa expirou.');
  const merged:Candidate[]=JSON.parse(current.results),index=merged.findIndex(x=>x.id===item.id);if(index<0)throw new StudioFailure(410,'A empresa saiu desta pesquisa.');merged[index]=item;
  const saved=await access.db.prepare('UPDATE studio_discovery_batches SET results=? WHERE id=? AND results=?').bind(JSON.stringify(merged),batch.id,current.results).run();if(saved.meta.changes)return {item};
 }
 throw new StudioFailure(409,'Outra pessoa atualizou esta pesquisa. Abra a empresa novamente.');
}
export async function importDiscoveredBusiness(access:StudioAccess,raw:unknown){
 const {item,batch}=await selected(access,raw),existing=await existingRecords(access),match=existing.find(l=>l.discovery?.externalId===item.id||isSameBusiness(l,item));
 if(match)return {created:false,matchedExisting:true,archived:!!match.archivedAt,lead:{id:match.id,name:match.name}};
 const id='osm-'+item.id.replace('/','-'),now=new Date().toISOString();
 const sources=[{url:item.sourceUrl,title:'OpenStreetMap · '+item.name,kind:'directory',fields:['name','sector',...(item.address?['address']:[]),...(item.businessPhone?['businessPhone']:[]),...(item.whatsapp?['whatsapp']:[]),...(item.website?['website']:[])],note:'© OpenStreetMap contributors · ODbL. Informações comunitárias, sujeitas a revisão.'}];
 if(item.officialCheckedAt)sources.push({url:item.website,title:'Site informado da empresa',kind:'official',fields:item.officialFields||[],note:item.enrichmentNote||''});
 if(item.photoUrl)sources.push({url:item.photoUrl,title:'Foto indicada no mapa · conferir autoria e permissão',kind:'directory',fields:[],note:'Referência de mídia; não foi baixada nem anexada à página.'});
 const changes={name:item.name,source:item.sourceUrl,sector:item.sector,city:item.city,neighborhood:item.neighborhood,address:item.address,businessPhone:item.businessPhone,phone:item.whatsapp,website:item.website,instagram:item.instagram,facebook:item.facebook,description:item.description,hours:item.openingHours||'',websiteStatus:item.website?'yes':'unknown',pageTemplate:'studio',projectType:'landing',stage:'novo',value:0,received:0,publicEnabled:false,publishReady:false,contactAllowed:false,productionStatus:'briefing',discovery:{provider:'osm',externalId:item.id,sourceUrl:item.sourceUrl,checkedAt:item.checkedAt,license:'ODbL-1.0',...(typeof item.lat==='number'&&typeof item.lon==='number'?{lat:item.lat,lon:item.lon}:{})},research:{origin:'ai',batchId:batch.id,checkedAt:now,websiteAssessment:item.website?'found':'not_found',confidence:'medium',priority:'medium',summary:'Informações comerciais consultadas no OpenStreetMap'+(item.officialCheckedAt?' e no site informado.':'.'),opportunity:item.website?'Avaliar se a página existente atende bem ao negócio.':'Avaliar uma página própria após confirmar a situação do site.',missing:['Confirmar os dados com a empresa.','Confirmar serviços, materiais e objetivo da página.',...(!item.cityConfirmed?['Confirmar a cidade exata: a localização foi sugerida pela região da busca.']:[]),...(!item.website?['Ausência de site ainda não confirmada.']:[]),...(!item.whatsapp?['Confirmar se existe um WhatsApp comercial.']:[])],queries:[`${item.sector} · ${item.city} · ${item.neighborhood}`],sources,aiStatus:'needs_review'}};
 try{const lead=await saveRecord(access,'lead',id,{},changes);return {created:true,matchedExisting:false,archived:false,lead:{id:lead.id,name:lead.name}};}
 catch(error){if(error instanceof StudioFailure&&error.status===409){const current=await access.db.prepare("SELECT data FROM studio_records WHERE key=?").bind('lead:'+id).first<{data:string}>();if(current){const lead=JSON.parse(current.data);return {created:false,matchedExisting:true,archived:!!lead.archivedAt,lead:{id:lead.id,name:lead.name}};}}throw error;}
}
export async function googleBusinessRating(access:StudioAccess,raw:unknown){
 const {batch_id,item_id}=selectSchema.parse(raw);if(!runtime.GOOGLE_PLACES_API_KEY)throw new StudioFailure(503,'A consulta de avaliações do Google ainda precisa da chave da Places API na hospedagem.',{code:'google_not_configured'});
 const {item}=await selected(access,{batch_id,item_id});await quota(access,'google:short',5,1);await quota(access,'google:day',86400,20);
 let payload;
 try{payload=await responseJSON(await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':runtime.GOOGLE_PLACES_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.attributions'},body:JSON.stringify({textQuery:[item.name,item.address,item.city].filter(Boolean).join(' '),pageSize:3,languageCode:'pt-BR',regionCode:'BR'}),signal:AbortSignal.timeout(12000),redirect:'manual'}),300_000);}
 catch(error){if(error instanceof StudioFailure)throw error;throw new StudioFailure(502,'Não foi possível consultar as avaliações agora.');}
 // Google content is returned live only. It is never stored in batches, CRM, exports or prompts.
 return {provider:'google',transient:true,checkedAt:new Date().toISOString(),matches:(payload.places||[]).slice(0,3).map((p:any)=>({name:p.displayName?.text||'',address:p.formattedAddress||'',rating:typeof p.rating==='number'?p.rating:null,count:typeof p.userRatingCount==='number'?p.userRatingCount:0,mapsUrl:discoveryURL(p.googleMapsUri),attributions:(p.attributions||[]).map((a:any)=>({provider:String(a.provider||''),url:discoveryURL(a.providerUri)}))}))};
}
