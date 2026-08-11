/* ===========================================================================
   LUMA — controller (app.js)   made by its.austin
   ANDROID / PWA build (codeword luma_an): same Spotify-style UI, themes,
   playlists and player as desktop Luma, but the engine runs 100% in the
   browser. Songs are opened via Android's file/folder picker and referenced
   in place; library, playlists, favourites and art persist in IndexedDB.
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
function fmt(s) { s = Math.max(0, s | 0); const m = Math.floor(s / 60), x = s % 60; return m + ":" + String(x).padStart(2, "0"); }
let toastT = null; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }

/* ---- themes ---- */
const TK = [["--bg", "Background"], ["--side", "Sidebar"], ["--panel", "Panels"], ["--accent", "Accent"], ["--text", "Text"], ["--text-bright", "Bright text"]];
const PRESETS = [
  { id: "verdant-dark", fam: "verdant", name: "Verdant", mode: "dark", desc: "Spotify green", v: { "--bg": "#0b0b10", "--bg2": "#08080c", "--side": "#0f1014", "--panel": "#15161c", "--panel2": "#1d1f27", "--hover": "#24262f", "--accent": "#1ed760", "--accent2": "#7bf0a3", "--accent-ink": "#04120a", "--text": "#e6e8ec", "--text-bright": "#ffffff", "--text-dim": "#9aa0aa", "--line": "rgba(255,255,255,0.07)" } },
  { id: "verdant-light", fam: "verdant", name: "Verdant", mode: "light", desc: "Daylight", v: { "--bg": "#f3f4f6", "--bg2": "#e6e8ec", "--side": "#eceef1", "--panel": "#ffffff", "--panel2": "#e9ebef", "--hover": "#dde0e5", "--accent": "#1aa64b", "--accent2": "#1aa64b", "--accent-ink": "#ffffff", "--text": "#3a4048", "--text-bright": "#0d1015", "--text-dim": "#6b7280", "--line": "rgba(0,0,0,0.08)" } },
  { id: "lumina-dark", fam: "lumina", name: "Lumina", mode: "dark", desc: "Racing blue", v: { "--bg": "#050507", "--bg2": "#030304", "--side": "#090a0f", "--panel": "#0f1119", "--panel2": "#171a24", "--hover": "#20242f", "--accent": "#3d82ff", "--accent2": "#8fb6ff", "--accent-ink": "#04102a", "--text": "#dfe4ea", "--text-bright": "#ffffff", "--text-dim": "#8890a0", "--line": "rgba(255,255,255,0.07)" } },
  { id: "ember-dark", fam: "ember", name: "Ember", mode: "dark", desc: "Warm amber", v: { "--bg": "#120d0a", "--bg2": "#0c0806", "--side": "#171009", "--panel": "#1e150e", "--panel2": "#2a1f14", "--hover": "#382a1b", "--accent": "#ff9a3d", "--accent2": "#ffc48a", "--accent-ink": "#241203", "--text": "#e8ddd2", "--text-bright": "#ffffff", "--text-dim": "#a2938a", "--line": "rgba(255,255,255,0.07)" } },
  { id: "orchid-dark", fam: "orchid", name: "Orchid", mode: "dark", desc: "Violet", v: { "--bg": "#0f0a16", "--bg2": "#0a0710", "--side": "#140d1e", "--panel": "#1a1128", "--panel2": "#241735", "--hover": "#2f2044", "--accent": "#c07bff", "--accent2": "#dcb3ff", "--accent-ink": "#1a0a2a", "--text": "#e2d8ee", "--text-bright": "#ffffff", "--text-dim": "#9b8fb0", "--line": "rgba(255,255,255,0.07)" } },
];
const FAMS = [...new Set(PRESETS.map(p => p.fam))].map(f => PRESETS.find(p => p.fam === f && p.mode === "dark"));
let themeValues = { ...PRESETS[0].v }, themePreset = "verdant-dark", themeMode = "dark", themeFam = "verdant";
function _hex(c){c=(c||"").trim();if(c.startsWith("#")){if(c.length===4)c="#"+c.slice(1).split("").map(x=>x+x).join("");return c.slice(0,7).toLowerCase();}const m=c.match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(",").map(Number);return"#"+[p[0],p[1],p[2]].map(x=>(x|0).toString(16).padStart(2,"0")).join("");}return"#000000";}
let saveT=null; function scheduleSave(){clearTimeout(saveT);saveT=setTimeout(()=>persistSettings(),200);}
function applyTheme(v,id,persist=true){themeValues={...v};themePreset=id||null;const p=PRESETS.find(x=>x.id===id);if(p){themeMode=p.mode;themeFam=p.fam;}const r=document.documentElement;Object.entries(themeValues).forEach(([k,val])=>{if(val!=null&&k.startsWith("--"))r.style.setProperty(k,val);});r.setAttribute("data-mode",themeMode);syncPickers();hiPreset();if(persist)scheduleSave();}
function syncPickers(){TK.forEach(([k])=>{let v=themeValues[k];if(v==null)v=getComputedStyle(document.documentElement).getPropertyValue(k).trim();const i=document.querySelector(`input[type=color][data-key="${k}"]`);if(i)i.value=_hex(v);const h=document.querySelector(`.hex[data-hex="${k}"]`);if(h)h.textContent=_hex(v);});}
function hiPreset(){$$(".preset").forEach(p=>p.classList.toggle("active",p.dataset.id===themePreset));$$("#modeToggle button").forEach(b=>b.classList.toggle("active",b.dataset.mode===themeMode));}
function presetFor(fam,mode){return PRESETS.find(p=>p.fam===fam&&p.mode===mode)||PRESETS.find(p=>p.fam===fam)||PRESETS[0];}
function buildAtelier(){
  const mt=$("#modeToggle");
  mt.innerHTML=`<button data-mode="dark">Dark</button><button data-mode="light">Light</button>`;
  $$("button",mt).forEach(b=>b.addEventListener("click",()=>{themeMode=b.dataset.mode;const p=presetFor(themeFam,themeMode);applyTheme({...p.v},p.id);buildAtelier();}));
  $("#presets").innerHTML=FAMS.map(f=>{const p=presetFor(f.fam,themeMode);return`<button class="preset" data-id="${p.id}"><div class="sw"><i style="background:${p.v["--bg"]}"></i><i style="background:${p.v["--panel"]}"></i><i style="background:${p.v["--accent"]}"></i></div><div class="pn">${esc(p.name)}</div><div class="pd">${esc(p.desc)}</div></button>`;}).join("");
  $$(".preset").forEach(b=>b.addEventListener("click",()=>{const p=PRESETS.find(x=>x.id===b.dataset.id);themeFam=p.fam;applyTheme({...p.v},p.id);toast(p.name+(p.mode==="light"?" · Light":""));}));
  $("#colorRows").innerHTML=TK.map(([k,l])=>`<div class="color-row"><label>${esc(l)}</label><span class="hex" data-hex="${k}"></span><input type="color" data-key="${k}" value="#000000"></div>`).join("");
  $$('#colorRows input[type=color]').forEach(i=>i.addEventListener("input",()=>{themeValues[i.dataset.key]=i.value;applyTheme(themeValues,null);}));
  renderWatched(); syncPickers(); hiPreset();
}
function renderWatched(){
  const w=(settings.watchedFolders||[]);
  $("#watched").innerHTML=w.length?w.map(p=>`<div class="w"><svg viewBox="0 0 24 24" width="15" height="15" style="stroke:var(--text-dim);fill:none;stroke-width:1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span class="p">${esc(p)}</span></div>`).join(""):`<div class="watched-empty">No folder opened yet. Tap <b>Open folder</b> to choose your music — Luma remembers it and re-scans on launch.</div>`;
}

