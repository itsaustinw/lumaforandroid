/* ===========================================================================
   LUMA (Android / PWA build — codeword luma_an)   made by its.austin
   Pure-browser storage. No server. Songs are referenced in place (never
   copied): we keep live File handles for the session and persist only the
   library metadata, playlists, settings and tiny generated art in IndexedDB,
   keyed by each song's relative path so re-opening the same folder re-links
   everything (favourites, plays, playlists, art) instantly.
   ========================================================================= */
const LumaDB = (() => {
  const DB_NAME = "luma_an", DB_VER = 1;
  let db = null;
  const files = new Map();   // id -> File (this session only, in place)
  const urls = new Map();    // id -> object URL cache
  const artUrls = new Map(); // id -> object URL for stored art blob

  function open() {
    return new Promise((resolve) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); }
      catch (_) { resolve(false); return; }
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains("library")) d.createObjectStore("library", { keyPath: "id" });
        if (!d.objectStoreNames.contains("settings")) d.createObjectStore("settings");
        if (!d.objectStoreNames.contains("art")) d.createObjectStore("art");
        if (!d.objectStoreNames.contains("handles")) d.createObjectStore("handles");
      };
      req.onsuccess = () => { db = req.result; resolve(true); };
      req.onerror = () => resolve(false);
    });
  }
  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

  async function getAll() { if (!db) return []; try { return await reqP(tx("library", "readonly").getAll()) || []; } catch (_) { return []; } }
  async function putRec(rec) { if (!db) return; try { await reqP(tx("library", "readwrite").put(rec)); } catch (_) {} }
  async function delRec(id) { if (!db) return; try { await reqP(tx("library", "readwrite").delete(id)); } catch (_) {} }
  async function getSetting(k, d) { if (!db) return d; try { const v = await reqP(tx("settings", "readonly").get(k)); return v === undefined ? d : v; } catch (_) { return d; } }
  async function setSetting(k, v) { if (!db) return; try { await reqP(tx("settings", "readwrite").put(v, k)); } catch (_) {} }

  /* stable id from a song's relative path so re-scan re-links to same record */
  function hashId(str) {
    let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return "s_" + h.toString(16);
  }
  const AUDIO_RE = /\.(mp3|flac|m4a|aac|ogg|oga|opus|wav|wma)$/i;

  function parseName(rel) {
    const parts = rel.split("/");
    let base = parts[parts.length - 1].replace(/\.[^.]+$/, "");
    const parent = parts.length > 1 ? parts[parts.length - 2] : "";
    let artist = "", title = base;
    const m = base.match(/^\s*(.+?)\s+-\s+(.+?)\s*$/);
    if (m) { artist = m[1]; title = m[2]; }
    const album = parent && !/^(music|audio|songs|download[s]?)$/i.test(parent) ? parent : "";
    return { title, artist, album };
  }

  return {
    async open() { return await open(); },
    get isDisk() { return true; },                 // always "live" in the browser build
    get supportsHandles() { return typeof window.showDirectoryPicker === "function"; },

    /* ---- library ---- */
    async getLibrary() { return await getAll(); },

    /* Register a batch of File objects (referenced in place). Merges with any
       existing record for the same relative path, preserving user data. */
    async ingest(fileList, rootLabel) {
      const added = [], now = Date.now();
      const existing = new Map((await getAll()).map(r => [r.id, r]));
      for (const f of fileList) {
        const rel = (f.webkitRelativePath || f.relPath || f.name).replace(/\\/g, "/");
        if (!AUDIO_RE.test(rel)) continue;
        const id = hashId(rel);
        files.set(id, f);                             // keep the live reference
        if (existing.has(id)) {
          const r = existing.get(id); r.rel = rel; if (rootLabel) r.root = rootLabel;
          await putRec(r);
          continue;                                   // already known — keep user data
        }
        const p = parseName(rel);
        const rec = {
          id, rel, root: rootLabel || "", size: f.size || 0,
          title: p.title || rel, artist: p.artist || "", album: p.album || "",
          art: null, duration: 0, favorite: false,
          addedAt: now, lastPlayed: 0, playCount: 0, _edited: []
        };
        await putRec(rec); existing.set(id, rec); added.push(rec);
      }
      return { added, total: existing.size };
    },

    hasFile(id) { return files.has(id); },
    fileUrl(id) {
      if (urls.has(id)) return urls.get(id);
      const f = files.get(id); if (!f) return null;
      const u = URL.createObjectURL(f); urls.set(id, u); return u;
    },
    fileObj(id) { return files.get(id) || null; },

    async update(fields) {
      if (!db || !fields || !fields.id) return;
      const r = await reqP(tx("library", "readonly").get(fields.id)).catch(() => null);
      if (!r) return;
      Object.assign(r, fields);
      await putRec(r);
    },
    async remove(id) { await delRec(id); files.delete(id); const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); } },

    /* ---- settings (theme, volume, playlists, watched roots) ---- */
    async getSettings() { return await getSetting("app", {}) || {}; },
    async saveSettings(o) { await setSetting("app", o || {}); },

    /* ---- art (tiny generated thumbnails only) ---- */
    async storeArt(id, dataUrl) {
      if (!db || !dataUrl) return null;
      const m = /^data:(image\/[a-z]+);base64,(.*)$/i.exec(dataUrl || "");
      if (!m) return null;
      const bin = atob(m[2]); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: m[1] });
      try { await reqP(tx("art", "readwrite").put(blob, id)); } catch (_) { return null; }
      const old = artUrls.get(id); if (old) URL.revokeObjectURL(old);
      const u = URL.createObjectURL(blob); artUrls.set(id, u); return u;
    },
    async artUrl(id) {
      if (artUrls.has(id)) return artUrls.get(id);
      if (!db) return null;
      const blob = await reqP(tx("art", "readonly").get(id)).catch(() => null);
      if (!blob) return null;
      const u = URL.createObjectURL(blob); artUrls.set(id, u); return u;
    },

    /* ---- File System Access API (true persistent watch, where supported) ---- */
    async saveDirHandle(handle) { if (!db) return; try { await reqP(tx("handles", "readwrite").put(handle, "musicDir")); } catch (_) {} },
    async getDirHandle() { if (!db) return null; try { return await reqP(tx("handles", "readonly").get("musicDir")); } catch (_) { return null; } },
  };
})();
