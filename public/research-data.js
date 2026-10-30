import {plain,safeURL,normalizeKey} from './core.js';
const limited=(v,n=1200)=>plain(v).slice(0,n);
export function normalizeResearch(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const sources=Array.isArray(data.sources)?data.sources.slice(0,20).map(s=>({url:safeURL(s.url),title:limited(s.title,160),kind:['official','social','directory','other'].includes(s.kind)?s.kind:'other',fields:Array.isArray(s.fields)?s.fields.slice(0,20).map(v=>limited(v,80)):[],note:limited(s.note,400)})).filter(s=>s.url):[];
 return {origin:'ai',batchId:limited(data.batchId,80),checkedAt:/^\d{4}-\d{2}-\d{2}T/.test(data.checkedAt||'')?data.checkedAt:'',websiteAssessment:['found','not_found','unknown'].includes(data.websiteAssessment)?data.websiteAssessment:'unknown',confidence:['high','medium','low'].includes(data.confidence)?data.confidence:'low',priority:['high','medium','low'].includes(data.priority)?data.priority:'medium',summary:limited(data.summary,2500),opportunity:limited(data.opportunity,2500),missing:Array.isArray(data.missing)?data.missing.slice(0,20).map(v=>limited(v,200)):[],queries:Array.isArray(data.queries)?data.queries.slice(0,15).map(v=>limited(v,300)):[],sources,media:Array.isArray(data.media)?data.media.slice(0,30).map(m=>({assetId:limited(m.assetId,80),sourceUrl:safeURL(m.sourceUrl),usage:['reference','generated','client_approved'].includes(m.usage)?m.usage:'reference'})):[],aiStatus:['researched','draft_ready','needs_review','qualified','discarded'].includes(data.aiStatus)?data.aiStatus:'researched',reviewNote:limited(data.reviewNote,1500)};
}
const cityKey=value=>normalizeKey(String(value||'').split('/')[0]);
export function isSameBusiness(a,b){
 if(cityKey(a.city)!==cityKey(b.city)||normalizeKey(a.name)!==normalizeKey(b.name))return false;
 if(a.neighborhood&&b.neighborhood&&normalizeKey(a.neighborhood)!==normalizeKey(b.neighborhood))return false;
 if(a.address&&b.address){const na=a.address.match(/\b\d{1,6}\b/),nb=b.address.match(/\b\d{1,6}\b/);if(na&&nb&&na[0]!==nb[0])return false;}
 return true;
}
