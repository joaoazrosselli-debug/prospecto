import {mkdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),root=path.dirname(require.resolve('prettier/package.json')),target=new URL('../public/vendor/prettier/',import.meta.url);
for(const file of ['standalone.mjs','plugins/html.mjs','plugins/postcss.mjs','plugins/babel.mjs','plugins/estree.mjs','LICENSE']){const dest=new URL(file,target);await mkdir(new URL('.',dest),{recursive:true});await copyFile(path.join(root,file),dest);}
