// Shared source format. No evaluation occurs in the dashboard's origin.
export function normalizeCodeFiles(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Informe os arquivos HTML, CSS e JavaScript.');
 for(const key of ['html','css','js'])if(value[key]!==undefined&&typeof value[key]!=='string')throw Error('O código deve ser texto.');
 const files={html:String(value.html??''),css:String(value.css??''),js:String(value.js??''),scriptMode:value.scriptMode==='module'?'module':'classic',scriptsEnabled:value.scriptsEnabled===true};
 if(files.html.length>250000||files.css.length>100000||files.js.length>100000)throw Error('HTML até 250 mil caracteres; CSS e JavaScript até 100 mil cada.');
 if(files.html.length+files.css.length+files.js.length>250000)throw Error('O conjunto de código deve ter até 250 mil caracteres.');
 return files;
}
const inlineStyle=css=>css.replace(/<\/style/gi,'<\\/style');
const inlineScript=js=>js.replace(/<\/script/gi,'<\\/script');
export function compileCode(value,{external=false}={}){
 const f=normalizeCodeFiles(value);let html=f.html;
 html=html.replace(/<link\b[^>]*\bhref\s*=\s*(["'])(?:\.\/)?styles?\.css\1[^>]*>/gi,'').replace(/<script\b[^>]*\bsrc\s*=\s*(["'])(?:\.\/)?(?:script|app)\.js\1[^>]*>\s*<\/script\s*>/gi,'');
 if(!/<html\b/i.test(html))html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+html+'</body></html>';
 if(!/<head\b/i.test(html))html=html.replace(/<html\b[^>]*>/i,m=>m+'<head></head>');
 const css=f.css?(external?'<link rel="stylesheet" href="styles.css">':'<style data-prospecto-code="css">'+inlineStyle(f.css)+'</style>'):'';
 html=html.replace(/<\/head\s*>/i,css+'</head>');
 const js=f.js&&f.scriptsEnabled?(external?'<script '+(f.scriptMode==='module'?'type="module" ':'defer ')+'src="script.js"></script>':'<script data-prospecto-code="js"'+(f.scriptMode==='module'?' type="module"':'')+'>'+inlineScript(f.js)+'</script>'):'';
 html=/<\/body\s*>/i.test(html)?html.replace(/<\/body\s*>/i,()=>js+'</body>'):html+js;
 if(html.length>250000)throw Error('O HTML final ultrapassa 250 mil caracteres.');return html;
}
export function splitCodeDocument(html,scriptsEnabled=false){
 if(typeof DOMParser==='undefined')return normalizeCodeFiles({html,scriptsEnabled});
 const doc=new DOMParser().parseFromString(html,'text/html'),css=[],js=[];let scriptMode='classic';
 for(const style of doc.querySelectorAll('style')){const media=style.getAttribute('media');css.push(media?'@media '+media+'{\n'+style.textContent+'\n}':style.textContent);style.remove();}
 const executable=[...doc.querySelectorAll('script:not([src])')].filter(s=>!s.type||['text/javascript','application/javascript','module'].includes(s.type));
 const types=new Set(executable.map(s=>s.type==='module'?'module':'classic'));
 // Mixed script modes retain their original order and scope inside HTML.
 if(types.size<=1){for(const script of executable){js.push(script.textContent);if(script.type==='module')scriptMode='module';script.remove();}}
 return normalizeCodeFiles({html:'<!doctype html>\n'+doc.documentElement.outerHTML,css:css.join('\n\n'),js:js.join('\n;\n'),scriptMode,scriptsEnabled});
}
export function pageCSP(scripts=false,{publicPage=false}={}){
 return `${publicPage?'sandbox allow-popups allow-popups-to-escape-sandbox'+(scripts?' allow-scripts':'')+'; ':''}default-src 'none'; img-src https: data: blob:; media-src https: data: blob:; style-src 'unsafe-inline' https:; font-src https: data:; script-src ${scripts?"'unsafe-inline'":"'none'"}; connect-src 'none'; worker-src 'none'; child-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`;
}
export function isolatedPreview(html,{scripts=false,channel=''}={}){
 const doc=new DOMParser().parseFromString(html,'text/html');
 for(const base of doc.querySelectorAll('base'))base.remove();
 for(const a of doc.querySelectorAll('a[href^="#"]'))a.setAttribute('href','about:srcdoc'+a.getAttribute('href'));
 const meta=doc.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content=pageCSP(scripts);doc.head.prepend(meta);
 if(scripts&&channel){const reporter=doc.createElement('script');reporter.textContent=`(()=>{const report=(kind,message)=>parent.postMessage({type:'prospecto-code-report',channel:${JSON.stringify(channel)},kind,message:String(message).slice(0,1500)},'*');addEventListener('error',e=>report('error',e.message+(e.lineno?' · linha '+e.lineno:'')));addEventListener('unhandledrejection',e=>report('error',e.reason?.message||e.reason));addEventListener('securitypolicyviolation',e=>report('policy','Bloqueado pela prévia: '+e.violatedDirective));addEventListener('DOMContentLoaded',()=>report('ready','Página carregada.'));})();`;meta.after(reporter);}
 return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
export const NAVIGATION_FINISH=`\n/* Acabamento de navegação: ajuste os seletores à sua página. */\n.nav-links a{position:relative;padding:10px 4px;transition:color .18s ease,background .18s ease}\n.nav-links a:after{content:"";position:absolute;left:4px;right:4px;bottom:3px;height:2px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .18s ease}\n.nav-links a:hover:after,.nav-links a:focus-visible:after{transform:scaleX(1)}\n.nav-links a:hover{color:var(--accent,#bc7b2e)}\n.button{transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}\n.button:hover{transform:translateY(-2px);box-shadow:0 9px 22px #0002;filter:brightness(.96)}\na:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid #4b87d1;outline-offset:4px}\n@media(prefers-reduced-motion:reduce){.nav-links a,.nav-links a:after,.button{transition:none}.button:hover{transform:none}}\n`;
