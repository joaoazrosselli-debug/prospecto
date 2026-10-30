import pilot from '../data/pilot-curitiba.json';
import {normalizeLead} from '../public/core.js';
import {createSite} from '../public/landing.js';
import {isSameBusiness} from '../public/research-data.js';
import type {StudioAccess} from './studio-auth';

export const PILOT_ID=pilot.id;
const drawings:Record<string,string>={
 laundry:'<rect x="92" y="47" width="216" height="268" rx="26"/><path d="M92 104h216"/><circle cx="128" cy="77" r="8"/><circle cx="158" cy="77" r="8"/><path d="M222 77h54"/><circle cx="200" cy="208" r="72"/><circle cx="200" cy="208" r="54"/><path d="M150 215q25-22 50 0t50 0M65 339h270M53 163q-25 24 0 48M347 128q-25 24 0 48"/>',
 pet:'<path d="M113 174q-34-46-32-83 58-4 89 48m64 0q31-52 89-48 2 37-32 83M117 160q83-58 166 0l15 94q-19 65-98 65t-98-65Z"/><circle cx="156" cy="216" r="7"/><circle cx="244" cy="216" r="7"/><path d="m186 245 14 12 14-12M200 257v22m-29-1q29 28 58 0M65 342h270"/><path d="M176 68q24-34 48 0"/>',
 sewing:'<circle cx="126" cy="230" r="66"/><circle cx="105" cy="209" r="8"/><circle cx="147" cy="209" r="8"/><circle cx="105" cy="251" r="8"/><circle cx="147" cy="251" r="8"/><path d="m227 295 55-210q9-28 20-25 12 4 6 32l-65 208-16 30Z"/><path d="m288 88 8-21M294 61q-82-67-86 18t-52 72M160 309q64 49 136 8M59 345h282"/>',
};
export function pilotHtml(lead:any,kind:string){
 let html=createSite(lead);
 const visual=`<div class="hero-visual pilot-concept"><span class="concept-eyebrow">PROPOSTA DE IDENTIDADE</span><svg viewBox="0 0 400 390" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ilustração conceitual de ${kind==='laundry'?'lavanderia':kind==='pet'?'cuidados de pets':'costura'}"><g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${drawings[kind]||drawings.laundry}</g></svg><span class="concept-caption">Ilustração conceitual · materiais oficiais pendentes</span></div>`;
 html=html.replace(/<div class="type-art">[\s\S]*?<\/div><\/section>/,visual+'</section>');
 html=html.replace('</style>',`.hero>*{min-width:0}.pilot-concept{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:28px;color:var(--ink);display:flex;align-items:center;justify-content:center;flex-direction:column;min-height:440px}.pilot-concept svg{display:block;max-width:100%;width:min(100%,360px);height:340px;color:var(--ink);background:color-mix(in srgb,var(--accent) 25%,transparent);border-radius:50%;padding:20px;margin:12px 0 20px}.concept-eyebrow{font-size:10px;font-weight:700;letter-spacing:.17em;color:var(--muted)}.concept-caption{font-size:10px;color:var(--muted);text-align:center}.brand{font-size:18px}.hero h1{font-size:clamp(38px,4.8vw,66px)}@media(max-width:620px){.pilot-concept{min-height:330px;padding:22px}.pilot-concept svg{height:250px;width:min(100%,280px)}.hero h1{font-size:clamp(38px,10vw,52px)}}`+'</style>');
 return html.replace('Prévia para revisão · informações e materiais sujeitos à aprovação do responsável.','Proposta visual para avaliação · conteúdo e materiais ainda precisam de aprovação da empresa.');
}
export async function pilotStatus(access:StudioAccess){
 const row=await access.db.prepare('SELECT data FROM studio_records WHERE key=?').bind('pilot:'+PILOT_ID).first<{data:string}>();
 return row?JSON.parse(row.data):{id:PILOT_ID,status:'prepared',prepared:pilot.items.length,drafts:pilot.items.filter((i:any)=>i.draft).length};
}
export async function applyPreparedPilot(access:StudioAccess){
 if(!access.isOwner)throw Error('Somente o administrador pode incorporar o piloto.');
 const status=await pilotStatus(access);if(status.status==='applied')return status;
 const existing=await access.db.prepare("SELECT json_extract(data,'$.name') AS name,json_extract(data,'$.city') AS city,json_extract(data,'$.neighborhood') AS neighborhood,json_extract(data,'$.address') AS address FROM studio_records WHERE kind='lead'").all();
 const now=new Date().toISOString(),statements=[];let draftsPrepared=0,skipped=0;
 for(const item of pilot.items as any[]){
  if(existing.results.some(r=>isSameBusiness(r,item.lead))){skipped++;continue;}
  const raw={...item.lead,stage:'novo',value:0,received:0,publicEnabled:false,publishReady:false,contactAllowed:false,publicPrices:false,createdAt:now};
  if(item.draft){const {kind,...content}=item.draft;Object.assign(raw,content,{productionStatus:'review',research:{...raw.research,aiStatus:'draft_ready'}});raw.customHtml=pilotHtml(normalizeLead(raw),kind);draftsPrepared++;}
  const data=normalizeLead(raw);
  statements.push(access.db.prepare('INSERT OR IGNORE INTO studio_records(key,kind,data,revision,updated_at,updated_by) VALUES(?,?,?,1,?,?)').bind('lead:'+data.id,'lead',JSON.stringify(data),now,access.user.userId));
 }
 const result={id:PILOT_ID,status:'applied',created:statements.length,skipped,drafts:draftsPrepared,researchedAt:pilot.researchedAt,appliedAt:now};
 statements.push(access.db.prepare('INSERT OR IGNORE INTO studio_records(key,kind,data,revision,updated_at,updated_by) VALUES(?,?,?,1,?,?)').bind('pilot:'+PILOT_ID,'pilot',JSON.stringify(result),now,access.user.userId));
 // Schema-only migrations stay immutable; this authorized one-time data import is atomic.
 await access.db.batch(statements);return pilotStatus(access);
}
