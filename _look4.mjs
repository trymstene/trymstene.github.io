import { chromium } from '@playwright/test';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const ROOT = 'C:/Web Development/trymstene.com/dist';
const TYPES = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon' };
const srv = http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);let f=join(ROOT,p);if(existsSync(f)&&statSync(f).isDirectory())f=join(f,'index.html');if(!existsSync(f)){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'content-type':TYPES[extname(f)]||'application/octet-stream'});createReadStream(f).pipe(res);});
await new Promise((r)=>srv.listen(4399,r));
const OUT='C:/Users/trym/AppData/Local/Temp/claude/C--Web-Development-trymstene-com/aef8f8b4-6bdc-40b9-830c-496f96a6f745/scratchpad/';
const b=await chromium.launch();
const page=await b.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});
const errs=[];page.on('pageerror',(e)=>errs.push(String(e)));
await page.addInitScript(()=>{try{localStorage.setItem('pass-link',JSON.stringify({credId:'c',token:'t'}));}catch(e){}});
await page.goto('http://localhost:4399/town/?towntest',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__town&&window.__town.room&&window.__town.room.band(),null,{timeout:30000});
await page.evaluate(()=>{window.__town.room.curse('none');window.__town.life.set(12);window.__town.room.set(85);});
await page.evaluate(()=>window.__town.room.folkReady());
await page.evaluate(()=>window.__town.room.cafeReady());
await page.evaluate(()=>window.__town.room.folk().fill(6,performance.now()));
await page.evaluate(()=>window.__town.work.set({at:'cafe'}));
await page.evaluate(()=>{const p=window.__town.PROPS.cafe,t=window.__town;t.pos.x=t.tgt.x=p.x+p.w/2;t.pos.y=t.tgt.y=p.base+40;});
await page.waitForTimeout(400);
await page.evaluate(()=>window.__town.room.open('cafe'));
await page.waitForFunction(()=>window.__town.room.cafe()&&window.__town.room.cafe().on(),null,{timeout:8000});
for(let i=0;i<3;i++){await page.evaluate(()=>window.__town.room.cafe().call());await page.waitForTimeout(350);}
await page.waitForTimeout(12000);
await page.evaluate(()=>window.__town.room.cafe().serve());
await page.waitForTimeout(400);
console.log(JSON.stringify(await page.evaluate(()=>{
  const v=document.getElementById('twView').getBoundingClientRect();
  const cup=document.querySelector('.tw-cup').getBoundingClientRect();
  const toast=document.getElementById('twToast');
  const tr=toast.hidden?null:toast.getBoundingClientRect();
  const work=document.querySelector('.tw-atwork');
  const wr=work?work.getBoundingClientRect():null;
  const q=[...document.querySelectorAll('.tw-visitor')].filter((e)=>e.classList.contains('tw-wait')||true).map((e)=>{const r=e.getBoundingClientRect();return {cls:e.className,x:Math.round(r.x),y:Math.round(r.y),bottom:Math.round(r.bottom),visibleInView:r.bottom>v.top&&r.top<v.bottom&&r.right>v.left&&r.left<v.right,aboveTray:r.bottom<=cup.top};});
  const queued=window.__town.room.cafe().line();
  return { view:{top:Math.round(v.top),bottom:Math.round(v.bottom),left:Math.round(v.left),right:Math.round(v.right)},
    cupTop:Math.round(cup.top),
    toast: tr?{top:Math.round(tr.top),bottom:Math.round(tr.bottom),left:Math.round(tr.left),right:Math.round(tr.right),text:toast.textContent}:null,
    atWork: wr?{top:Math.round(wr.top),bottom:Math.round(wr.bottom),left:Math.round(wr.left),right:Math.round(wr.right)}:null,
    toastCoversWindow: tr&&wr? !(tr.right<wr.left||tr.left>wr.right||tr.bottom<wr.top||tr.top>wr.bottom):null,
    queued, bodies:q.filter(z=>z.cls.includes('tw-wait')),
    ropeOnScreen: window.__town.room.cafe().rope().map((r)=>{ const el=document.querySelector('.tw-me'); const W=window.__town.__W||0; return r; }),
    ropeScreen: (()=>{ const w=document.getElementById('twWorld'); const wr=w.getBoundingClientRect(); return window.__town.room.cafe().rope().map((r)=>({ x: Math.round(wr.left + wr.width * (r.x/ (window.__town.__W||4000))), y: Math.round(wr.top + wr.height * (r.y/(window.__town.__H||2000))) })); })() };
}),null,1));
await page.screenshot({path:OUT+'queue-393.png'});
console.log('errors:',errs);
await b.close();srv.close();