/* ---- settings ---- */
let settings={};
async function loadSettings(){settings=await LumaDB.getSettings()||{};}
async function persistSettings(){settings.theme={values:themeValues,presetId:themePreset};await LumaDB.saveSettings(settings);}

/* ---- playlists ---- */
function playlists(){ if(!Array.isArray(settings.playlists))settings.playlists=[]; return settings.playlists; }
function getPlaylist(id){ return playlists().find(p=>p.id===id)||null; }
function createPlaylist(name){ const p={id:"pl_"+Math.random().toString(16).slice(2,10),name:(name||"New Playlist").trim()||"New Playlist",songs:[],createdAt:Date.now()}; playlists().push(p); persistSettings(); renderPlaylistNav(); return p; }
function renamePlaylist(id,name){ const p=getPlaylist(id); if(!p)return; p.name=(name||"").trim()||p.name; persistSettings(); renderPlaylistNav(); if(view==="playlist"&&curPlaylist===id)render(); }
function deletePlaylist(id){ const p=getPlaylist(id); if(!p)return; if(!confirm(`Delete playlist "${p.name}"? (Your songs stay in the library)`))return; settings.playlists=playlists().filter(x=>x.id!==id); persistSettings(); if(curPlaylist===id){curPlaylist=null;switchView("songs");} renderPlaylistNav(); toast("Playlist deleted"); }
function addToPlaylist(id,songId){ const p=getPlaylist(id); if(!p)return false; if(p.songs.includes(songId)){toast("Already in "+p.name);return false;} p.songs.push(songId); persistSettings(); renderPlaylistNav(); toast("Added to "+p.name); if(view==="playlist"&&curPlaylist===id)render(); return true; }
function removeFromPlaylist(id,songId){ const p=getPlaylist(id); if(!p)return; p.songs=p.songs.filter(s=>s!==songId); persistSettings(); renderPlaylistNav(); if(view==="playlist"&&curPlaylist===id)render(); toast("Removed from "+p.name); }
function renderPlaylistNav(){
  const el=$("#playlistList"); if(!el)return;
  const pls=playlists();
  el.innerHTML=pls.length?pls.map(p=>`<button class="pl-item ${view==="playlist"&&curPlaylist===p.id?"active":""}" data-pid="${p.id}"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span class="pl-name">${esc(p.name)}</span><span class="pl-count">${p.songs.length}</span><span class="pl-del" data-del="${p.id}" title="Delete playlist">✕</span></button>`).join(""):`<div class="pl-empty">No playlists yet</div>`;
  $$("#playlistList .pl-item").forEach(b=>{
    b.addEventListener("click",e=>{ if(e.target.closest("[data-del]")){e.stopPropagation();deletePlaylist(e.target.closest("[data-del]").dataset.del);return;} openPlaylist(b.dataset.pid); });
    b.addEventListener("dblclick",e=>{ if(e.target.closest("[data-del]"))return; const p=getPlaylist(b.dataset.pid); const nn=prompt("Rename playlist",p?p.name:""); if(nn!=null)renamePlaylist(b.dataset.pid,nn); });
  });
}
/* playlist picker popover */
function openPlPicker(songId,anchor){
  const pop=$("#plPicker"), body=$("#plPickerBody");
  const pls=playlists();
  body.innerHTML=pls.length?pls.map(p=>`<button class="pl-pick-row" data-pid="${p.id}"><span>${esc(p.name)}</span>${p.songs.includes(songId)?'<span class="pl-in">✓</span>':""}</button>`).join(""):`<div class="pl-empty" style="padding:8px 12px">No playlists yet</div>`;
  $$("#plPickerBody .pl-pick-row").forEach(r=>r.addEventListener("click",()=>{addToPlaylist(r.dataset.pid,songId);closePlPicker();}));
  $("#plPickerNew").onclick=()=>{const nn=prompt("New playlist name","My Playlist");if(nn!=null){const p=createPlaylist(nn);addToPlaylist(p.id,songId);}closePlPicker();};
  pop.hidden=false;
  const r=anchor.getBoundingClientRect();
  const inner=pop.querySelector(".pl-picker-inner");
  inner.style.top=Math.min(r.bottom+6,window.innerHeight-260)+"px";
  inner.style.left=Math.min(r.left,window.innerWidth-240)+"px";
  setTimeout(()=>document.addEventListener("mousedown",plPickerOutside),0);
}
function plPickerOutside(e){ if(!e.target.closest(".pl-picker-inner"))closePlPicker(); }
function closePlPicker(){ $("#plPicker").hidden=true; document.removeEventListener("mousedown",plPickerOutside); }

