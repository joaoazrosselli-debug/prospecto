// In-memory browser fixture only. Never loaded by the production application.
const codeFixtureStates={};const codeFixtureFetch=window.fetch.bind(window);
window.fetch=async function(url,options={}){
 if(typeof url!=='string'||!url.startsWith('/api/code/'))return codeFixtureFetch(url,options);
 const parts=url.split('?')[0].split('/').filter(Boolean),id=parts[2],lead=fixture.leads.find(l=>l.id===id);
 if(!lead)return new Response(JSON.stringify({error:'Empresa de teste não encontrada.'}),{status:404});
 const {createSite,assetPath}=await import('/landing.js'),{compileCode}=await import('/source-code.js'),{uid}=await import('/core.js');
 const active=()=>({html:createSite({...lead,assets:(lead.assets||[]).map(a=>({...a,url:assetPath(a)}))}),css:'',js:'',scriptMode:'classic',scriptsEnabled:!!lead.pageScriptsEnabled});
 const state=codeFixtureStates[id]||=( {files:null,revision:0,versions:[]} );let result={},status=200;
 const body=typeof options.body==='string'?JSON.parse(options.body):{};
 const addVersion=(files,kind,label)=>{const row={seq:state.versions.length+1,id:uid(),kind,label,files:structuredClone(files),created_at:new Date().toISOString()};state.versions.unshift(row);return row.id;};
 if(!options.method||options.method==='GET'){
  if(parts[3]==='history')result={versions:state.versions.map(({files,...row})=>row),next:null};
  else if(parts[3]==='versions')result=state.versions.find(v=>v.id===parts[4]);
  else result={lead:{id,name:lead.name,revision:lead._revision,publicEnabled:!!lead.publicEnabled,productionStatus:lead.productionStatus},files:state.files||active(),active:active(),revision:state.revision,fromActive:!state.files,history:{versions:state.versions.map(({files,...row})=>row),next:null}};
 }else if(parts[3]==='apply'){
  if(state.revision!==body.expected_revision||lead._revision!==body.expected_lead_revision){status=409;result={error:'A revisão mudou.'};}
  else{const previousVersion=addVersion(active(),'before_apply','Página anterior à aplicação');lead.customHtml=compileCode(state.files);lead.pageScriptsEnabled=state.files.scriptsEnabled;lead.productionStatus='review';lead._revision++;result={applied:true,record:lead,previousVersion};}
 }else if(state.revision!==body.expected_revision){status=409;result={error:'Outro integrante salvou o rascunho.'};}
 else{state.files=structuredClone(body.files);state.revision++;const versionId=addVersion(state.files,'draft',body.label||'Edição de código');result={saved:true,applied:false,revision:state.revision,versionId};}
 return new Response(JSON.stringify(result),{status,headers:{'Content-Type':'application/json'}});
};
