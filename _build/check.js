const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const pages=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name.startsWith('_')||e.name==='.claude'||e.name==='assets')continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.html'))pages.push(p);}})(ROOT);
let bad=0,checked=0;
for(const p of pages){
  const html=fs.readFileSync(p,'utf8');
  const dir=path.dirname(p);
  const hrefs=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
  for(const h of hrefs){
    if(/^(https?:|mailto:|tel:|#|data:)/.test(h))continue;
    checked++;
    const clean=h.split('#')[0].split('?')[0];
    if(!clean)continue;
    const target=path.resolve(dir,clean);
    if(!fs.existsSync(target)){bad++;console.log('MISSING',path.relative(ROOT,p),'->',h);}
  }
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  for(const m of html.matchAll(/href="#([^"]+)"/g)){if(!ids.has(m[1]))console.log('DEAD ANCHOR',path.relative(ROOT,p),'->#'+m[1]);}
}
console.log(`\npages=${pages.length} links=${checked} missing=${bad}`);