/* ---- library + engine ---- */
let all=[], view="songs", search="", sort="added", curAlbum=null, curPlaylist=null;
const engine = {
  audio:new Audio(), order:[], pos:-1, shuffle:false, repeat:0, vol:0.9, cur:null,
  init(){
    this.audio.preload="metadata"; this.audio.volume=this.vol;
    this.audio.addEventListener("play",()=>{renderPlay();document.body.classList.add("playing");markRow();});
    this.audio.addEventListener("pause",renderPlay);
    this.audio.addEventListener("ended",()=>this.next(true));
    this.audio.addEventListener("timeupdate",renderProgress);
    this.audio.addEventListener("loadedmetadata",()=>{ if(this.cur&&!this.cur.duration&&isFinite(this.audio.duration)){this.cur.duration=Math.round(this.audio.duration);LumaDB.update({id:this.cur.id,duration:this.cur.duration});} renderProgress(); });
  },
  play(ids,startId){ if(!ids||!ids.length)return; this.order=this.shuffle?this._shuf(ids,startId):ids.slice(); this.pos=startId?this.order.indexOf(startId):0; if(this.pos<0)this.pos=0; this._load(true); },
  _load(autoplay){ const t=byId.get(this.order[this.pos]); this.cur=t||null; if(!t)return; const url=LumaDB.fileUrl(t.id); if(!url){ toast("Re-open this folder to play — tap Add music"); renderNow(); return; } this.audio.src=url; if(autoplay)this.audio.play().catch(()=>{}); t.lastPlayed=Date.now(); t.playCount=(t.playCount||0)+1; LumaDB.update({id:t.id,playCount:t.playCount,lastPlayed:t.lastPlayed}); renderNow(); },
  toggle(){ if(!this.cur){ const ids=visibleIds(); if(ids.length)this.play(ids,ids[0]); return; } this.audio.paused?this.audio.play().catch(()=>{}):this.audio.pause(); },
  next(auto){ if(this.repeat===2&&auto){this.audio.currentTime=0;this.audio.play().catch(()=>{});return;} let n=this.pos+1; if(n>=this.order.length){ if(this.repeat===1||!auto)n=0; else{this.audio.pause();return;} } this.pos=n; this._load(true); },
  prev(){ if(this.audio.currentTime>3){this.audio.currentTime=0;return;} let n=this.pos-1; if(n<0)n=this.order.length-1; if(n<0)n=0; this.pos=n; this._load(true); },
  seek(f){ if(this.audio.duration)this.audio.currentTime=f*this.audio.duration; },
  setVol(v){ this.vol=v; this.audio.volume=v; settings.volume=v; scheduleSave(); renderVol(); },
  setShuffle(on){ this.shuffle=on; const cur=this.cur?this.cur.id:null; const ids=this.order.length?this.order.map(x=>x):visibleIds(); this.order=on?this._shuf(ids,cur):ids.slice(); this.pos=cur?this.order.indexOf(cur):this.pos; renderNow(); },
  cycleRepeat(){ this.repeat=(this.repeat+1)%3; renderNow(); },
  _shuf(ids,first){ const p=ids.filter(x=>x!==first); for(let i=p.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[p[i],p[j]]=[p[j],p[i]];} return first&&ids.includes(first)?[first,...p]:p; },
};
let byId=new Map();

