const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/sticker-core.96hi-myY.js","_astro/banana-engine.B_3T8BaJ.js","_astro/banana-geo.BaanWeq5.js","_astro/products.B2Ex3UUy.js"])))=>i.map(i=>d[i]);
import{_ as E}from"./preload-helper.BlTxHScW.js";import F from"./products.B2Ex3UUy.js";const N={amount:14.99},I=e=>F.find(n=>n.key===e)||null,T=()=>E(()=>import("./sticker-core.96hi-myY.js"),__vite__mapDeps([0,1,2,3])),M=`
.mir {
  --mir-ink: #111; --mir-paper: #fffdf5;
  display: grid; grid-template-columns: minmax(0, 148px) minmax(0, 1fr); gap: 0.9rem;
  align-items: center; text-align: left;
  background: linear-gradient(160deg, #ffe86b, #f5c400);
  border: 4px solid var(--mir-ink); box-shadow: 8px 8px 0 var(--mir-ink);
  padding: 0.9rem; color: var(--mir-ink); max-width: 560px;
}
.mir__shot {
  position: relative; aspect-ratio: 1; border: 3px solid var(--mir-ink);
  background: #e8e4da; overflow: hidden; box-shadow: 3px 3px 0 rgba(0,0,0,0.35);
}
.mir__shot canvas { display: block; width: 100%; height: 100%; }
/* the corner flash — the one bit of pure showmanship */
.mir__flag {
  position: absolute; top: 19px; left: -46px; width: 160px; transform: rotate(-38deg);
  text-align: center; padding: 3px 0;
  background: #e22020; color: #fff; font-family: "Archivo Black", sans-serif;
  font-size: 0.55rem; letter-spacing: 0.1em; box-shadow: 0 1px 0 rgba(0,0,0,0.4);
}
.mir__kicker {
  font-size: 0.58rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
  opacity: 0.72; margin: 0 0 0.15rem;
}
.mir__head {
  font-family: "Archivo Black", sans-serif; font-size: clamp(1.05rem, 4.6vw, 1.5rem);
  line-height: 1.02; margin: 0 0 0.4rem; text-wrap: balance;
}
.mir__pills { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0 0 0.6rem; }
.mir__pill {
  font-size: 0.62rem; font-weight: 800; letter-spacing: 0.04em; padding: 0.2rem 0.45rem;
  border-radius: 999px; background: rgba(0,0,0,0.09); box-shadow: inset 0 0 0 2px rgba(0,0,0,0.18);
}
.mir__pill--price { background: var(--mir-ink); color: #ffe135; box-shadow: none; }
.mir__go {
  display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none;
  background: var(--mir-ink); color: #ffe135; font-family: inherit; font-weight: 800;
  font-size: 0.92rem; padding: 0.62rem 1rem; border: 3px solid var(--mir-ink);
  box-shadow: 3px 3px 0 rgba(0,0,0,0.45); cursor: pointer; white-space: nowrap;
}
.mir__go:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 rgba(0,0,0,0.5); }
.mir__go:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 rgba(0,0,0,0.45); }
.mir__no {
  display: block; margin-top: 0.45rem; background: none; border: 0; padding: 0; cursor: pointer;
  font: inherit; font-size: 0.7rem; font-weight: 700; opacity: 0.6; text-decoration: underline;
  text-underline-offset: 3px; color: inherit; text-align: inherit; width: 100%;
}
@media (max-width: 430px) {
  .mir { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .mir__shot { width: 60%; }
  .mir__pills { justify-content: center; }
}
/* the post-download moment: the card arrives over the page, once */
.mir-veil {
  position: fixed; inset: 0; z-index: 80; display: grid; place-items: center;
  background: rgba(8, 6, 2, 0.72); padding: 1rem;
  animation: mirIn 0.22s ease-out;
}
.mir-veil[hidden] { display: none; }
@keyframes mirIn { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mir-veil { animation: none; } .mir__go:hover { transform: none; } }
`;let C=!1;function A(){if(C)return;C=!0;const e=document.createElement("style");e.textContent=M,document.head.appendChild(e)}function R(){try{const e=JSON.parse(localStorage.getItem("bb-last")||"null");if(e&&typeof e=="object")return{hat:e.hat||"none",glasses:e.glasses||"none",extras:e.extras||{},c:e.c,made:!0}}catch{}return{hat:"none",glasses:"none",extras:{},made:!1}}async function O(e,n=420){const{composite:a,makeStickerMockup:i,bboxOf:o,crop:r,pad:s,stickerCaptions:c,stickerEffect:u,ensureCaptionFont:g}=await T(),{assetsReady:b}=await E(async()=>{const{assetsReady:k}=await import("./banana-engine.B_3T8BaJ.js").then(w=>w.h);return{assetsReady:k}},__vite__mapDeps([1,2]));await b();const l={effect:"none",bg:"transparent",top:"",bottom:"",captions:!1,frame:3,...e,extras:e.extras||{}};await g(l);const d=512,f=document.createElement("canvas");f.width=f.height=d;const m=f.getContext("2d");a(m,d,l.frame,l,{bg:"transparent",captions:c(l),effect:u(l)});const h=r(f,s(o([m.getImageData(0,0,d,d).data],d),d));return i(l,h,n,"sticker")}const D=()=>"$"+N.amount.toFixed(2);function L({kicker:e="Make it real",head:n="Your banana, as a real sticker",pills:a=["Die-cut vinyl","Free worldwide shipping"],cta:i="See it as a sticker →",href:o="/make-a-banana/sticker/",flag:r="MADE BY YOU",outfit:s=null,product:c="sticker",price:u=!0,bare:g=!1,onGo:b=null,onSkip:l=null,skipText:d=""}={}){A();const f=g?{hat:"none",glasses:"none",extras:{}}:s||R(),m=document.createElement("div");m.className="mir";const h=document.createElement("div");if(h.className="mir__shot",r){const t=document.createElement("span");t.className="mir__flag",t.textContent=r,h.appendChild(t)}m.appendChild(h),H(f,c,420).then(t=>{h.appendChild(t)}).catch(()=>{});const k=document.createElement("div"),w=document.createElement("p");w.className="mir__kicker",w.textContent=e;const y=document.createElement("p");y.className="mir__head",y.textContent=n;const _=document.createElement("div");if(_.className="mir__pills",u){const t=document.createElement("span");t.className="mir__pill mir__pill--price";const p=c&&c!=="sticker"?I(c):null;t.textContent=p&&p.priceHint?"$"+p.priceHint:D(),_.appendChild(t)}a.forEach(t=>{const p=document.createElement("span");p.className="mir__pill",p.textContent=t,_.appendChild(p)});const x=document.createElement("a");if(x.className="mir__go",x.href=o,x.textContent=i,b&&x.addEventListener("click",b),k.append(w,y,_,x),d){const t=document.createElement("button");t.type="button",t.className="mir__no",t.textContent=d,l&&t.addEventListener("click",l),k.appendChild(t)}return m.appendChild(k),m}let v=!1;const Y=typeof location<"u"&&location.search.includes("offertest");function G(e={}){const n=Y;if(v&&!n)return null;if(!n){try{if(sessionStorage.getItem("mir-seen"))return v=!0,null;sessionStorage.setItem("mir-seen","1")}catch{}v=!0}A();const a=document.createElement("div");a.className="mir-veil";const i=()=>a.remove(),o=L({...e,skipText:e.skipText||"no thanks, just the GIF",onSkip:i,onGo:r=>{e.onGo&&e.onGo(r)}});return a.appendChild(o),a.addEventListener("click",r=>{r.target===a&&i()}),addEventListener("keydown",function r(s){s.key==="Escape"&&(i(),removeEventListener("keydown",r))}),document.body.appendChild(a),{el:a,close:i}}const S={yours:{kicker:"Make it real",product:"sticker",head:"That banana, as a real sticker",pills:["Die-cut vinyl","Free worldwide shipping"],cta:"See it as a sticker →",href:"/make-a-banana/sticker/",flag:"MADE BY YOU"},yoursMug:{kicker:"Make it real",product:"mug",head:"Your banana, on your morning coffee",pills:["11oz enamel camper mug","Free worldwide shipping"],cta:"See it on a mug →",href:"/make-a-banana/mug/",flag:"MADE BY YOU"},yoursTee:{kicker:"Make it real",product:"tee",head:"Your banana, on a t-shirt",pills:["Printed on demand","Free worldwide shipping"],cta:"See it on a tee →",href:"/make-a-banana/tee/",flag:"MADE BY YOU"},original:{price:!1,kicker:"Since 1999",product:"mug",bare:!0,head:"The original banana, on a real mug",pills:["Official merch","Free worldwide shipping"],cta:"See the official shop →",href:"/shop/",flag:"THE ORIGINAL"},originalTee:{price:!1,kicker:"Since 1999",product:"tee",bare:!0,head:"Wear the banana that started it",pills:["Official tee","Free worldwide shipping"],cta:"See the official shop →",href:"/shop/",flag:"THE ORIGINAL"},gallery:{kicker:"Make it real",product:"sticker",head:"This one can be a real sticker",pills:["Die-cut vinyl","Free worldwide shipping"],cta:"Make it a sticker →",href:"/make-a-banana/sticker/",flag:"FREE TO MAKE"},remix:{price:!1,kicker:"Since 1999",product:"mug",bare:!0,head:"The banana they remixed, on a real mug",pills:["Official merch","Free worldwide shipping"],cta:"See the official shop →",href:"/shop/",flag:"THE ORIGINAL"},wallpaper:{price:!1,kicker:"Off the screen",product:"mug",bare:!0,head:"It looks even better on a mug",pills:["Official merch","Free worldwide shipping"],cta:"See the official shop →",href:"/shop/",flag:"THE ORIGINAL"},emoji:{price:!1,kicker:"Make it real",product:"sticker",bare:!0,head:"A banana for your laptop, not just your chat",pills:["Die-cut vinyl","Free worldwide shipping"],cta:"Make your own sticker →",href:"/make-a-banana/",flag:"THE ORIGINAL"}};async function H(e,n,a=420){if(!n||n==="sticker")return O(e,a);const{productMockup:i,ensureCaptionFont:o}=await T(),{assetsReady:r}=await E(async()=>{const{assetsReady:u}=await import("./banana-engine.B_3T8BaJ.js").then(g=>g.h);return{assetsReady:u}},__vite__mapDeps([1,2]));await r();const s=I(n);if(!s)return O(e,a);const c={effect:"none",bg:"transparent",top:"",bottom:"",captions:!1,frame:3,...e,extras:e&&e.extras||{}};return await o(c),i(c,s,a,{colorHex:"#ffffff"})}function z(e,n,a){document.addEventListener("click",o=>{if(!(o.target.closest&&o.target.closest('a[download], a[href$=".gif"], a[href$=".png"], a[href$=".webp"]')))return;const s={...S[e]||S.yours,...n||{}};setTimeout(()=>{G({...s,onGo:()=>{window.gtag&&window.gtag("event","offer_click",{from:e})}})&&window.gtag&&window.gtag("event","offer_shown",{from:e})},700)})}export{S as OFFERS,R as myOutfit,G as offerAfterDownload,L as offerCard,H as productShot,O as stickerShot,z as wireDownloads};
