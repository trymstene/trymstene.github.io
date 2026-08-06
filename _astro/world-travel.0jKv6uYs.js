import{g as M,l as _}from"./banana-pass.1Skze-nB.js";const k=`
.wh {
  display: flex; gap: 5px; align-items: center; justify-content: flex-end;
  flex-wrap: wrap;
  --wh-bg: rgba(14, 22, 14, 0.82);
  --wh-border: #000;
  --wh-text: #fffdf5;
  --wh-accent: #ffe135;
}
/* over the map (park, bay, and the default for anything new) */
.wh--overlay { position: absolute; top: 8px; right: 8px; z-index: 9; max-width: calc(100% - 16px); }
/* an in-flow band above the scene (the club, whose floor is too short to cover) */
.wh--strip { padding: 4px 7px; }
.wh > * {
  margin: 0; height: 27px; box-sizing: border-box; display: flex; align-items: center;
  gap: 5px; background: var(--wh-bg); border: 2px solid var(--wh-border);
  border-radius: 6px; padding: 0 9px; font-weight: 800; font-size: 0.76rem;
  line-height: 1; color: var(--wh-text); white-space: nowrap;
}
.wh__lvl { color: var(--wh-accent); border-color: var(--wh-accent) !important; }
.wh__lvlbar {
  flex: 0 0 42px; min-width: 42px; height: 6px; background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.6); border-radius: 3px; overflow: hidden;
}
.wh__lvlbar i { display: block; height: 100%; width: 0; background: var(--wh-accent); transition: width 0.5s ease; }
.wh__coins img { display: block; image-rendering: pixelated; }
.wh__coins b, .wh__tix b { color: var(--wh-accent); }
.wh__crowd { color: #8affc0; }
/* a chip with nothing to say takes no room — the bay's rally line, mostly */
.wh__slot:empty { display: none; }
@media (prefers-reduced-motion: reduce) { .wh__lvlbar i { transition: none; } }
`;let b=!1;function E(){if(b)return;b=!0;const t=document.createElement("style");t.textContent=k,document.head.appendChild(t)}const S=()=>{const t=M().stats||{};return Math.max(0,(t.coins_earned||0)-(t.coins_spent||0))};function O({mount:t,layout:h="overlay",theme:s={},chips:p=["lvl","coins","crowd"],values:l={},adopt:i=[]}={}){if(!t)return null;E();const e=document.createElement("div");e.className="wh wh--"+h,s.bg&&e.style.setProperty("--wh-bg",s.bg),s.border&&e.style.setProperty("--wh-border",s.border),s.text&&e.style.setProperty("--wh-text",s.text),s.accent&&e.style.setProperty("--wh-accent",s.accent);const a={},r=(n,c)=>{const d=document.createElement("span");return d.className="wh__"+n,d.innerHTML=c,e.appendChild(d),d};for(const n of p)n==="lvl"?a.lvl=r("lvl",'<span class="wh__lvln">LVL 1</span><span class="wh__lvlbar"><i></i></span>'):n==="coins"?a.coins=r("coins",'<img src="/assets/banana-stand/coin.png" width="16" height="16" alt="" /><b>0</b>'):n==="tix"?a.tix=r("tix","🎟 <b>0</b>"):n==="slot"?a.slot=r("slot",""):n==="crowd"&&(a.crowd=r("crowd",'<span aria-hidden="true">◍</span> <span class="wh__crowdn">solo</span>'));i.forEach(n=>{n&&e.appendChild(n)}),t.appendChild(e);const o=a.lvl&&a.lvl.querySelector(".wh__lvln"),v=a.lvl&&a.lvl.querySelector(".wh__lvlbar i"),f=a.coins&&a.coins.querySelector("b"),g=a.tix&&a.tix.querySelector("b"),m=a.crowd&&a.crowd.querySelector(".wh__crowdn");function w(){const n=M().stats||{};if(o){const c=_(n.rep||0);o.textContent="LVL "+c.level,v&&(v.style.width=Math.round(c.into/c.need*100)+"%")}f&&(f.textContent=S()),g&&l.tix&&(g.textContent=l.tix())}setTimeout(w,0);const y=setInterval(()=>{document.hidden||w()},1e3);return{el:e,refresh:w,setCrowd:n=>{m&&(m.textContent=n)},setSlot:n=>{a.slot&&(a.slot.textContent=n||"")},stop:()=>clearInterval(y)}}const u={rave:{icon:"🪩",name:"The Rave"},park:{icon:"🌳",name:"The Park"},beach:{icon:"🏖",name:"Banana Bay"}},C=["rave","park","beach"];function T(t,h){return t==="park"?"/park/?"+h:t==="beach"?h==="rave"?"/beach/?from=rave":"/beach/?park":"/rave/"}const x='<svg viewBox="0 0 8 15" width="16" height="30" shape-rendering="crispEdges" class="wt-door" aria-hidden="true" focusable="false"><path fill="#3a2918" d="M0 0h8v1h-8zM0 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM7 6h1v1h-1zM0 7h1v1h-1zM7 7h1v1h-1zM0 8h1v1h-1zM7 8h1v1h-1zM0 9h1v1h-1zM7 9h1v1h-1zM0 10h1v1h-1zM7 10h1v1h-1zM0 11h1v1h-1zM7 11h1v1h-1zM0 12h1v1h-1zM7 12h1v1h-1zM0 13h1v1h-1zM7 13h1v1h-1zM0 14h8v1h-8z"/><path fill="#5f3d1c" d="M2 2h4v1h-4zM2 3h1v1h-1zM5 3h1v1h-1zM2 4h1v1h-1zM5 4h1v1h-1zM2 5h4v1h-4zM2 9h4v1h-4zM2 10h1v1h-1zM5 10h1v1h-1zM2 11h1v1h-1zM5 11h1v1h-1zM2 12h4v1h-4z"/><path fill="#8a5a2b" d="M1 1h6v1h-6zM1 2h1v1h-1zM6 2h1v1h-1zM1 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM6 5h1v1h-1zM1 6h6v1h-6zM1 7h4v1h-4zM6 7h1v1h-1zM1 8h6v1h-6zM1 9h1v1h-1zM6 9h1v1h-1zM1 10h1v1h-1zM6 10h1v1h-1zM1 11h1v1h-1zM6 11h1v1h-1zM1 12h1v1h-1zM6 12h1v1h-1zM1 13h6v1h-6z"/><path fill="#a6713a" d="M3 3h2v1h-2zM3 4h2v1h-2zM3 10h2v1h-2zM3 11h2v1h-2z"/><path fill="#ffe135" d="M5 7h1v1h-1z"/></svg>',L=`
.wt-btn { display:inline-flex; align-items:center; justify-content:center; gap:0.35rem; }
.wt-btn svg, .wt-card h2 svg { display:block; }
/* ⚠️ THE DOOR'S SIZE IS NOT NEGOTIABLE. Host bars size their own icons — the
   rave squares every button SVG with \`.rv-emote-btn svg { width:1.25em;
   height:1.25em }\` — and an 8x15 door forced into a square is a squashed door.
   Two classes + a type out-specifies any one-class host rule, so this wins
   without !important and without the module knowing which bar it landed in.
   16x30 is an exact 2x of the art; anything else lands rows on half-pixels. */
.wt-btn svg.wt-door, .wt-card h2 svg.wt-door { width:16px; height:30px; }
.wt-card h2 { display:flex; align-items:center; gap:0.4rem; }
.wt-veil {
  position:fixed; inset:0; z-index:70; display:grid; place-items:center;
  background:rgba(4,8,4,0.74); padding:1rem;
}
.wt-veil[hidden] { display:none; }
.wt-card {
  width:min(420px,100%); background:#14240f; color:#fffdf5;
  border:4px solid #000; box-shadow:8px 8px 0 #000; padding:1rem 1rem 1.1rem;
}
.wt-card h2 {
  margin:0 0 0.15rem; font-size:1.05rem; color:#ffe135; letter-spacing:0.02em;
}
.wt-card p.wt-sub { margin:0 0 0.85rem; font-size:0.78rem; opacity:0.75; }
.wt-list { display:grid; gap:0.55rem; }
.wt-go {
  display:flex; align-items:center; gap:0.7rem; width:100%; cursor:pointer;
  padding:0.7rem 0.8rem; border:3px solid #000; box-shadow:3px 3px 0 #000;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  font-family:inherit; text-align:left; text-decoration:none;
}
.wt-go:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
.wt-go__icon { font-size:1.35rem; line-height:1; }
.wt-go__name { font-size:1rem; font-weight:800; white-space:nowrap; }
.wt-go__arrow { margin-left:auto; font-size:1.1rem; font-weight:800; }
.wt-close {
  appearance:none; width:100%; margin-top:0.8rem; cursor:pointer; font-family:inherit;
  background:#182a16; color:#fffdf5; border:3px solid #000; box-shadow:3px 3px 0 #000;
  font-weight:800; font-size:0.86rem; padding:0.5rem;
}
.wt-close:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
/* 🛍 THE SHOP is NOT an area — it is the way out of the world to a real thing,
   so it sits under a rule and wears paper instead of the areas' yellow. Reading
   it as a fourth place would blur the one line this project keeps sharp:
   bananacoins buy cosmetics, money buys objects. */
.wt-sep {
  margin:0.85rem 0 0.6rem; border:0; border-top:2px dashed rgba(255,253,245,0.22);
}
.wt-go--shop { background:#fffdf5; color:#141414; }
@media (prefers-reduced-motion:reduce) { .wt-go, .wt-close { transition:none; } }
`;let z=!1;function N(){if(z)return;z=!0;const t=document.createElement("style");t.textContent=L,document.head.appendChild(t)}function H({here:t,mount:h,before:s,btnClass:p,track:l}){if(!h)return;N();const i=document.createElement("button");i.type="button",i.className=(p||"")+" wt-btn",i.id="wtBtn",i.setAttribute("aria-label","travel to another area"),i.innerHTML=x;const e=document.createElement("div");e.className="wt-veil",e.hidden=!0;const a=C.filter(o=>o!==t);e.innerHTML='<div class="wt-card" role="dialog" aria-modal="true" aria-label="Travel"><h2>'+x+' where to?</h2><p class="wt-sub">the roads still work — this is the shortcut.</p><div class="wt-list">'+a.map(o=>'<a class="wt-go" href="'+T(o,t)+'" data-to="'+o+'"><span class="wt-go__icon">'+u[o].icon+'</span><span class="wt-go__name">'+u[o].name+'</span><span class="wt-go__arrow">→</span></a>').join("")+'</div><hr class="wt-sep"><div class="wt-list"><a class="wt-go wt-go--shop" href="/forge/items/" data-to="items"><span class="wt-go__icon">🎁</span><span class="wt-go__name">Items Workshop</span><span class="wt-go__arrow">→</span></a><a class="wt-go wt-go--shop" href="/shop/" data-to="shop"><span class="wt-go__icon">🛍</span><span class="wt-go__name">The Shop</span><span class="wt-go__arrow">→</span></a></div><button class="wt-close" type="button">stay here</button></div>';const r=()=>{e.hidden=!0};return i.addEventListener("click",()=>{e.hidden=!1,l&&l("travel_open",{from:t})}),e.addEventListener("click",o=>{o.target===e&&r()}),e.querySelector(".wt-close").addEventListener("click",r),addEventListener("keydown",o=>{o.key==="Escape"&&!e.hidden&&r()}),e.querySelectorAll(".wt-go").forEach(o=>{o.addEventListener("click",()=>{l&&l("travel_go",{from:t,to:o.dataset.to})})}),h.insertBefore(i,s&&s.parentNode===h?s:null),document.body.appendChild(e),{open:()=>{e.hidden=!1},close:r}}export{S as c,H as i,O as m};
