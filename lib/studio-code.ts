import {StudioFailure,type StudioAccess} from './studio-auth';
import {pageSnapshot} from './page-history';
import {normalizeCodeFiles,compileCode} from '../public/source-code.js';
import {cleanRecord,validId} from './studio-validation.js';
import type {StudioRow} from './studio-records';
type Draft={lead_id:string;files:string;revision:number;updated_at:string};
async function leadRow(a:StudioAccess,id:string){if(!validId(id))throw new StudioFailure(400,'Empresa inválida.');const row=await a.db.prepare("SELECT * FROM studio_records WHERE key=? AND kind='lead'").bind('lead:'+id).first<StudioRow>();if(!row)throw new StudioFailure(404,'Empresa não encontrada.');return row;}
function filesOf(value:unknown){try{return normalizeCodeFiles(value as any);}catch(e){throw new StudioFailure(400,e instanceof Error?e.message:'Código inválido.');}}
export async function listCodeHistory(a:StudioAccess,id:string,before=0){
 await leadRow(a,id);if(!Number.isSafeInteger(before)||before<0)throw new StudioFailure(400,'Página de histórico inválida.');
 const rows=await a.db.prepare('SELECT seq,id,kind,label,created_at FROM studio_page_versions WHERE lead_id=? AND (?=0 OR seq<?) ORDER BY seq DESC LIMIT 31').bind(id,before,before).all();
 return {versions:rows.results.slice(0,30),next:rows.results.length>30?rows.results[29].seq:null};
}
export async function getCodeVersion(a:StudioAccess,id:string,versionId:string){await leadRow(a,id);if(!validId(versionId))throw new StudioFailure(400,'Versão inválida.');const r=await a.db.prepare('SELECT id,kind,label,files,created_at FROM studio_page_versions WHERE lead_id=? AND id=?').bind(id,versionId).first<any>();if(!r)throw new StudioFailure(404,'Versão não encontrada.');return {...r,files:JSON.parse(r.files)};}
export async function getCode(a:StudioAccess,id:string){
 const row=await leadRow(a,id),lead=JSON.parse(row.data),draft=await a.db.prepare('SELECT * FROM studio_code_drafts WHERE lead_id=?').bind(id).first<Draft>(),active=await pageSnapshot(a,lead);
 return {lead:{id,name:lead.name,revision:row.revision,publicEnabled:!!lead.publicEnabled,productionStatus:lead.productionStatus},files:draft?JSON.parse(draft.files):active,revision:draft?.revision||0,updatedAt:draft?.updated_at||row.updated_at,fromActive:!draft,active,history:await listCodeHistory(a,id)};
}
export async function saveCode(a:StudioAccess,id:string,input:any){
 const files=filesOf(input.files),expected=input.expected_revision;
 if(!Number.isSafeInteger(expected)||expected<0)throw new StudioFailure(400,'Informe a revisão do rascunho.');
 // Validate the actual compiled size too; never truncate source.
 try{compileCode(files);}catch(e){throw new StudioFailure(400,(e as Error).message);}
 await leadRow(a,id);
 const now=new Date().toISOString(),versionId=crypto.randomUUID(),label=String(input.label||'Edição de código').trim().slice(0,120),data=JSON.stringify(files);
 const results=await a.db.batch([
  a.db.prepare('INSERT INTO studio_page_versions(id,lead_id,kind,label,files,created_at,created_by) SELECT ?,?,?,?,?,?,? WHERE COALESCE((SELECT revision FROM studio_code_drafts WHERE lead_id=?),0)=?').bind(versionId,id,'draft',label,data,now,a.user.userId,id,expected),
  a.db.prepare('INSERT INTO studio_code_drafts(lead_id,files,revision,updated_at,updated_by) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_page_versions WHERE id=?) ON CONFLICT(lead_id) DO UPDATE SET files=excluded.files,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE studio_code_drafts.revision=?').bind(id,data,expected+1,now,a.user.userId,versionId,expected),
 ]);
 if(!results[1].meta.changes)throw new StudioFailure(409,'Outro integrante salvou este rascunho. Recarregue a versão compartilhada; sua edição continua no editor.',{code:'code_conflict'});
 return {saved:true,applied:false,revision:expected+1,versionId,updatedAt:now};
}
export async function applyCode(a:StudioAccess,id:string,input:any){
 const row=await leadRow(a,id),lead=JSON.parse(row.data),draft=await a.db.prepare('SELECT * FROM studio_code_drafts WHERE lead_id=?').bind(id).first<Draft>();
 if(!draft)throw new StudioFailure(400,'Salve o rascunho antes de aplicar.');
 if(row.revision!==input.expected_lead_revision||draft.revision!==input.expected_revision)throw new StudioFailure(409,'A página ou o rascunho mudou. Recarregue antes de aplicar.',{code:'code_conflict'});
 if(lead.archivedAt)throw new StudioFailure(409,'Esta empresa está na lixeira. Restaure o cadastro antes de aplicar outra página.');
 if(lead.publicEnabled||lead.productionStatus==='approved')throw new StudioFailure(409,'Desative o link e coloque a página em revisão antes de aplicar outro código. O rascunho pode continuar sendo editado.');
 const files=filesOf(JSON.parse(draft.files));let html;try{html=compileCode(files);}catch(e){throw new StudioFailure(400,(e as Error).message);}
 const data=cleanRecord('lead',{...lead,customHtml:html,pageScriptsEnabled:files.scriptsEnabled,productionStatus:'review',publishReady:false},id),snapshot=await pageSnapshot(a,lead),now=new Date().toISOString(),versionId=crypto.randomUUID();
 const result=await a.db.batch([
  a.db.prepare('INSERT INTO studio_page_versions(id,lead_id,kind,label,files,created_at,created_by) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_records WHERE key=? AND revision=?) AND EXISTS(SELECT 1 FROM studio_code_drafts WHERE lead_id=? AND revision=?)').bind(versionId,id,'before_apply','Página anterior à aplicação',JSON.stringify(snapshot),now,a.user.userId,'lead:'+id,row.revision,id,draft.revision),
  a.db.prepare('UPDATE studio_records SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE key=? AND revision=? AND EXISTS(SELECT 1 FROM studio_page_versions WHERE id=?)').bind(JSON.stringify(data),now,a.user.userId,'lead:'+id,row.revision,versionId),
 ]);
 if(!result[1].meta.changes)throw new StudioFailure(409,'A página mudou durante a aplicação. Recarregue antes de tentar novamente.',{code:'code_conflict'});
 return {applied:true,record:{...data,_revision:row.revision+1,_updatedAt:now},previousVersion:versionId};
}
