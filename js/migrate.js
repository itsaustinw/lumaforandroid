/* ===========================================================================
   LUMA — Musicolet migration (migrate.js)   made by its.austin
   Imports Musicolet's exported .m3u / .m3u8 playlists (long-press a playlist
   in Musicolet -> "Export as .M3U file"; your Favorites is a playlist too) and
   rebuilds them in Luma, matching each entry to your already-scanned library.

   Matching is filename-first (most reliable across apps that store different
   absolute paths), then "Artist - Title" from #EXTINF, then title alone.
   Nothing is copied; we only re-create playlists that point at your songs.
   ========================================================================= */

/* --- normalise helpers --- */
function _norm(s){ return String(s||"").toLowerCase().replace(/\.[a-z0-9]{2,4}$/,"").replace(/[\s_\-\.\(\)\[\]]+/g," ").replace(/[^\w ]+/g,"").trim(); }
function _base(path){ return String(path||"").replace(/\\/g,"/").split("/").pop(); }
function _stripExt(name){ return String(name||"").replace(/\.[a-z0-9]{2,4}$/i,""); }

/* build lookup indexes over the current library */
function _buildIndex(){
  const byFile=new Map(), byArtistTitle=new Map(), byTitle=new Map();
  for(const t of all){
    const file=_norm(_base(t.rel||t.title));
    if(file&&!byFile.has(file))byFile.set(file,t.id);
    const at=_norm((t.artist||"")+" "+(t.title||""));
    if(at.trim()&&!byArtistTitle.has(at))byArtistTitle.set(at,t.id);
    const ti=_norm(t.title||"");
    if(ti&&!byTitle.has(ti))byTitle.set(ti,t.id);
  }
  return {byFile,byArtistTitle,byTitle};
}

/* parse one .m3u/.m3u8 text into [{path, artist, title}] */
function parseM3U(text){
  const out=[]; const lines=String(text||"").split(/\r?\n/);
  let pending=null;
  for(let raw of lines){
    const line=raw.trim();
    if(!line)continue;
    if(line.startsWith("#EXTINF")){
      // #EXTINF:duration,Artist - Title   (artist optional)
      const meta=line.slice(line.indexOf(":")+1);
      const comma=meta.indexOf(",");
      const info=comma>=0?meta.slice(comma+1).trim():"";
      let artist="",title=info;
      const dash=info.indexOf(" - ");
      if(dash>=0){ artist=info.slice(0,dash).trim(); title=info.slice(dash+3).trim(); }
      pending={artist,title};
      continue;
    }
    if(line.startsWith("#"))continue;                 // other directives
    const path=line.replace(/^file:\/\//i,"");
    out.push({path, artist:(pending&&pending.artist)||"", title:(pending&&pending.title)||""});
    pending=null;
  }
  return out;
}

/* match one parsed entry to a library song id, or null */
function _matchEntry(e, idx){
  const file=_norm(_stripExt(_base(e.path)));
  if(file&&idx.byFile.has(file))return idx.byFile.get(file);
  const at=_norm((e.artist||"")+" "+(e.title||""));
  if(at.trim()&&idx.byArtistTitle.has(at))return idx.byArtistTitle.get(at);
  const ti=_norm(e.title||"");
  if(ti&&idx.byTitle.has(ti))return idx.byTitle.get(ti);
  return null;
}

/* import a set of File objects (the .m3u files chosen in the picker) */
async function importMusicoletFiles(fileList){
  const m3us=Array.from(fileList||[]).filter(f=>/\.m3u8?$/i.test(f.name||""));
  if(!m3us.length){ toast("Pick your exported .m3u files"); return; }
  if(!all.length){ toast("Open your music folder first, then migrate"); return; }
  const idx=_buildIndex();
  let created=0, totalMatched=0, totalEntries=0, totalMissed=0;
  const report=[];
  for(const f of m3us){
    let text=""; try{ text=await f.text(); }catch(_){ continue; }
    const entries=parseM3U(text);
    if(!entries.length)continue;
    const seen=new Set(), ids=[]; let missed=0;
    for(const e of entries){
      const id=_matchEntry(e,idx);
      if(id&&!seen.has(id)){ seen.add(id); ids.push(id); }
      else if(!id)missed++;
    }
    totalEntries+=entries.length; totalMatched+=ids.length; totalMissed+=missed;
    const name=_stripExt(f.name).replace(/^\d+[_ -]*/,"").trim()||"Imported playlist";
    if(ids.length){
      // merge into an existing playlist of the same name, else create
      let pl=playlists().find(p=>p.name.toLowerCase()===name.toLowerCase());
      if(!pl)pl=createPlaylist(name);
      let add=0; for(const id of ids){ if(!pl.songs.includes(id)){ pl.songs.push(id); add++; } }
      created++; report.push({name, matched:ids.length, added:add, missed});
    }else{
      report.push({name, matched:0, added:0, missed});
    }
  }
  persistSettings(); renderPlaylistNav();
  if(view==="playlist")render();
  showMigrateReport({files:m3us.length, created, totalEntries, totalMatched, totalMissed, report});
}

/* trigger the file picker */
function startMusicoletImport(){
  const inp=$("#m3uPick"); if(!inp)return; inp.value=""; inp.click();
}
async function onM3UPick(){
  const inp=$("#m3uPick");
  await importMusicoletFiles(inp.files);
}

/* results dialog */
function showMigrateReport(r){
  const el=$("#migrateReport"); if(!el)return;
  const rows=r.report.map(x=>`<div class="mg-row"><span class="mg-name">${esc(x.name)}</span><span class="mg-stat">${x.matched} matched${x.missed?` · ${x.missed} not found`:""}</span></div>`).join("");
  el.innerHTML=`
    <div class="mg-inner">
      <div class="mg-head">Migration complete</div>
      <p class="mg-sub">${r.created} playlist${r.created===1?"":"s"} imported · ${r.totalMatched}/${r.totalEntries} songs matched${r.totalMissed?` · ${r.totalMissed} not in your library yet`:""}.</p>
      <div class="mg-list">${rows||'<div class="mg-row"><span class="mg-name">No matching songs found</span></div>'}</div>
      ${r.totalMissed?`<p class="mg-tip">Songs marked “not found” aren’t in Luma yet — open the folder that contains them and run the import again to fill them in.</p>`:""}
      <button class="mg-done" id="migrateDone">Done</button>
    </div>`;
  el.hidden=false;
  $("#migrateDone").onclick=()=>{ el.hidden=true; };
  el.onclick=(e)=>{ if(e.target===el)el.hidden=true; };
}
