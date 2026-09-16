/* ===========================================================================
   LUMA — extra views (views.js)   made by its.austin
   Home / Made For You, Artists + artist pages, Wrapped-style stats, the
   full-screen Now Playing screen, the Play Queue panel, and the Playback +
   Equalizer settings panel. All work on YOUR local library, offline.
   ========================================================================= */

/* small helpers */
function cardArt(t){ return t&&t.art?`<img src="${esc(t.art)}" loading="lazy">`:`<span class="ph">♪</span>`; }
function songById(id){ return byId.get(id); }
function playFrom(ids,startId){ if(ids&&ids.length)engine.play(ids,startId||ids[0]); }

/* ---------------- HOME / MADE FOR YOU ---------------- */
function topArtists(limit){
  const m=new Map();
  all.forEach(t=>{const a=(t.artist||"Unknown Artist");const e=m.get(a)||{name:a,plays:0,count:0,art:null};e.plays+=t.playCount||0;e.count++;if(!e.art&&t.art)e.art=t.art;m.set(a,e);});
  return [...m.values()].sort((a,b)=>b.plays-a.plays||b.count-a.count).slice(0,limit||12);
}
function dailyMixes(){
  // build up to 4 "mixes" seeded on the most-played artists (Spotify-style Daily Mix)
  const arts=topArtists(20).filter(a=>a.count>=2);
  const mixes=[];
  const used=new Set();
  for(const a of arts){
    if(mixes.length>=4)break;
    let songs=all.filter(t=>(t.artist||"Unknown Artist")===a.name);
    // fold in a few tracks from similar (same album-mates / next artists) for variety
    if(songs.length<8){ const extra=all.filter(t=>!used.has(t.id)&&(t.artist||"")!==a.name).slice(0,8-songs.length); songs=songs.concat(extra); }
    songs=engine._shuf(songs.map(t=>t.id)).map(id=>byId.get(id)).filter(Boolean).slice(0,30);
    if(songs.length<4)continue;
    songs.forEach(t=>used.add(t.id));
    mixes.push({id:"mix_"+mixes.length,name:"Daily Mix "+(mixes.length+1),sub:a.name+" and more",art:(songs.find(s=>s.art)||{}).art||null,ids:songs.map(s=>s.id)});
  }
  return mixes;
}
let _mixCache=null;
function getMixes(){ if(!_mixCache)_mixCache=dailyMixes(); return _mixCache; }
function invalidateMixes(){ _mixCache=null; }

function renderHome(){
  const el=$("#home"); if(!el)return;
  const rec=recentlyPlayed();
  const mixes=getMixes();
  const arts=topArtists(10);
  const hi=(settings.history||[]).length;
  const hours=Math.round(((settings.totalSeconds||0)/3600)*10)/10;
  let html="";
  html+=`<div class="home-hello"><h1>Good ${timeOfDay()}</h1><p class="home-sub">${all.length} songs · ${hours}h listened</p></div>`;
  if(rec.length){
    html+=`<div class="quicks">${rec.slice(0,8).map(t=>`<button class="quick" data-play="${t.id}"><div class="quick-art">${cardArt(t)}</div><span>${esc(t.title)}</span></button>`).join("")}</div>`;
  }
  if(mixes.length){
    html+=`<div class="sec-row"><h2>Made for you</h2></div><div class="shelf">${mixes.map(m=>`<button class="scard" data-mix="${m.id}"><div class="scard-art mix">${m.art?`<img src="${esc(m.art)}">`:`<span class="ph">♪</span>`}<span class="mix-tag">MIX</span></div><div class="scard-name">${esc(m.name)}</div><div class="scard-sub">${esc(m.sub)}</div></button>`).join("")}</div>`;
  }
  if(rec.length){
    html+=`<div class="sec-row"><h2>Recently played</h2></div><div class="shelf">${rec.map(t=>`<button class="scard" data-play="${t.id}"><div class="scard-art">${cardArt(t)}</div><div class="scard-name">${esc(t.title)}</div><div class="scard-sub">${esc(t.artist||"Unknown Artist")}</div></button>`).join("")}</div>`;
  }
  if(arts.length){
    html+=`<div class="sec-row"><h2>Your top artists</h2><button class="see-all" data-goto="artists">See all</button></div><div class="shelf">${arts.map(a=>`<button class="scard" data-artist="${esc(a.name)}"><div class="scard-art round">${a.art?`<img src="${esc(a.art)}">`:`<span class="ph">♪</span>`}</div><div class="scard-name">${esc(a.name)}</div><div class="scard-sub">${a.count} song${a.count===1?"":"s"}</div></button>`).join("")}</div>`;
  }
  html+=`<div class="sec-row"><h2>Your year in music</h2><button class="see-all" data-goto="wrapped">Open</button></div><button class="wrapped-teaser" data-goto="wrapped"><div class="wt-ic">✦</div><div><div class="wt-t">Luma Wrapped</div><div class="wt-s">Top songs, artists & minutes — all offline</div></div></button>`;
  if(!all.length)html=`<div class="home-hello"><h1>Welcome to Luma</h1><p class="home-sub">Tap <b>Open folder</b> to add your music.</p></div>`;
  el.innerHTML=html;
  el.querySelectorAll("[data-play]").forEach(b=>b.addEventListener("click",()=>playFrom(recentlyPlayed().map(t=>t.id),b.dataset.play)));
  el.querySelectorAll("[data-mix]").forEach(b=>b.addEventListener("click",()=>{const m=getMixes().find(x=>x.id===b.dataset.mix);if(m)playFrom(m.ids,m.ids[0]);}));
  el.querySelectorAll("[data-artist]").forEach(b=>b.addEventListener("click",()=>openArtist(b.dataset.artist)));
  el.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.goto)));
}
function renderHomeIfActive(){ if(view==="home")renderHome(); }
function timeOfDay(){ const h=new Date().getHours(); return h<12?"morning":h<18?"afternoon":"evening"; }

