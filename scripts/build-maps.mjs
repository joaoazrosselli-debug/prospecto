import {build} from 'vite';
import {createRequire} from 'node:module';
import {readFile,readdir,writeFile,copyFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'public/vendor/maps');
await build({configFile:false,root,publicDir:false,logLevel:'warn',build:{outDir:output,emptyOutDir:true,lib:{entry:path.join(root,'maps/engine.js'),formats:['es'],fileName:()=> 'engine.js'},sourcemap:false}});
await copyFile(path.join(root,'node_modules/ol/ol.css'),path.join(output,'engine.css'));

const visited=new Set(),notices=[];
async function collect(folder){
 folder=await realpath(folder);const pkg=JSON.parse(await readFile(path.join(folder,'package.json'),'utf8'));
 const key=pkg.name+'@'+pkg.version;if(visited.has(key))return;visited.add(key);
 const licenseFiles=(await readdir(folder)).filter(name=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
 const texts=[];for(const filename of licenseFiles){try{texts.push(await readFile(path.join(folder,filename),'utf8'));}catch{}}
 notices.push('## '+key+'\n\nLicense: '+(pkg.license||'See package notice')+'\n\n'+texts.join('\n\n'));
 const require=createRequire(path.join(folder,'package.json'));
 for(const dependency of Object.keys(pkg.dependencies||{})){
  let entry;try{entry=require.resolve(dependency+'/package.json');}catch{try{entry=require.resolve(dependency);}catch{continue;}}
  let candidate=path.dirname(entry);
  while(candidate!==path.dirname(candidate)){
   try{const data=JSON.parse(await readFile(path.join(candidate,'package.json'),'utf8'));if(data.name===dependency){await collect(candidate);break;}}catch{}
   candidate=path.dirname(candidate);
  }
 }
}
await collect(path.join(root,'node_modules/ol'));await collect(path.join(root,'node_modules/ol-mapbox-style'));
await writeFile(path.join(output,'LICENSES.md'),'# Map engine dependency notices\n\nGenerated from the installed, lockfile-pinned OpenLayers and ol-mapbox-style dependency graph. Original licenses remain applicable.\n\n'+notices.sort().join('\n\n---\n\n'));
console.log('Map engine ready: Canvas 2D, '+visited.size+' package notices.');
