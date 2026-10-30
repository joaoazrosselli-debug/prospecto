import {normalizeResearch} from './research-data.js';
import {normalizeOutreach,outreachMessage} from './outreach.js';
export const STAGES=[['novo','Nova oportunidade'],['contato','Em conversa'],['proposta','Proposta enviada'],['fechado','Fechado'],['perdido','Sem interesse']];
export const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const plain=value=>String(value??'').trim();
export function uid(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const values=new Uint32Array(3);crypto.getRandomValues(values);return 'l-'+Array.from(values,x=>x.toString(36)).join('-');}
export const normalizeKey=value=>plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function safeURL(value){try{const text=plain(value);if(!text)return '';const url=new URL(/^https?:\/\//i.test(text)?text:`https://${text}`);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&url.hostname.includes('.')?url.href:'';}catch{return '';}}
export function whatsappNumber(value){let n=String(value??'').replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return /^55\d{10,11}$/.test(n)?n:'';}
export function amount(value){const s=plain(value).replace(/R\$|\s/g,'');const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return Number.isFinite(n)&&n>=0?Math.min(n,1e9):0;}
export function normalizeLead(data,isDemo=false){
 const name=plain(data.name??data.nome??data.empresa).slice(0,120);if(!name)throw Error('Cada empresa precisa ter um nome.');
 const website=safeURL(data.website??data.site);let websiteStatus=['unknown','none','yes'].includes(data.websiteStatus)?data.websiteStatus:(website?'yes':'unknown');
 if(website)websiteStatus='yes';
 const stage=STAGES.some(s=>s[0]===data.stage)?data.stage:'novo';
 const val=amount(data.value??data.valor);const received=Math.min(amount(data.received),val);
 const lead={id:/^[\w-]{1,80}$/.test(data.id||'')?data.id:uid(),name,city:plain(data.city??data.cidade).slice(0,100),sector:plain(data.sector??data.segmento??data.ramo).slice(0,80)||'Comércio local',address:plain(data.address??data.endereco).slice(0,220),phone:plain(data.phone??data.telefone??data.whatsapp).replace(/[^\d+()\s-]/g,'').slice(0,30),website,websiteStatus,source:safeURL(data.source??data.fonte),services:plain(data.services??data.servicos).slice(0,4000),description:plain(data.description??data.descricao).slice(0,5000),notes:plain(data.notes).slice(0,5000),stage,value:val,received,contactAllowed:data.contactAllowed===true,isDemo,createdAt:/^\d{4}-\d{2}-\d{2}T/.test(data.createdAt||'')?data.createdAt:new Date().toISOString()};
 lead.isTest=data.isTest===true;
 lead.archivedAt=/^\d{4}-\d{2}-\d{2}T/.test(data.archivedAt||'')&&!Number.isNaN(Date.parse(data.archivedAt))?data.archivedAt:'';
 lead.email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plain(data.email))?plain(data.email).slice(0,254):'';
 lead.outreach=normalizeOutreach(data.outreach);
 for(const key of ['headline','subtitle','audience','goal','hours','area','about','differentials','faq','cta','neighborhood','brandStyle'])lead[key]=plain(data[key]).slice(0,['about','differentials','faq'].includes(key)?5000:600);
 lead.instagram=safeURL(data.instagram);lead.facebook=safeURL(data.facebook);lead.domain=plain(data.domain).slice(0,200);
 lead.projectType=['landing','catalog','menu'].includes(data.projectType)?data.projectType:'landing';
 lead.pageTemplate=data.pageTemplate==='studio'?'studio':'classic';
 lead.lovablePrompt=String(data.lovablePrompt||'').slice(0,50000);
 lead.lovableProjectUrl=safeURL(data.lovableProjectUrl);lead.externalPreviewUrl=safeURL(data.externalPreviewUrl);lead.externalPreviewReviewed=data.externalPreviewReviewed===true;
 lead.discovery=data.discovery?.provider==='osm'&&/^(node|way|relation)\/\d+$/.test(data.discovery.externalId||'')?{provider:'osm',externalId:data.discovery.externalId,sourceUrl:'https://www.openstreetmap.org/'+data.discovery.externalId,checkedAt:plain(data.discovery.checkedAt).slice(0,40),license:'ODbL-1.0'}:null;
 if(!lead.discovery){const osm=lead.source.match(/^https:\/\/www\.openstreetmap\.org\/((?:node|way|relation)\/\d+)$/);if(osm)lead.discovery={provider:'osm',externalId:osm[1],sourceUrl:lead.source,checkedAt:'',license:'ODbL-1.0'};}
 lead.layout=['editorial','boutique','technical'].includes(data.layout)?data.layout:'editorial';
 lead.palette=/^#[0-9a-f]{6}$/i.test(data.palette||'')?data.palette:'#b6e676';
 lead.productionStatus=['briefing','production','review','approved'].includes(data.productionStatus)?data.productionStatus:'briefing';
 lead.promptOverride=String(data.promptOverride||'').slice(0,50000);lead.customHtml=String(data.customHtml||'').slice(0,250000);
 lead.businessPhone=plain(data.businessPhone).replace(/[^\d+()\s-]/g,'').slice(0,30);lead.research=normalizeResearch(data.research);
 lead.pageScriptsEnabled=data.pageScriptsEnabled===true;lead.publicPrices=data.publicPrices===true;lead.publishReady=data.publishReady===true;
 lead.publicToken=/^[a-f0-9]{32}$/.test(data.publicToken||'')?data.publicToken:'';lead.publicEnabled=data.publicEnabled===true;
 lead.products=Array.isArray(data.products)?data.products.slice(0,30).map(p=>({id:/^[\w-]{1,80}$/.test(p.id||'')?p.id:uid(),title:plain(p.title).slice(0,120),description:plain(p.description).slice(0,600),price:p.price===null||p.price===''||p.price===undefined?null:amount(p.price),priceMode:['fixed','from','quote'].includes(p.priceMode)?p.priceMode:'quote',unit:plain(p.unit).slice(0,60),assetId:/^[\w-]{1,80}$/.test(p.assetId||'')?p.assetId:'',kind:p.kind==='product'?'product':'service'})).filter(p=>p.title):[];
 return lead;
}
export function parseCSV(text){
 if(typeof text!=='string'||text.length>1_500_000)throw Error('Use um arquivo CSV de até 1,5 MB.');
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0];const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length){cell+=c;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('O CSV contém aspas sem fechamento.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('O CSV deve conter um cabeçalho e pelo menos uma empresa.');if(rows.length>501)throw Error('Importe até 500 empresas por arquivo.');
 const keys=rows.shift().map(normalizeKey);if(!keys.some(k=>['nome','name','empresa'].includes(k)))throw Error('Inclua a coluna nome no cabeçalho do CSV.');
 const mapped=rows.map((values,index)=>{const raw={};for(let j=0;j<keys.length;j++){const key=keys[j];if(key==='telefonecomercial')raw.businessPhone=values[j]||'';else if(['nome','name','empresa','cidade','city','segmento','sector','ramo','endereco','address','telefone','phone','whatsapp','site','website','instagram','facebook','fonte','source','servicos','services','descricao','description'].includes(key))raw[key]=values[j]||'';}try{return normalizeLead(raw);}catch(e){throw Error(`Linha ${index+2}: ${e.message}`);}});
 return mapped;
}
export function toCSV(leads){const columns=['nome','cidade','segmento','endereco','whatsapp','telefone_comercial','site','instagram','facebook','fonte','servicos','descricao','licenca'];const fields=['name','city','sector','address','phone','businessPhone','website','instagram','facebook','source','services','description','_license'];const cell=v=>'"'+(/^[=+@\-\t\r]/.test(String(v??''))?"'":'')+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+[columns.join(';'),...leads.map(l=>fields.map(k=>cell(k==='_license'?(l.discovery?.provider==='osm'?'© OpenStreetMap contributors · ODbL-1.0 · https://www.openstreetmap.org/copyright':''):l[k])).join(';'))].join('\r\n');}
export function summarize(leads,expenses=[]){leads=leads.filter(l=>!l.isTest);const proposals=leads.filter(l=>['proposta','fechado'].includes(l.stage));const won=leads.filter(l=>l.stage==='fechado');const contracted=won.reduce((s,l)=>s+amount(l.value),0);const received=leads.reduce((s,l)=>s+amount(l.received),0);const costs=expenses.reduce((s,e)=>s+amount(e.value),0);return {total:leads.filter(l=>!l.archivedAt).length,conversations:leads.filter(l=>!l.archivedAt&&['contato','proposta','fechado'].includes(l.stage)).length,proposals:proposals.length,won:won.length,conversion:proposals.length?won.length/proposals.length*100:0,contracted,received,costs,cash:received-costs};}
export function approach(lead,settings,variant=0){return outreachMessage(lead,settings,variant);}
export {createPrompt,createSite,DEFAULT_PROMPT,checklist} from './landing.js';