/* media session (media keys) */
function wireMedia(){ if(!("mediaSession" in navigator))return; const set=(a,f)=>{try{navigator.mediaSession.setActionHandler(a,f);}catch(_){}}; set("play",()=>engine.toggle());set("pause",()=>engine.toggle());set("previoustrack",()=>engine.prev());set("nexttrack",()=>engine.next(false)); }
function mediaMeta(){ if(!("mediaSession" in navigator)||!engine.cur)return; const t=engine.cur; try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title||"",artist:t.artist||"",album:t.album||"",artwork:t.art?[{src:t.art,sizes:"512x512"}]:[]});}catch(_){}}

/* ---- data ---- */
async function refresh(){
  all=await LumaDB.getLibrary();
  for(const t of all){ if(!t.art){ const u=await LumaDB.artUrl(t.id); if(u)t.art=u; } }
  byId=new Map(all.map(t=>[t.id,t]));
  prunePlaylists();
  render();
  $("#statSongs").textContent=all.length;
}
function prunePlaylists(){ let changed=false; playlists().forEach(p=>{const before=p.songs.length;p.songs=p.songs.filter(id=>byId.has(id));if(p.songs.length!==before)changed=true;}); if(changed)persistSettings(); }
window.LumaApp={refresh:()=>refresh()};

function artHTML(t){ return t.art?`<img src="${esc(t.art)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=&quot;ph&quot;>♪</span>'))">`:`<span class="ph">♪</span>`; }
function sortList(l){
  if(sort==="title")l.sort((a,b)=>(a.title||"").localeCompare(b.title||""));
  else if(sort==="artist")l.sort((a,b)=>(a.artist||"").localeCompare(b.artist||"")||(a.title||"").localeCompare(b.title||""));
  else if(sort==="album")l.sort((a,b)=>(a.album||"").localeCompare(b.album||""));
  else if(sort==="plays")l.sort((a,b)=>(b.playCount||0)-(a.playCount||0));
  else l.sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));
  return l;
}
function currentList(){
  let l;
  if(view==="playlist"&&curPlaylist){
    const pl=getPlaylist(curPlaylist);
    const ids=pl?pl.songs:[];
    l=ids.map(id=>byId.get(id)).filter(Boolean); // preserve playlist order
  }else{
    l=all.slice();
    if(view==="favorites")l=l.filter(t=>t.favorite);
    if(curAlbum)l=l.filter(t=>(t.album||"(Unknown)")===curAlbum);
  }
  const q=search.trim().toLowerCase();
  if(q)l=l.filter(t=>((t.title||"")+" "+(t.artist||"")+" "+(t.album||"")).toLowerCase().includes(q));
  // playlists keep their own order unless a sort is chosen
  return (view==="playlist"&&sort==="added")?l:sortList(l);
}
const visibleIds=()=>currentList().map(t=>t.id);