/* ---------------- ARTISTS ---------------- */
function artistList(){
  const m=new Map();
  all.forEach(t=>{const a=(t.artist||"Unknown Artist");const e=m.get(a)||{name:a,count:0,plays:0,art:null,albums:new Set()};e.count++;e.plays+=t.playCount||0;if(t.album)e.albums.add(t.album);if(!e.art&&t.art)e.art=t.art;m.set(a,e);});
  return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function renderArtists(){
  const el=$("#artists"); if(!el)return;
  const list=artistList();
  $("#heroKicker").textContent="YOUR LIBRARY";$("#heroTitle").textContent="Artists";$("#heroSub").textContent=list.length+" artist"+(list.length===1?"":"s");
  el.innerHTML=list.map(a=>`<button class="artist-card" data-artist="${esc(a.name)}"><div class="artist-art">${a.art?`<img src="${esc(a.art)}">`:`<span class="ph">♪</span>`}</div><div class="artist-name">${esc(a.name)}</div><div class="artist-sub">${a.count} song${a.count===1?"":"s"}</div></button>`).join("");
  el.querySelectorAll("[data-artist]").forEach(b=>b.addEventListener("click",()=>openArtist(b.dataset.artist)));
}
function openArtist(name){ curArtist=name; curAlbum=null; curPlaylist=null; view="artist"; setNav(null); render(); }

/* ---------------- WRAPPED / STATS ---------------- */
function renderWrapped(){
  const el=$("#wrapped"); if(!el)return;
  const plays=all.filter(t=>t.playCount).slice().sort((a,b)=>(b.playCount||0)-(a.playCount||0));
  const topSongs=plays.slice(0,5);
  const arts=topArtists(5);
  const totalPlays=all.reduce((s,t)=>s+(t.playCount||0),0);
  const mins=Math.round((settings.totalSeconds||0)/60);
  const albums=new Set(all.map(t=>t.album).filter(Boolean)).size;
  el.innerHTML=`
    <div class="wrap-head"><div class="wrap-badge">LUMA WRAPPED</div><h1>Your listening, wrapped</h1><p>Counted right here on your phone — nothing left the device.</p></div>
    <div class="wrap-stats">
      <div class="wstat"><div class="wnum">${mins.toLocaleString()}</div><div class="wlbl">minutes played</div></div>
      <div class="wstat"><div class="wnum">${totalPlays.toLocaleString()}</div><div class="wlbl">total plays</div></div>
      <div class="wstat"><div class="wnum">${arts.length?artistList().length:0}</div><div class="wlbl">artists</div></div>
      <div class="wstat"><div class="wnum">${albums}</div><div class="wlbl">albums</div></div>
    </div>
    <div class="sec-row"><h2>Top songs</h2></div>
    <div class="wrank">${topSongs.length?topSongs.map((t,i)=>`<button class="wrow" data-play="${t.id}"><span class="wr-i">${i+1}</span><div class="wr-art">${cardArt(t)}</div><div class="wr-txt"><div class="wr-t">${esc(t.title)}</div><div class="wr-s">${esc(t.artist||"Unknown Artist")}</div></div><span class="wr-c">${t.playCount} play${t.playCount===1?"":"s"}</span></button>`).join(""):`<div class="wempty">Play some music and your top songs will appear here.</div>`}</div>
    <div class="sec-row"><h2>Top artists</h2></div>
    <div class="wrank">${arts.length?arts.map((a,i)=>`<button class="wrow" data-artist="${esc(a.name)}"><span class="wr-i">${i+1}</span><div class="wr-art round">${a.art?`<img src="${esc(a.art)}">`:`<span class="ph">♪</span>`}</div><div class="wr-txt"><div class="wr-t">${esc(a.name)}</div><div class="wr-s">${a.count} song${a.count===1?"":"s"}</div></div><span class="wr-c">${a.plays} play${a.plays===1?"":"s"}</span></button>`).join(""):`<div class="wempty">No artist stats yet.</div>`}</div>
    <div class="support-sign">made by its.austin</div>`;
  el.querySelectorAll("[data-play]").forEach(b=>b.addEventListener("click",()=>playFrom(plays.map(t=>t.id),b.dataset.play)));
  el.querySelectorAll("[data-artist]").forEach(b=>b.addEventListener("click",()=>openArtist(b.dataset.artist)));
}

/* ---------------- FULL-SCREEN NOW PLAYING ---------------- */
function openNowPlaying(){ if(!engine.cur)return; document.body.classList.add("np-open"); renderNowPlaying(); }
function closeNowPlaying(){ document.body.classList.remove("np-open"); }
function renderNowPlaying(){
  const t=engine.cur; if(!t)return;
  $("#npArt").innerHTML=cardArt(t);
  $("#npTitle").textContent=t.title;
  $("#npArtist").textContent=t.artist||"Unknown Artist";
  $("#npArtist").onclick=()=>{ if(t.artist){closeNowPlaying();openArtist(t.artist);} };
  $("#npFav").classList.toggle("on",!!t.favorite);
  $("#npShuffle").classList.toggle("on",engine.shuffle);
  const rp=$("#npRepeat"); rp.classList.toggle("on",engine.repeat!==0); rp.dataset.mode=engine.repeat;
  $("#npBg").style.backgroundImage=t.art?`url("${t.art}")`:"none";
  renderNpPlay();
}
function renderNpPlay(){ const p=engine.cur&&engine._P&&engine._P()&&!engine._P().el.paused; const b=$("#npPlay"); if(b)b.innerHTML=p?'<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>':'<svg viewBox="0 0 24 24"><polygon points="8 5 20 12 8 19 8 5"/></svg>'; }

/* ---------------- PLAY QUEUE ---------------- */
function openQueue(){ document.body.classList.add("q-open"); renderQueue(); }
function closeQueue(){ document.body.classList.remove("q-open"); }
function renderQueue(){
  const el=$("#queueBody"); if(!el)return;
  const cur=engine.cur;
  const q=engine.queue.map(id=>byId.get(id)).filter(Boolean);
  const up=engine.upNext().map(id=>byId.get(id)).filter(Boolean).filter(t=>!engine.queue.includes(t.id));
  let html="";
  if(cur)html+=`<div class="q-sec">Now playing</div><div class="q-row now"><div class="q-art">${cardArt(cur)}</div><div class="q-txt"><div class="q-t">${esc(cur.title)}</div><div class="q-s">${esc(cur.artist||"Unknown Artist")}</div></div></div>`;
  if(q.length){
    html+=`<div class="q-sec">Next in queue <button class="q-clear" id="qClear">Clear</button></div>`;
    html+=q.map((t,i)=>`<div class="q-row" data-qi="${i}"><div class="q-art">${cardArt(t)}</div><div class="q-txt"><div class="q-t">${esc(t.title)}</div><div class="q-s">${esc(t.artist||"Unknown Artist")}</div></div><button class="q-x" data-qrm="${i}">✕</button></div>`).join("");
  }
  if(up.length){
    html+=`<div class="q-sec">Up next</div>`;
    html+=up.map(t=>`<div class="q-row" data-play="${t.id}"><div class="q-art">${cardArt(t)}</div><div class="q-txt"><div class="q-t">${esc(t.title)}</div><div class="q-s">${esc(t.artist||"Unknown Artist")}</div></div></div>`).join("");
  }
  if(!cur&&!q.length&&!up.length)html=`<div class="wempty">Nothing playing. Start a song to build your queue.</div>`;
  el.innerHTML=html;
  const cl=$("#qClear"); if(cl)cl.addEventListener("click",()=>engine.clearQueue());
  el.querySelectorAll("[data-qrm]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();engine.removeFromQueue(+b.dataset.qrm);}));
  el.querySelectorAll("[data-play]").forEach(b=>b.addEventListener("click",()=>engine.playId(b.dataset.play)));
}

/* ---------------- PLAYBACK + EQ PANEL (inside Atelier) ---------------- */
function buildPlaybackPanel(){
  const el=$("#playbackPanel"); if(!el)return;
  const pb=settings.playback||{};
  el.innerHTML=`
    <div class="sec"><h2>Playback</h2></div>
    <label class="set-row"><span>Crossfade <small id="cfVal">${engine.crossfade}s</small></span><input type="range" id="cfRange" min="0" max="12" step="1" value="${engine.crossfade}"></label>
    <label class="set-row"><span>Gapless playback</span><input type="checkbox" id="cbGapless" ${engine.gapless?"checked":""}></label>
    <label class="set-row"><span>Volume normalization <small>even loudness</small></span><input type="checkbox" id="cbNorm" ${engine.normalize?"checked":""}></label>
    <label class="set-row"><span>Mono audio</span><input type="checkbox" id="cbMono" ${engine.mono?"checked":""}></label>
    <label class="set-row"><span>Playback speed <small id="spVal">${engine.speed}×</small></span><input type="range" id="spRange" min="0.5" max="2" step="0.05" value="${engine.speed}"></label>

    <div class="sec"><h2>Equalizer</h2></div>
    <label class="set-row"><span>Enable equalizer</span><input type="checkbox" id="cbEq" ${engine.eqOn?"checked":""}></label>
    <div class="eq-presets" id="eqPresets"></div>
    <div class="eq" id="eqSliders"></div>

    <div class="sec"><h2>Sleep timer</h2></div>
    <div class="sleep" id="sleepBtns"></div>
    <div class="sleep-status" id="sleepStatus"></div>`;

  $("#cfRange").addEventListener("input",e=>{engine.setCrossfade(+e.target.value);$("#cfVal").textContent=engine.crossfade+"s";});
  $("#cbGapless").addEventListener("change",e=>engine.setGapless(e.target.checked));
  $("#cbNorm").addEventListener("change",e=>engine.setNormalize(e.target.checked));
  $("#cbMono").addEventListener("change",e=>engine.setMono(e.target.checked));
  $("#spRange").addEventListener("input",e=>{engine.setSpeed(+e.target.value);$("#spVal").textContent=engine.speed.toFixed(2).replace(/0$/,"")+"×";});
  $("#cbEq").addEventListener("change",e=>{engine.setEqOn(e.target.checked);renderEqSliders();});

  $("#eqPresets").innerHTML=Object.keys(EQ_PRESETS).map(n=>`<button class="eq-preset" data-eq="${esc(n)}">${esc(n)}</button>`).join("");
  $("#eqPresets").querySelectorAll("[data-eq]").forEach(b=>b.addEventListener("click",()=>{engine.setEqPreset(b.dataset.eq);$("#cbEq").checked=true;renderEqSliders();toast(b.dataset.eq);}));

  const mins=[15,30,45,60];
  $("#sleepBtns").innerHTML=mins.map(m=>`<button class="sleep-btn" data-sleep="${m}">${m}m</button>`).join("")+`<button class="sleep-btn" data-sleep="track">End of track</button><button class="sleep-btn off" data-sleep="0">Off</button>`;
  $("#sleepBtns").querySelectorAll("[data-sleep]").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.sleep;if(v==="0")engine.clearSleep();else if(v==="track")engine.setSleep(0,true);else engine.setSleep(+v,false);renderPlaybackPanel();}));

  renderEqSliders(); renderSleepStatus();
}
function renderEqSliders(){
  const el=$("#eqSliders"); if(!el)return;
  const labels=["60","150","400","1k","2.4k","15k"];
  el.innerHTML=`<div class="eq-band"><input type="range" class="eq-v" data-band="pre" min="-12" max="12" step="1" value="${engine.preamp}" ${engine.eqOn?"":"disabled"}><span>Pre</span></div>`+
    EQ_BANDS.map((f,i)=>`<div class="eq-band"><input type="range" class="eq-v" data-band="${i}" min="-12" max="12" step="1" value="${engine.eqGains[i]}" ${engine.eqOn?"":"disabled"}><span>${labels[i]}</span></div>`).join("");
  el.querySelectorAll(".eq-v").forEach(s=>s.addEventListener("input",()=>{ if(s.dataset.band==="pre")engine.setPreamp(+s.value); else engine.setEqBand(+s.dataset.band,+s.value); }));
}
function renderSleepStatus(){
  const el=$("#sleepStatus"); if(!el)return;
  if(engine.sleepEndOfTrack)el.textContent="Sleeping at end of current track.";
  else if(engine.sleepAt>Date.now())el.textContent="Sleeping in "+Math.max(1,Math.round((engine.sleepAt-Date.now())/60000))+" min.";
  else el.textContent="";
}
function renderPlaybackPanel(){ buildPlaybackPanel(); }
