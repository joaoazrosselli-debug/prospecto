import {assetPath} from './landing.js';
import {isolatedPreview} from './source-code.js';

// Private files must be fetched by the authenticated dashboard. Client source
// keeps its opaque origin; it receives inline media, never credentials or a
// publicly accessible file URL. Blob URLs also fail in some isolated frames.
const active=new Map();
let observer;
function dispose(state){state.controller.abort();}
function inlineMedia(blob,signal){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader(),cancel=()=>reader.abort();
    const done=()=>signal.removeEventListener('abort',cancel);
    reader.onload=()=>{done();resolve(String(reader.result));};
    reader.onerror=()=>{done();reject(Error('Não foi possível ler o material.'));};
    reader.onabort=()=>{done();reject(Error('Carregamento cancelado.'));};
    if(signal.aborted){reject(Error('Carregamento cancelado.'));return;}
    signal.addEventListener('abort',cancel,{once:true});reader.readAsDataURL(blob);
  });
}
function observe(){
  if(observer||typeof MutationObserver==='undefined')return;
  observer=new MutationObserver(()=>{for(const [frame,state] of active)if(!frame.isConnected){dispose(state);active.delete(frame);}});
  observer.observe(document.body,{childList:true,subtree:true});
  addEventListener('pagehide',()=>{for(const state of active.values())dispose(state);active.clear();});
}
export async function renderPrivatePreview(frame,html,assets=[],{scripts=false,channel='',onStatus=()=>{}}={}){
  const previous=active.get(frame);if(previous)dispose(previous);
  const state={controller:new AbortController()};active.set(frame,state);observe();
  const candidates=assets.flatMap(asset=>{
    let url;try{url=new URL(asset.url,location.origin);}catch{return [];}
    const path=assetPath(asset);
    if(url.origin!==location.origin||url.pathname!=='/api/files/'+asset.id)return [];
    if(![path,asset.url,url.href].some(value=>value&&html.includes(value)))return [];
    return [{asset,url,path}];
  });
  if(candidates.length)onStatus('Carregando os materiais privados…');
  const results=await Promise.all(candidates.map(async item=>{
    try{
      const response=await fetch(item.url.href,{credentials:'same-origin',cache:'no-store',signal:state.controller.signal});
      if(!response.ok)throw Error();
      const blob=await response.blob();
      if(!/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(blob.type))throw Error();
      if(blob.size>20_000_000)throw Error();
      if(state.controller.signal.aborted)return {cancelled:true};
      const value=await inlineMedia(blob,state.controller.signal);return {...item,value};
    }catch{return {error:item.asset.name||'material'};}
  }));
  if(active.get(frame)!==state||state.controller.signal.aborted||!frame.isConnected){dispose(state);return false;}
  for(const item of results)if('value' in item)for(const path of [item.path,item.url.href,item.asset.url].filter(Boolean).sort((a,b)=>b.length-a.length))html=html.replaceAll(path,()=>item.value);
  frame.setAttribute('sandbox','allow-popups allow-popups-to-escape-sandbox'+(scripts?' allow-scripts':''));
  frame.srcdoc=isolatedPreview(html,{scripts,channel});
  const errors=results.filter(item=>'error' in item).map(item=>item.error);
  onStatus(errors.length?'Não foi possível carregar: '+errors.join(', ')+'. Atualize a prévia para tentar novamente.':'',!!errors.length);
  return true;
}