function render(){
  const showList=view==="songs"||view==="favorites"||view==="playlist";
  $("#listwrap").hidden=!showList; $("#albums").hidden=view!=="albums"; $("#atelier").hidden=view!=="atelier"; $("#hero").hidden=view==="atelier"; const tb=document.querySelector(".toolbar"); if(tb)tb.hidden=view==="atelier";
  renderPlaylistNav();
  if(view==="albums"){renderAlbums();return;}
  if(view==="atelier")return;
  const l=currentList();
  const pl=(view==="playlist"&&curPlaylist)?getPlaylist(curPlaylist):null;
  $("#heroKicker").textContent=view==="favorites"?"COLLECTION":(view==="playlist"?"PLAYLIST":(curAlbum?"ALBUM":"YOUR LIBRARY"));
  $("#heroTitle").textContent=pl?pl.name:(curAlbum?curAlbum:(view==="favorites"?"Favourites":"All Songs"));
  $("#heroSub").textContent=l.length+" song"+(l.length===1?"":"s");
  const listEl=$("#list");
  listEl.innerHTML=l.map((t,i)=>rowHTML(t,i)).join("");
  // empty state: hide for playlists (they can legitimately be empty) unless library itself empty
  const emptyLibrary=all.length===0;
  const emptyPlaylist=view==="playlist"&&l.length===0&&!emptyLibrary;
  $("#emptyState").hidden=!emptyLibrary&&!emptyPlaylist;
  if(emptyLibrary){$("#emptyH").textContent="No songs yet";$("#emptyP").innerHTML='Tap <b>Open folder</b> to point Luma at your music, or <b>Add songs</b> to pick individual tracks. Luma plays them straight from your phone — nothing is copied.';$(".empty-actions").style.display="";}
  else if(emptyPlaylist){$("#emptyH").textContent="This playlist is empty";$("#emptyP").innerHTML='Add songs with the <b>＋</b> button on any track, then come back here.';$(".empty-actions").style.display="none";}
  $$("#list .row").forEach(row=>{
    const id=row.dataset.id;
    row.addEventListener("click",e=>{ if(e.target.closest("[data-act=fav]")){e.stopPropagation();toggleFav(id);return;} if(e.target.closest("[data-act=add]")){e.stopPropagation();openPlPicker(id,e.target.closest("[data-act=add]"));return;} if(e.target.closest("[data-act=plrm]")){e.stopPropagation();removeFromPlaylist(curPlaylist,id);return;} if(e.target.closest("[data-act=rm]")){e.stopPropagation();removeSong(id);return;} engine.play(visibleIds(),id); });
  });
  markRow();
}
function rowHTML(t,i){
  const playing=engine.cur&&engine.cur.id===t.id;
  return `<div class="row ${playing?"playing":""}" data-id="${t.id}">
    <span class="r-idx"><span class="num">${i+1}</span><span class="play">▶</span></span>
    <div class="r-main"><div class="r-art">${artHTML(t)}</div><div class="r-txt"><div class="r-title">${esc(t.title)}</div><div class="r-artist">${esc(t.artist||"Unknown Artist")}</div></div></div>
    <div class="r-album">${esc(t.album||"")}</div>
    <div class="r-plays">${t.playCount||0}</div>
    <div class="r-dur">${t.duration?fmt(t.duration):"—"}</div>
    <div class="r-act"><button class="r-fav ${t.favorite?"on":""}" data-act="fav" title="Favourite"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button><button class="r-add" data-act="add" title="Add to playlist"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>${curPlaylist?`<button class="r-menu" data-act="plrm" title="Remove from playlist">✕</button>`:`<button class="r-menu" data-act="rm" title="Remove">✕</button>`}</div>
  </div>`;
}
function renderAlbums(){
  const map=new Map();
  all.forEach(t=>{const k=t.album||"(Unknown Album)"; if(!map.has(k))map.set(k,{name:k,art:null,count:0,artist:t.artist}); const a=map.get(k); a.count++; if(!a.art&&t.art)a.art=t.art;});
  const albums=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
  $("#heroKicker").textContent="YOUR LIBRARY"; $("#heroTitle").textContent="Albums"; $("#heroSub").textContent=albums.length+" album"+(albums.length===1?"":"s");
  $("#albums").innerHTML=albums.map(a=>`<div class="album" data-album="${esc(a.name)}"><div class="album-art">${a.art?`<img src="${esc(a.art)}">`:`<span class="ph">♪</span>`}</div><div class="album-name">${esc(a.name)}</div><div class="album-sub">${a.count} song${a.count===1?"":"s"}</div></div>`).join("");
  $$("#albums .album").forEach(el=>el.addEventListener("click",()=>{curAlbum=el.dataset.album;view="songs";setNav("songs");render();}));
}
function markRow(){ $$("#list .row").forEach(r=>r.classList.toggle("playing",engine.cur&&r.dataset.id===engine.cur.id)); }

