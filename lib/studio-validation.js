import { normalizeLead, amount, plain } from '../public/core.js';
export const DEFAULT_SETTINGS={studio:'Meu estúdio',city:'Curitiba / PR',price:500,goal:3000,promptTemplate:''};
export const validId=value=>typeof value==='string'&&/^[\w-]{1,80}$/.test(value);
export const same=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a).filter(k=>a[k]!==undefined),bk=Object.keys(b).filter(k=>b[k]!==undefined);return ak.length===bk.length&&ak.every(k=>same(a[k],b[k]));};
export function cleanRecord(kind,data,id){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Dados inválidos.');
  if(kind==='lead'){const lead=normalizeLead({...data,id},false);lead.id=id;return lead;}
  if(kind==='expense'){
    const label=plain(data.label).slice(0,120);
    if(!label||!/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))throw Error('Informe descrição e data do custo.');
    return {id,label,value:amount(data.value),date:data.date,isDemo:false};
  }
  if(kind==='settings')return {studio:plain(data.studio).slice(0,80)||DEFAULT_SETTINGS.studio,city:plain(data.city).slice(0,100),price:amount(data.price),goal:amount(data.goal),promptTemplate:String(data.promptTemplate||'').slice(0,25000),senderName:plain(data.senderName).slice(0,100),salesProfile:data.salesProfile==='studio'?'studio':'student'};
  throw Error('Tipo de registro inválido.');
}
export function changedConflicts(current,base,changes){
 const value=(key,item)=>key==='archivedAt'&&item==null?'':item;
 return Object.keys(changes).filter(k=>!same(value(k,current[k]),value(k,base[k]))&&!same(value(k,current[k]),value(k,changes[k])));
}
export function sniffMedia(bytes){
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return {mime:'image/png',ext:'png'};
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return {mime:'image/jpeg',ext:'jpg'};
  const text=new TextDecoder().decode(bytes);
  if(text.slice(0,4)==='RIFF'&&text.slice(8,12)==='WEBP')return {mime:'image/webp',ext:'webp'};
  if(text.slice(4,8)==='ftyp')return {mime:'video/mp4',ext:'mp4'};
  if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return {mime:'video/webm',ext:'webm'};
  return null;
}
