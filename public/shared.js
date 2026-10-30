const BASE_KEY='prospecto.cloud.base.v2';
const clone=v=>JSON.parse(JSON.stringify(v));
const same=(a,b)=>{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 const ak=Object.keys(a).filter(k=>a[k]!==undefined),bk=Object.keys(b).filter(k=>b[k]!==undefined);
 return ak.length===bk.length&&ak.every(k=>same(a[k],b[k]));
};
const clean=record=>{
 const data=Object.fromEntries(Object.entries(record||{}).filter(([k])=>!k.startsWith('_')&&k!=='assets'));
 // Older devices/records predate the trash field. An absent value and an
 // empty value both mean active; loading a newer form is not a restore edit.
 if(typeof data.name==='string'&&typeof data.id==='string')data.archivedAt??='';
 return data;
};
export async function api(path,options={}){
 const response=await fetch('/api/'+path,{...options,headers:{'X-Prospecto-Request':'1',...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers},cache:'no-store'});
 const result=await response.json();
 if(!response.ok)throw Object.assign(new Error(result.error||'Não foi possível conectar.'),{status:response.status,...result});
 return result;
}
export class SharedStore{
 constructor(state,{save,onStatus,onChange,onConflict,onDenied}){
  this.state=state;this.save=save;this.onStatus=onStatus;this.onChange=onChange;this.onConflict=onConflict;this.onDenied=onDenied;this.base={};this.online=false;this.ready=false;this.busy=false;this.blocked=null;this.info=null;
  try{this.base=Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(BASE_KEY)||'{}')).map(([key,value])=>[key,clean(value)]));}catch{}
 }
 documents(){return [
  {kind:'settings',id:'studio',data:this.state.settings},
  ...this.state.leads.filter(l=>!l.isDemo).map(data=>({kind:'lead',id:data.id,data})),
  ...this.state.expenses.filter(e=>!e.isDemo).map(data=>({kind:'expense',id:data.id,data})),
 ];}
 current(kind,id){if(kind==='settings')return this.state.settings;return (kind==='lead'?this.state.leads:this.state.expenses).find(x=>x.id===id);}
 remember(){try{localStorage.setItem(BASE_KEY,JSON.stringify(this.base));}catch{}this.save();}
 dirty(){return this.ready&&this.documents().some(d=>!same(clean(d.data),this.base[d.kind+':'+d.id]||{}));}
 async connect(){
  if(this.busy||this.connecting)return;
  this.connecting=true;this.onStatus('connecting');
  try{
   const remote=await api('bootstrap');this.info=remote;
   const first=!Object.keys(this.base).length;
   if(first){try{localStorage.setItem('prospecto.before-cloud.v1',JSON.stringify(this.state));}catch{}}
   this.merge(remote,first);this.ready=true;this.online=true;this.remember();this.onChange();
   this.onStatus(this.dirty()?'saving':'saved');
   this.connecting=false;await this.flush();
  }catch(error){
   this.online=false;this.connecting=false;
   if([401,403].includes(error.status)){this.onStatus('locked');this.onDenied(error);}
   else this.onStatus('offline',error.message);
  }
 }
 merge(remote,first=false){
  const collections=[['lead','leads'],['expense','expenses']];
  for(const [kind,key] of collections){
   let local=this.state[key].filter(x=>!x.isDemo),merged=[];
   for(const incoming of remote[key]){
    const docKey=kind+':'+incoming.id;
    const existing=local.find(x=>x.id===incoming.id)||(first?local.find(x=>kind==='lead'?x.name.toLowerCase()===incoming.name.toLowerCase()&&x.city.toLowerCase()===incoming.city.toLowerCase():x.label===incoming.label&&x.date===incoming.date&&x.value===incoming.value):null);
    const base=this.base[docKey];
    const server=clean(incoming),value={...incoming};
    const preserved={...server};
    if(existing&&base){for(const [field,v] of Object.entries(clean(existing))){if(!same(v,base[field])){value[field]=v;preserved[field]=base[field];}}}
    this.base[docKey]=preserved;merged.push(value);
    if(existing)local=local.filter(x=>x!==existing);
   }
   this.state[key]=[...this.state[key].filter(x=>x.isDemo),...merged,...local];
  }
  const oldSettings=this.state.settings,oldBase=this.base['settings:studio'];
  if(remote.settings._revision===0&&!oldBase){this.base['settings:studio']={};}
  else{
   const server=clean(remote.settings),value={...remote.settings},base={...server};
   if(oldBase)for(const [field,v] of Object.entries(clean(oldSettings)))if(!same(v,oldBase[field])){value[field]=v;base[field]=oldBase[field];}
   this.state.settings=value;this.base['settings:studio']=base;
  }
 }
 schedule(){
  this.save();if(this.ready)this.onStatus(this.online?'saving':'offline');
  clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),500);
 }
 async flush(){
  clearTimeout(this.timer);
  if(!this.ready||!this.online||this.busy||this.blocked)return;
  this.busy=true;
  try{
   for(;;){
    const pending=this.documents().find(d=>!same(clean(d.data),this.base[d.kind+':'+d.id]||{}));
    if(!pending)break;
    this.onStatus('saving');
    const key=pending.kind+':'+pending.id,base=this.base[key]||{},snapshot=clone(clean(pending.data));
    const changes=Object.fromEntries(Object.entries(snapshot).filter(([k,v])=>!same(v,base[k])));
    try{
     const {record}=await api('records',{method:'POST',body:JSON.stringify({kind:pending.kind,id:pending.id,base,changes})});
     this.base[key]=clean(record);
     const current=this.current(pending.kind,pending.id);
     for(const [field,v] of Object.entries(record))if(field.startsWith('_')||same(current[field],snapshot[field]))current[field]=v;
     this.remember();
    }catch(error){
     if(error.code==='conflict'){
      this.blocked={...pending,error};this.onStatus('conflict');this.onConflict(this.blocked);return;
     }
     throw error;
    }
   }
   this.onStatus('saved');
  }catch(error){this.online=false;this.onStatus('offline',error.message);if([401,403].includes(error.status))this.onDenied(error);}
  finally{this.busy=false;this.remember();}
 }
 resolve(choice){
  const blocked=this.blocked;if(!blocked)return;
  const {kind,id,error}=blocked,local=this.current(kind,id),remote=clean(error.current);
  const previous=this.base[kind+':'+id]||{};
  for(const [field,value] of Object.entries(remote))if(same(local[field],previous[field]))local[field]=value;
  if(choice==='remote')for(const field of error.fields)local[field]=remote[field];
  this.base[kind+':'+id]=remote;this.blocked=null;this.remember();this.onChange();this.flush();
 }
 async refresh(){
  if(this.blocked){this.onConflict(this.blocked);return;}
  if(!this.online){await this.connect();return;}
  if(this.busy||this.connecting||this.blocked)return;
  if(this.dirty()){await this.flush();return;}
  try{const before=JSON.stringify({state:this.state,access:this.info?.access});const remote=await api('bootstrap');this.info=remote;this.merge(remote);this.remember();this.onStatus('saved');if(before!==JSON.stringify({state:this.state,access:this.info?.access}))this.onChange();}
  catch(error){this.online=false;this.onStatus('offline',error.message);if([401,403].includes(error.status))this.onDenied(error);}
 }
}