function renderNow(){
  const t=engine.cur; if(!t){$("#nowbar").classList.add("hidden");document.body.classList.remove("playing");return;}
  $("#nowbar").classList.remove("hidden"); document.body.classList.add("playing");
  $("#nbArt").innerHTML=artHTML(t);
  $("#nbTitle").textContent=t.title; $("#nbArtist").textContent=t.artist||"Unknown Artist";
  $("#nbFav").classList.toggle("on",!!t.favorite);
  $("#nbShuffle").classList.toggle("on",engine.shuffle);
  const rp=$("#nbRepeat"); rp.classList.toggle("on",engine.repeat!==0); rp.title="Repeat: "+["off","all","one"][engine.repeat];
  $("#nbDur").textContent=t.duration?fmt(t.duration):"0:00";
  renderPlay(); renderVol(); mediaMeta(); markRow();
}
function renderPlay(){ const p=engine.cur&&!engine.audio.paused; const svg=p?'<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>':'<svg viewBox="0 0 24 24"><polygon points="7 4 20 12 7 20 7 4"/></svg>'; $("#nbPlay").innerHTML=svg; }
function renderProgress(){ const d=engine.audio.duration,c=engine.audio.currentTime; const f=d&&isFinite(d)?c/d:0; const s=$("#nbSeek"); if(document.activeElement!==s)s.value=Math.round(f*1000); $("#nbCur").textContent=fmt(c); if(engine.cur&&d)$("#nbDur").textContent=fmt(d); }
function renderVol(){ const muted=engine.audio.muted||engine.vol===0; $("#nbVol").value=Math.round((muted?0:engine.vol)*100); $("#nbMute").innerHTML=muted?'<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>':'<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>'; }

/* ---- actions ---- */
async function toggleFav(id){const t=byId.get(id);if(!t)return;t.favorite=!t.favorite;await LumaDB.update({id,favorite:t.favorite});render();if(engine.cur&&engine.cur.id===id)$("#nbFav").classList.toggle("on",t.favorite);}
async function removeSong(id){const t=byId.get(id);if(!t)return;if(!confirm(`Remove "${t.title}" from Luma? (The file stays on disk)`))return;await LumaDB.remove(id);all=all.filter(x=>x.id!==id);byId.delete(id);render();$("#statSongs").textContent=all.length;toast("Removed");}

/* ---- add music (Android/browser) ----
   Two paths: (1) the File System Access API (showDirectoryPicker) gives a true
   persistent, re-scannable folder handle — used automatically where supported
   (some Chrome/desktop). (2) Everywhere else on Android we use a plain file
   input (with webkitdirectory for folders) — songs are still referenced in
   place for the session, and the library re-links by path next launch. */

/* pick individual song files */
function addFiles(){ const inp=$("#filePick"); inp.value=""; inp.click(); }
async function onFilePick(){
  const inp=$("#filePick");
  const list=Array.from(inp.files||[]).filter(Boolean);
  if(!list.length){toast("No file selected");return;}
  await ingestFiles(list,"");
}
async function onFolderPick(){
  const inp=$("#folderPick");
  const list=Array.from(inp.files||[]).filter(Boolean);
  if(!list.length)return;
  const root=(list[0].webkitRelativePath||"").split("/")[0]||"Folder";
  addWatchedRoot(root);
  toast("Scanning "+root+"…");
  await ingestFiles(list,root);
}

/* pick / "watch" a whole folder */
async function watchFolder(){
  // Preferred: real directory handle (persistent, re-scannable)
  if(LumaDB.supportsHandles){
    try{
      const dir=await window.showDirectoryPicker();
      await LumaDB.saveDirHandle(dir);
      toast("Scanning "+dir.name+"…");
      const files=await collectFromDir(dir);
      addWatchedRoot(dir.name);
      await ingestFiles(files,dir.name);
      return;
    }catch(e){ if(e&&e.name==="AbortError")return; /* fall through to input */ }
  }
  // Fallback: folder file-input (Android Chrome)
  const inp=$("#folderPick"); inp.value=""; inp.click();
}

/* recursively read every file from a directory handle */
async function collectFromDir(dir,prefix){
  const out=[]; prefix=prefix||"";
  for await(const [name,handle] of dir.entries()){
    if(handle.kind==="file"){ try{ const f=await handle.getFile(); f.relPath=(prefix?prefix+"/":"")+name; out.push(f);}catch(_){}}
    else if(handle.kind==="directory"){ try{ const sub=await collectFromDir(handle,(prefix?prefix+"/":"")+name); out.push(...sub);}catch(_){}}
  }
  return out;
}

