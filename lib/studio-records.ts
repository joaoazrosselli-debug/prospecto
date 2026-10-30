import {changedConflicts,cleanRecord} from './studio-validation.js';
import {StudioFailure,type StudioAccess} from './studio-auth';
import {pageSnapshot} from './page-history';
export type StudioRow={key:string;kind:string;data:string;revision:number;updated_at:string;updated_by:string};
export const unpackRecord=(r:StudioRow)=>({...JSON.parse(r.data),_revision:r.revision,_updatedAt:r.updated_at});
export async function saveRecord(access:StudioAccess,kind:string,id:string,base:Record<string,unknown>,changes:Record<string,unknown>){
 const key=kind==='settings'?'settings:studio':`${kind}:${id}`,now=new Date().toISOString();
 for(let attempt=0;attempt<4;attempt++){
  const row=await access.db.prepare('SELECT * FROM studio_records WHERE key=?').bind(key).first<StudioRow>();
  const current=row?JSON.parse(row.data):{},conflicts=row?changedConflicts(current,base,changes):[];
  if(conflicts.length)throw new StudioFailure(409,'Outro integrante alterou os mesmos campos. Escolha qual versão manter.',{code:'conflict',fields:conflicts,current:unpackRecord(row!)});
  const data:any=cleanRecord(kind,{...current,...changes},id);
  if(kind==='lead'&&data.archivedAt)data.publicEnabled=false;
  if(kind==='lead'&&(current.isTest||data.isTest)){
   data.isTest=true;
   if(data.publicEnabled)throw new StudioFailure(400,'Fichas de teste ficam privadas. Crie uma ficha real separada para publicar.');
  }
  let result;
  if(row&&kind==='lead'&&(current.customHtml!==data.customHtml||!!current.pageScriptsEnabled!==data.pageScriptsEnabled)){
   const versionId=crypto.randomUUID(),snapshot=await pageSnapshot(access,current);
   const batch=await access.db.batch([
    access.db.prepare('INSERT INTO studio_page_versions(id,lead_id,kind,label,files,created_at,created_by) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM studio_records WHERE key=? AND revision=?)').bind(versionId,id,'before_apply','Antes da alteração de código',JSON.stringify(snapshot),now,access.user.userId,key,row.revision),
    access.db.prepare('UPDATE studio_records SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE key=? AND revision=? AND EXISTS(SELECT 1 FROM studio_page_versions WHERE id=?)').bind(JSON.stringify(data),now,access.user.userId,key,row.revision,versionId),
   ]);result=batch[1];
  }else result=row
   ?await access.db.prepare('UPDATE studio_records SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE key=? AND revision=?').bind(JSON.stringify(data),now,access.user.userId,key,row.revision).run()
   :await access.db.prepare('INSERT OR IGNORE INTO studio_records(key,kind,data,revision,updated_at,updated_by) VALUES(?,?,?,1,?,?)').bind(key,kind,JSON.stringify(data),now,access.user.userId).run();
  if(result.meta.changes)return {...data,_revision:(row?.revision||0)+1,_updatedAt:now};
 }
 throw new StudioFailure(409,'A base está recebendo outras alterações. Tente salvar novamente.');
}
