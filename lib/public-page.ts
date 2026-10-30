import {env} from 'cloudflare:workers';
import {createSite} from '../public/landing.js';
import {pageCSP} from '../public/source-code.js';
const notFound=()=>new Response('Esta apresentação não está disponível.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
export async function handlePublic(request:Request){
 const path=new URL(request.url).pathname.split('/').filter(Boolean),token=path[1];
 if(!/^[a-f0-9]{32}$/.test(token||'')||!env.DB||!env.BUCKET)return notFound();
 const row=await env.DB.prepare("SELECT data FROM studio_records WHERE kind='lead' AND json_extract(data,'$.publicToken')=? AND json_extract(data,'$.publicEnabled')=1 LIMIT 1").bind(token).first<{data:string}>();
 if(!row)return notFound();
 const lead=JSON.parse(row.data);
 if(lead.isTest||lead.archivedAt)return notFound();
 if(path[2]==='media'&&/^[\w-]{1,80}$/.test(path[3]||'')&&path.length===4){
  const file=await env.DB.prepare('SELECT object_key,mime FROM studio_assets WHERE id=? AND lead_id=?').bind(path[3],lead.id).first<{object_key:string;mime:string}>();
  if(!file)return notFound();
  const object=await env.BUCKET.get(file.object_key,{range:request.headers});if(!object)return notFound();
  const headers=new Headers({'Content-Type':file.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});let status=200;
  if(request.headers.has('range')&&object.range&&'offset' in object.range&&object.range.offset!==undefined){const start=object.range.offset,length=object.range.length??object.size-start;headers.set('Content-Range',`bytes ${start}-${start+length-1}/${object.size}`);headers.set('Content-Length',String(length));status=206;}else headers.set('Content-Length',String(object.size));
  return new Response(request.method==='HEAD'?null:object.body,{status,headers});
 }
 if(path.length!==2)return notFound();
 const files=await env.DB.prepare('SELECT id,name,mime,role,alt FROM studio_assets WHERE lead_id=? ORDER BY created_at').bind(lead.id).all();
 lead.assets=files.results.map(a=>({...a,url:`/p/${token}/media/${a.id}`}));
 const html=createSite(lead);
 // CSP sandbox gives opted-in client scripts an opaque origin, never dashboard access.
 return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':lead.publishReady?'noarchive':'noindex, nofollow','Content-Security-Policy':pageCSP(!!lead.pageScriptsEnabled,{publicPage:true})}});
}