/* shared ingest: register files, enrich tags, refresh UI */
async function ingestFiles(list,rootLabel){
  const r=await LumaDB.ingest(list,rootLabel);
  await refresh();
  const n=(r.added&&r.added.length)||0;
  toast(n?(n+" song"+(n===1?"":"s")+" added"):"Songs re-linked");
  if(r.added&&r.added.length)await enrichNew(r.added.slice(0,120));
}

function addWatchedRoot(name){ if(!name)return; const w=settings.watchedFolders||(settings.watchedFolders=[]); if(!w.includes(name)){w.push(name);persistSettings();renderWatched();} }

/* re-scan the saved directory handle on launch (persistent watch) */
async function rescanSavedHandle(){
  if(!LumaDB.supportsHandles)return;
  const dir=await LumaDB.getDirHandle(); if(!dir)return;
  try{
    if(dir.queryPermission){ const st=await dir.queryPermission({mode:"read"}); if(st!=="granted")return; }
    const files=await collectFromDir(dir);
    if(files.length)await ingestFiles(files,dir.name);
  }catch(_){}
}

/* read embedded tags (title/artist/album/art) + duration for freshly added songs */
async function enrichNew(list){
  for(const rec of list){
    try{
      const blob=LumaDB.fileObj(rec.id); if(!blob)continue;      // live File, in place
      const meta=await readTags(blob);
      const fields={id:rec.id};
      if(meta){ if(meta.title&&!(rec._edited||[]).includes("title"))fields.title=meta.title; if(meta.artist)fields.artist=meta.artist; if(meta.album)fields.album=meta.album; if(meta.art){const url=await LumaDB.storeArt(rec.id,await downscale(meta.art));if(url)fields.art=url;} }
      const dur=await probeDur(blob); if(dur)fields.duration=dur;
      if(Object.keys(fields).length>1){ await LumaDB.update(fields); const t=byId.get(rec.id); if(t)Object.assign(t,fields); }
    }catch(_){}
  }
  render();
}
function readTags(file){return new Promise(res=>{ if(!window.jsmediatags)return res(null); let done=false;const fin=v=>{if(!done){done=true;res(v);}}; try{ window.jsmediatags.read(file,{onSuccess:r=>{const tg=(r&&r.tags)||{};let art=null; if(tg.picture&&tg.picture.data){try{const b=tg.picture.data;const u=b instanceof Uint8Array?b:new Uint8Array(b);let s="";for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);art="data:"+(tg.picture.format||"image/jpeg")+";base64,"+btoa(s);}catch(_){}} fin({title:tg.title||"",artist:tg.artist||"",album:tg.album||"",art});},onError:()=>fin(null)}); setTimeout(()=>fin(null),6000);}catch(_){fin(null);} });}
function downscale(dataUrl,max=320){return new Promise(res=>{const img=new Image();img.onload=()=>{try{const r=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);c.getContext("2d").drawImage(img,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",0.82));}catch(_){res(dataUrl);}};img.onerror=()=>res(dataUrl);img.src=dataUrl;});}
function probeDur(blob){return new Promise(res=>{const a=new Audio();const u=URL.createObjectURL(blob);let done=false;const fin=v=>{if(done)return;done=true;URL.revokeObjectURL(u);res(v);};a.preload="metadata";a.src=u;a.onloadedmetadata=()=>fin(isFinite(a.duration)?Math.round(a.duration):0);a.onerror=()=>fin(0);setTimeout(()=>fin(0),4000);});}

/* ---- nav / window ---- */
function setNav(v){$$(".nav-pill").forEach(p=>p.classList.toggle("active",p.dataset.view===v));}
function switchView(v){ if(v!=="songs")curAlbum=null; curPlaylist=null; view=v; setNav(v); render(); }
function openPlaylist(pid){ curPlaylist=pid; curAlbum=null; view="playlist"; setNav(null); render(); }
/* mobile navigation drawer */
function openDrawer(){document.body.classList.add("drawer-open");}
function closeDrawer(){document.body.classList.remove("drawer-open");}

async function vaultInfo(){const el=$("#vaultInfo");if(!el)return;const persistent=LumaDB.supportsHandles?"This device supports persistent folder watching — the chosen folder is re-scanned automatically each launch.":"On this device Luma re-opens songs from the file picker; your library, playlists and art are remembered, and you re-open the folder to play.";el.innerHTML="Songs are <b>referenced in place — never copied</b>. Your library, favourites, playlists and generated art live in this app's private storage on the phone. "+persistent;}

/* ---- boot ---- */
function runBoot(){const boot=$("#boot"),app=$("#app");setTimeout(()=>{boot.classList.add("fade-out");app.classList.add("ready");setTimeout(()=>boot.remove(),500);},1000);}

/* ---- init ---- */
async function init(){
  try{runBoot();}catch(_){$("#boot")?.remove();$("#app").classList.add("ready");}
  await LumaDB.open();
  await loadSettings();
  const t=settings.theme; if(t&&t.values)applyTheme(t.values,t.presetId,false);else applyTheme({...PRESETS[0].v},PRESETS[0].id,false);
  engine.init(); wireMedia();
  if(typeof settings.volume==="number"){engine.vol=settings.volume;engine.audio.volume=settings.volume;}
  buildAtelier();
  renderPlaylistNav();

  const on=(id,fn)=>{const e=$(id);if(e)e.addEventListener("click",fn);};
  $$(".nav-pill").forEach(p=>p.addEventListener("click",()=>{switchView(p.dataset.view);closeDrawer();}));
  // mobile drawer (hamburger)
  on("#menuBtn",openDrawer); on("#scrim",closeDrawer);
  $("#searchInput").addEventListener("input",e=>{search=e.target.value;render();});
  $("#sortSel").addEventListener("change",e=>{sort=e.target.value;render();});
  on("#refreshBtn",async()=>{await rescanSavedHandle();await refresh();toast("Refreshed");});
  on("#addFilesBtn",()=>{addFiles();closeDrawer();}); on("#emptyAdd",addFiles);
  on("#addFolderBtn",()=>{watchFolder();closeDrawer();}); on("#emptyWatch",watchFolder);
  on("#topAdd",watchFolder);
  $("#filePick").addEventListener("change",onFilePick);
  $("#folderPick").addEventListener("change",onFolderPick);
  on("#newPlaylistBtn",()=>{const nn=prompt("New playlist name","My Playlist");if(nn!=null){const p=createPlaylist(nn);openPlaylist(p.id);}});
  on("#playAll",()=>{const ids=visibleIds();if(ids.length){engine.shuffle=false;$("#shuffleAll").classList.remove("on");engine.play(ids,ids[0]);}});
  on("#shuffleAll",()=>{const ids=visibleIds();if(ids.length){engine.shuffle=true;$("#shuffleAll").classList.add("on");engine.play(ids,ids[Math.floor(Math.random()*ids.length)]);}});

  // now bar
  on("#nbPlay",()=>engine.toggle()); on("#nbNext",()=>engine.next(false)); on("#nbPrev",()=>engine.prev());
  on("#nbShuffle",()=>engine.setShuffle(!engine.shuffle)); on("#nbRepeat",()=>engine.cycleRepeat());
  on("#nbFav",()=>engine.cur&&toggleFav(engine.cur.id));
  on("#nbMute",()=>{engine.audio.muted=!engine.audio.muted;renderVol();});
  $("#nbSeek").addEventListener("input",e=>engine.seek((+e.target.value)/1000));
  $("#nbVol").addEventListener("input",e=>{engine.audio.muted=false;engine.setVol((+e.target.value)/100);});

  // atelier prefs
  on("#resetTheme",()=>{});
  $("#prefAutoscan").checked=settings.autoscan!==false;
  $("#prefAutoscan").addEventListener("change",e=>{settings.autoscan=e.target.checked;persistSettings();});

  // keyboard
  window.addEventListener("keydown",e=>{
    if(e.target.tagName==="INPUT")return;
    if(e.key===" "){e.preventDefault();engine.toggle();}
    else if(e.key==="ArrowRight"&&e.ctrlKey)engine.next(false);
    else if(e.key==="ArrowLeft"&&e.ctrlKey)engine.prev();
    else if(e.key==="/"){e.preventDefault();switchView("songs");$("#searchInput").focus();}
    else if(e.key==="MediaPlayPause")engine.toggle();
    else if(e.key==="MediaTrackNext")engine.next(false);
    else if(e.key==="MediaTrackPrevious")engine.prev();
  });

  // drag & drop
  const dz=$("#dropzone");let dc=0;
  window.addEventListener("dragover",e=>{e.preventDefault();});
  window.addEventListener("dragenter",e=>{e.preventDefault();dc++;dz.classList.add("show");});
  window.addEventListener("dragleave",e=>{dc=Math.max(0,dc-1);if(!dc)dz.classList.remove("show");});
  window.addEventListener("drop",async e=>{
    e.preventDefault();dc=0;dz.classList.remove("show");
    const files=Array.from(e.dataTransfer.files||[]).filter(Boolean);
    if(files.length){ await ingestFiles(files,""); }
  });

  // LOAD SAVED LIBRARY, then try to re-scan the saved folder (persistent watch)
  await refresh();
  await rescanSavedHandle();
  // enrich songs still missing tags/art (first ~80 that we hold live files for)
  enrichNew(all.filter(t=>(!t.duration||!t.art)&&LumaDB.hasFile(t.id)).slice(0,80));
  await vaultInfo();
}
document.addEventListener("DOMContentLoaded",init);
