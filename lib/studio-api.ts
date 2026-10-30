import {env} from 'cloudflare:workers';
import {requireStudio,StudioFailure} from './studio-auth';
import {saveRecord} from './studio-records';
import {getCode,saveCode,applyCode,listCodeHistory,getCodeVersion} from './studio-code';
import {getProduction,saveDeliveryReview} from './studio-production';
import {createTestBusiness} from './test-business';
import {getOutreach} from './studio-outreach';
import {discoveryStatus,locateDiscoveryArea,searchBusinesses,enrichBusiness,importDiscoveredBusiness,googleBusinessRating} from './studio-discovery';
import {applyPreparedPilot,pilotStatus,PILOT_ID} from './pilot';
import {cleanRecord,changedConflicts,DEFAULT_SETTINGS,validId,sniffMedia} from './studio-validation.js';
type Row={key:string;kind:string;data:string;revision:number;updated_at:string;updated_by:string};
type Asset={id:string;lead_id:string;object_key:string;name:string;mime:string;size:number;role:string;alt:string;created_at:string};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
const unpack=(r:Row)=>({...JSON.parse(r.data),_revision:r.revision,_updatedAt:r.updated_at});
const assetInfo=(r:Asset)=>({id:r.id,leadId:r.lead_id,name:r.name,mime:r.mime,size:r.size,role:r.role,alt:r.alt,createdAt:r.created_at,url:`/api/files/${r.id}`});
async function readJSON(request:Request){
  if(Number(request.headers.get('content-length')||0)>1_200_000)throw Error('Conteúdo muito grande.');
  const value=await request.text();if(value.length>1_200_000)throw Error('Conteúdo muito grande.');return JSON.parse(value);
}
export async function handleStudio(request:Request){
 try{
  const access=await requireStudio();
  const {user,db,bucket,isOwner,ownerEmail}=access;
  const path=new URL(request.url).pathname.replace(/^\/api\//,'').split('/');
  const now=new Date().toISOString();
  if(!['GET','HEAD'].includes(request.method)){
   const origin=request.headers.get('origin');
   if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
   if(request.headers.get('x-prospecto-request')!=='1')return json({error:'Requisição inválida.'},403);
  }
  if(path[0]==='production'){
   if(request.method==='GET'&&path.length===2)return json(await getProduction(access,path[1],new URL(request.url).searchParams.get('scope')||undefined));
   if(request.method==='POST'&&path[2]==='review'&&path.length===3)return json(await saveDeliveryReview(access,path[1],await readJSON(request)));
   return json({error:'Recurso de produção não encontrado.'},404);
  }
  if(path[0]==='outreach'&&path.length===1&&request.method==='GET')return json(await getOutreach(access));
  if(path[0]==='discovery'){
   if(path[1]==='status'&&path.length===2&&request.method==='GET')return json(discoveryStatus());
   if(path.length===2&&request.method==='POST'){
    const body=await readJSON(request);
    if(path[1]==='locate')return json(await locateDiscoveryArea(access,body));
    if(path[1]==='search')return json(await searchBusinesses(access,body));
    if(path[1]==='enrich')return json(await enrichBusiness(access,body));
    if(path[1]==='import')return json(await importDiscoveredBusiness(access,body));
    if(path[1]==='google')return json(await googleBusinessRating(access,body));
   }
   return json({error:'Recurso de pesquisa não encontrado.'},404);
  }
  if(path[0]==='ai'&&path[1]==='test-store'&&path.length===2&&request.method==='POST')return json(await createTestBusiness(access,await readJSON(request)));
  if(path[0]==='code'){
   const id=path[1];
   if(request.method==='GET'&&path.length===2)return json(await getCode(access,id));
   if(request.method==='GET'&&path[2]==='history'&&path.length===3)return json(await listCodeHistory(access,id,Number(new URL(request.url).searchParams.get('before')||0)));
   if(request.method==='GET'&&path[2]==='versions'&&path.length===4)return json(await getCodeVersion(access,id,path[3]));
   if(request.method==='POST'&&path.length===2)return json(await saveCode(access,id,await readJSON(request)));
   if(request.method==='POST'&&path[2]==='apply'&&path.length===3)return json(await applyCode(access,id,await readJSON(request)));
   return json({error:'Recurso de código não encontrado.'},404);
  }
  if(path[0]==='bootstrap'&&request.method==='GET'){
   if(isOwner&&env.PROSPECTO_PILOT_BATCH===PILOT_ID)await applyPreparedPilot(access);
   const [recordsResult,filesResult,memberResult]=await Promise.all([
    db.prepare('SELECT * FROM studio_records ORDER BY updated_at').all<Row>(),
    db.prepare('SELECT * FROM studio_assets ORDER BY created_at').all<Asset>(),
    db.prepare('SELECT id,name,email,last_seen FROM studio_members ORDER BY last_seen DESC').all(),
   ]);
   await db.prepare('INSERT INTO studio_members(id,name,email,last_seen) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,last_seen=excluded.last_seen').bind(user.userId,user.displayName,user.email,now).run();
   const rows=recordsResult.results||[],files=(filesResult.results||[]).map(assetInfo),settingsRow=rows.find(r=>r.kind==='settings');
   const accessResult=isOwner?await db.prepare('SELECT email,created_at FROM studio_access ORDER BY created_at').all():null;
   return json({user:{id:user.userId,name:user.displayName,email:user.email,isOwner},settings:settingsRow?unpack(settingsRow):{...DEFAULT_SETTINGS,_revision:0},leads:rows.filter(r=>r.kind==='lead').map(r=>({...unpack(r),assets:files.filter(f=>f.leadId===r.key.slice(5))})),expenses:rows.filter(r=>r.kind==='expense').map(unpack),members:memberResult.results||[],access:accessResult?.results||[],storage:{database:true,files:true},discovery:discoveryStatus(),agent:{bridgeReady:true,mode:'chat_mcp',paidApiConnected:false,pilot:await pilotStatus(access)},serverTime:now});
  }
  if(path[0]==='ai'&&path[1]==='pilot'&&request.method==='POST'){
   if(!isOwner)return json({error:'Somente o administrador pode incorporar o piloto.'},403);
   return json({pilot:await applyPreparedPilot(access)});
  }
  if(path[0]==='team'&&request.method==='POST'){
   if(!isOwner)return json({error:'Somente o administrador pode gerenciar o acesso.'},403);
   const body=await readJSON(request),email=String(body.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:'Informe um e-mail válido.'},400);
   if(email===ownerEmail)return json({error:'O administrador já tem acesso permanente.'},400);
   if(body.action==='remove')await db.prepare('DELETE FROM studio_access WHERE email=?').bind(email).run();
   else if(body.action==='add'){
    const count=await db.prepare('SELECT COUNT(*) AS count FROM studio_access').first<{count:number}>();
    if((count?.count||0)>=20)return json({error:'Este espaço aceita até 20 pessoas autorizadas.'},400);
    await db.prepare('INSERT OR IGNORE INTO studio_access(email,created_at,created_by) VALUES(?,?,?)').bind(email,now,user.userId).run();
   }else return json({error:'Ação inválida.'},400);
   return json({ok:true,access:(await db.prepare('SELECT email,created_at FROM studio_access ORDER BY created_at').all()).results});
  }
  if(path[0]==='records'&&request.method==='POST'){
   const {kind,id,base={},changes={}}=await readJSON(request);
   if(!['lead','expense','settings'].includes(kind)||!validId(id)||!base||typeof base!=='object'||Array.isArray(base)||!changes||typeof changes!=='object'||Array.isArray(changes))return json({error:'Registro inválido.'},400);
   return json({record:await saveRecord(access,kind,id,base,changes)});
  }
  if(path[0]==='assets'&&request.method==='POST'){
   if(Number(request.headers.get('content-length')||0)>22_000_000)return json({error:'Envie arquivos de até 20 MB.'},413);
   const form=await request.formData(),leadId=String(form.get('leadId')||'');
   if(!validId(leadId)||!await db.prepare('SELECT key FROM studio_records WHERE key=?').bind(`lead:${leadId}`).first())return json({error:'Salve a empresa antes de anexar arquivos.'},400);
   const file=form.get('file');
   if(!file||typeof file==='string')return json({error:'Escolha um arquivo.'},400);
   if(file.size>20_000_000)return json({error:'O vídeo deve ter até 20 MB.'},413);
   const format=sniffMedia(new Uint8Array(await file.slice(0,24).arrayBuffer()));
   if(!format)return json({error:'Use PNG, JPG, WebP, MP4 ou WebM. Exporte logos vetoriais em PNG.'},400);
   if(format.mime.startsWith('image/')&&file.size>6_000_000)return json({error:'A imagem deve ter até 6 MB.'},413);
   const totals=await db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS bytes FROM studio_assets WHERE lead_id=?').bind(leadId).first<{count:number;bytes:number}>();
   if((totals?.count||0)>=30||(totals?.bytes||0)+file.size>100_000_000)return json({error:'Limite por cliente: 30 arquivos ou 100 MB. Remova materiais que não serão usados.'},400);
   const id=crypto.randomUUID(),key=`clients/${leadId}/${id}.${format.ext}`;
   const role=format.mime.startsWith('video/')?'video':(['logo','hero','banner','gallery','product'].includes(String(form.get('role')))?String(form.get('role')):'gallery');
   const name=file.name.replace(/[\x00-\x1f<>]/g,'').slice(0,180)||`arquivo.${format.ext}`,alt=String(form.get('alt')||'').slice(0,240);
   await bucket.put(key,file.stream(),{httpMetadata:{contentType:format.mime}});
   try{const statements=[];if(['logo','hero','banner'].includes(role))statements.push(db.prepare("UPDATE studio_assets SET role='gallery' WHERE lead_id=? AND role=?").bind(leadId,role));statements.push(db.prepare('INSERT INTO studio_assets(id,lead_id,object_key,name,mime,size,role,alt,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,leadId,key,name,format.mime,file.size,role,alt,now,user.userId));await db.batch(statements);}
   catch(error){await bucket.delete(key);throw error;}
   const all=await db.prepare('SELECT * FROM studio_assets WHERE lead_id=? ORDER BY created_at').bind(leadId).all<Asset>();
   return json({asset:assetInfo({id,lead_id:leadId,object_key:key,name,mime:format.mime,size:file.size,role,alt,created_at:now}),assets:all.results.map(assetInfo)},201);
  }
  if(path[0]==='assets'&&validId(path[1])){
   const file=await db.prepare('SELECT * FROM studio_assets WHERE id=?').bind(path[1]).first<Asset>();
   if(!file)return json({error:'Arquivo não encontrado.'},404);
   if(request.method==='PATCH'){
    const body=await readJSON(request),role=file.mime.startsWith('video/')?'video':(['logo','hero','banner','gallery','product'].includes(body.role)?body.role:file.role),alt=String(body.alt??file.alt).slice(0,240);
    const statements=[];
    if(['logo','hero','banner'].includes(role))statements.push(db.prepare("UPDATE studio_assets SET role='gallery' WHERE lead_id=? AND role=? AND id!=?").bind(file.lead_id,role,file.id));
    statements.push(db.prepare('UPDATE studio_assets SET role=?,alt=? WHERE id=?').bind(role,alt,file.id));await db.batch(statements);
    const all=await db.prepare('SELECT * FROM studio_assets WHERE lead_id=? ORDER BY created_at').bind(file.lead_id).all<Asset>();
    return json({assets:all.results.map(assetInfo)});
   }
   if(request.method==='DELETE'){
    await bucket.delete(file.object_key);await db.prepare('DELETE FROM studio_assets WHERE id=?').bind(file.id).run();return json({ok:true});
   }
  }
  if(path[0]==='files'&&validId(path[1])&&['GET','HEAD'].includes(request.method)){
   const file=await db.prepare('SELECT * FROM studio_assets WHERE id=?').bind(path[1]).first<Asset>();
   if(!file)return json({error:'Arquivo não encontrado.'},404);
   const object=await bucket.get(file.object_key,{range:request.headers});
   if(!object)return json({error:'Arquivo indisponível.'},404);
   const responseHeaders=new Headers({'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Disposition':`inline; filename="${file.id}.${file.mime.split('/')[1]}"`});
   responseHeaders.set('ETag',object.httpEtag);let status=200;
   if(request.headers.has('range')&&object.range&&'offset' in object.range&&object.range.offset!==undefined){const offset=object.range.offset,length=object.range.length??object.size-offset;responseHeaders.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);responseHeaders.set('Content-Length',String(length));status=206;}
   else responseHeaders.set('Content-Length',String(object.size));
   return new Response(request.method==='HEAD'?null:object.body,{status,headers:responseHeaders});
  }
  return json({error:'Recurso não encontrado.'},404);
 }catch(error){
  if(error instanceof StudioFailure)return json({error:error.message,...error.details},error.status);
  if(error instanceof Error&&error.name==='ZodError')return json({error:'Dados inválidos. Confira os campos e os limites da pesquisa.'},400);
  console.error('Prospecto API:',error instanceof Error?error.message:'erro');
  return json({error:error instanceof SyntaxError?'Conteúdo inválido.':error instanceof Error&&/Informe|Dados|Tipo|nome|Nome/.test(error.message)?error.message:'Não foi possível concluir. Seus dados locais foram preservados; tente novamente.'},400);
 }
}
