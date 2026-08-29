import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const skipDirs=new Set(['.git','node_modules']);
const html=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(skipDirs.has(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.name.endsWith('.html'))html.push(p);}}
walk(root);
let failed=false;
for(const file of html){const text=fs.readFileSync(file,'utf8');const rel=path.relative(root,file);const ids=[...text.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]);const dup=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];if(dup.length){console.error(`${rel}: duplicate id(s): ${dup.join(', ')}`);failed=true;}
  const isInjectedComponent=rel.startsWith(`components${path.sep}`);
  for(const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)){let ref=match[1].trim();if(!ref||ref.startsWith('#')||ref.startsWith('http:')||ref.startsWith('https:')||ref.startsWith('mailto:')||ref.startsWith('tel:')||ref.startsWith('data:')||ref.startsWith('javascript:'))continue;ref=ref.split('#')[0].split('?')[0];if(!ref)continue;const target=ref.startsWith('/')||isInjectedComponent?path.join(root,ref.replace(/^\/+/,'')):path.resolve(path.dirname(file),ref);if(!fs.existsSync(target)){console.error(`${rel}: missing local reference ${match[1]}`);failed=true;}}
}
if(failed)process.exit(1);console.log(`Static integrity OK: ${html.length} HTML files checked.`);
