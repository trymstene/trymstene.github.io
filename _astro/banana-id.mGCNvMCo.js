import{d as v}from"./banana-pass.1Skze-nB.js";const y="ps-name-v1",k="ps-name-asked-v1";function E(){try{return(localStorage.getItem(y)||"").trim().slice(0,24)}catch{return""}}const w=()=>{try{return localStorage.getItem(k)==="1"}catch{return!0}},C=()=>{try{localStorage.setItem(k,"1")}catch{}},N=`
.bid-veil{ position:fixed; inset:0; z-index:80; display:flex; align-items:center;
  justify-content:center; padding:18px; background:rgba(10,8,4,.62);
  -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); }
.bid-card{ width:100%; max-width:340px; background:#fffdf5; color:#1a1408;
  border:3px solid #1a1408; box-shadow:7px 7px 0 rgba(0,0,0,.45); padding:18px 16px 16px;
  font-family:inherit; text-align:center; }
.bid-face{ width:72px; height:72px; image-rendering:pixelated; display:block; margin:0 auto 6px; }
.bid-card h2{ font-size:1.05rem; margin:0 0 4px; line-height:1.25; }
.bid-card p{ font-size:.82rem; line-height:1.5; margin:0 0 12px; opacity:.8; }
.bid-in{ width:100%; font:inherit; font-size:1rem; padding:10px 11px; text-align:center;
  border:3px solid #1a1408; background:#fff; color:#1a1408; margin-bottom:10px; }
.bid-in:focus{ outline:3px solid #ffd23f; outline-offset:1px; }
.bid-go{ font:inherit; font-weight:700; font-size:.9rem; width:100%; padding:11px 12px;
  border:3px solid #1a1408; background:#ffe135; color:#1a1408; cursor:pointer;
  box-shadow:4px 4px 0 rgba(0,0,0,.35); }
.bid-go:hover{ background:#1a1408; color:#ffe135; }
.bid-go[disabled]{ opacity:.45; cursor:default; box-shadow:none; }
.bid-skip{ display:block; margin:9px auto 0; background:none; border:0; font:inherit;
  font-size:.72rem; color:#1a1408; opacity:.55; cursor:pointer; text-decoration:underline; }
.bid-err{ font-size:.74rem; color:#b3261e; margin:-4px 0 8px; }
/* ✓ saved — the beat that makes it feel like something happened */
.bid-done{ font-size:1.15rem; margin:6px 0 0; }
@media (prefers-reduced-motion:no-preference){
  .bid-card{ animation:bidIn .18s ease-out; }
  @keyframes bidIn{ from{ transform:translateY(8px); opacity:0; } }
}
`;let g=!1;function z(){if(g)return;g=!0;const t=document.createElement("style");t.textContent=N,document.head.appendChild(t)}function S(t={}){return new Promise(p=>{if(typeof document>"u"||E()||w()){p("");return}C(),z();const o=document.createElement("div");o.className="bid-veil";const r=document.createElement("div");r.className="bid-card",o.appendChild(r);let m=!1;if(typeof t.paint=="function"){const e=document.createElement("canvas");e.width=72,e.height=72,e.className="bid-face";try{t.paint(e),r.appendChild(e),m=!0}catch{}}if(!m){let e="";try{e=localStorage.getItem("ps-avatar-v1")||""}catch{}if(e){const i=new Image(72,72);i.className="bid-face",i.src=e,i.alt="",r.appendChild(i)}}const u=document.createElement("h2");u.textContent="What should we call you?";const f=document.createElement("p");f.textContent=(t.why?t.why+" ":"")+"Put a name on it and it rides everything you make here.";const d=document.createElement("p");d.className="bid-err",d.hidden=!0;const n=document.createElement("input");n.className="bid-in",n.maxLength=24,n.placeholder="your name",n.setAttribute("aria-label","Your name");const a=document.createElement("button");a.className="bid-go",a.type="button",a.textContent="That’s me",a.disabled=!0;const c=document.createElement("button");c.className="bid-skip",c.type="button",c.textContent="not now",r.append(u,f,d,n,a,c),document.body.appendChild(o),setTimeout(()=>{try{n.focus()}catch{}},30);let b=!1;const s=e=>{b||(b=!0,o.remove(),p(e))};n.addEventListener("input",()=>{a.disabled=!n.value.trim(),d.hidden=!0});const h=async()=>{const e=n.value.trim().slice(0,24);if(!e||a.disabled)return;a.disabled=!0;let i=!0;try{i=t.clean?await t.clean(e):!0}catch{i=!0}if(!i){d.textContent="Let’s keep it family friendly — try another one.",d.hidden=!1,a.disabled=!1,n.focus();return}try{localStorage.setItem(y,e)}catch{}try{v()}catch{}r.replaceChildren();const l=document.createElement("p");l.className="bid-done",l.textContent="✓ saved — hello, "+e,r.appendChild(l),setTimeout(()=>s(e),1100)};a.addEventListener("click",h),n.addEventListener("keydown",e=>{e.key==="Enter"&&h(),e.key==="Escape"&&s("")}),c.addEventListener("click",()=>s("")),o.addEventListener("click",e=>{e.target===o&&s("")})})}export{S as a};
