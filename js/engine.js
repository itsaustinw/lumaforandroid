/* ===========================================================================
   LUMA — Web Audio playback engine (engine.js)   made by its.austin
   A real node graph so Luma can do the things Spotify's player does:

     src A ─┐
            ├─(per-player GAIN: crossfade × normalize)─┐
     src B ─┘                                          │
                                          preamp ─ EQ×6 ─ analyser ─ master ─ [mono?] ─ out

   Features: crossfade (0–12s), gapless, volume normalization, 6-band EQ with
   presets, playback speed, mono downmix, sleep timer, and a Spotify-style
   play queue (Play next / Add to queue) with history for Previous.
   The UI (renderNow, renderProgress, etc.) lives in app.js/views.js; the
   engine just calls those hooks.
   ========================================================================= */
const EQ_BANDS = [60, 150, 400, 1000, 2400, 15000];
const EQ_PRESETS = {
  "Flat":        [0, 0, 0, 0, 0, 0],
  "Bass boost":  [7, 5, 2, 0, 0, 0],
  "Bass reduce": [-6, -4, -1, 0, 0, 0],
  "Treble boost":[0, 0, 0, 2, 5, 7],
  "Vocal":       [-2, -1, 3, 4, 2, 0],
  "Loudness":    [6, 3, 0, 1, 3, 6],
  "Acoustic":    [4, 2, 1, 2, 3, 3],
  "Electronic":  [5, 3, 0, 2, 3, 5],
  "Podcast":     [-3, -1, 4, 4, 2, -1],
};

const engine = {
  ctx: null, players: [], active: 0, built: false,
  order: [], queue: [], history: [], pos: -1,
  shuffle: false, repeat: 0, vol: 0.9, cur: null,
  crossfade: 0, gapless: true, fading: false, preloadedId: null,
  eqOn: false, eqGains: EQ_BANDS.map(() => 0), preamp: 0, eqNodes: [], preampNode: null,
  normalize: false, normTarget: 0.16, measuring: null,
  speed: 1, mono: false,
  monoIn: null, monoOut: null, masterNode: null, analyser: null,
  sleepAt: 0, sleepTimer: null, sleepEndOfTrack: false,
  _raf: 0,

  /* ---------- graph ---------- */
  init() {
    // preferences come from settings (loaded before init)
    const pb = (settings.playback ||= {});
    this.crossfade = pb.crossfade ?? 0;
    this.gapless = pb.gapless ?? true;
    this.normalize = pb.normalize ?? false;
    this.eqOn = pb.eqOn ?? false;
    this.eqGains = Array.isArray(pb.eqGains) && pb.eqGains.length === 6 ? pb.eqGains.slice() : EQ_BANDS.map(() => 0);
    this.preamp = pb.preamp ?? 0;
    this.speed = pb.speed ?? 1;
    this.mono = pb.mono ?? false;
    this.vol = typeof settings.volume === "number" ? settings.volume : 0.9;
  },

  _ensureGraph() {
    if (this.built) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.built = "no"; return; }        // very old browser: fall back to plain <audio>
    this.ctx = new AC();
    // two media players
    for (let i = 0; i < 2; i++) {
      const el = new Audio();
      el.preload = "auto"; el.crossOrigin = "anonymous"; el.volume = 1;
      el.preservesPitch = true; el.playbackRate = this.speed;
      const src = this.ctx.createMediaElementSource(el);
      const gain = this.ctx.createGain(); gain.gain.value = i === 0 ? 1 : 0;
      src.connect(gain);
      const p = { el, src, gain, norm: 1 };
      this.players.push(p);
      el.addEventListener("timeupdate", () => { if (i === this.active) this._tick(); });
      el.addEventListener("ended", () => { if (i === this.active && !this.fading) this.next(true); });
      el.addEventListener("play", () => { if (i === this.active) { renderPlay(); document.body.classList.add("playing"); markRow(); } });
      el.addEventListener("pause", () => { if (i === this.active) renderPlay(); });
      el.addEventListener("loadedmetadata", () => {
        if (i === this.active && this.cur && !this.cur.duration && isFinite(el.duration)) {
          this.cur.duration = Math.round(el.duration); LumaDB.update({ id: this.cur.id, duration: this.cur.duration });
        }
        if (i === this.active) renderProgress();
      });
    }
    // preamp + EQ
    this.preampNode = this.ctx.createGain(); this.preampNode.gain.value = this._db2lin(this.eqOn ? this.preamp : 0);
    let node = this.preampNode;
    this.eqNodes = EQ_BANDS.map((f, idx) => {
      const b = this.ctx.createBiquadFilter();
      b.type = idx === 0 ? "lowshelf" : idx === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
      b.frequency.value = f; b.Q.value = 1.0;
      b.gain.value = this.eqOn ? this.eqGains[idx] : 0;
      node.connect(b); node = b; return b;
    });
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 2048;
    node.connect(this.analyser);
    this.masterNode = this.ctx.createGain(); this.masterNode.gain.value = this.vol;
    this.analyser.connect(this.masterNode);
    // mono downmix path
    this.monoIn = this.ctx.createGain();
    const split = this.ctx.createChannelSplitter(2);
    const merge = this.ctx.createChannelMerger(2);
    const half = this.ctx.createGain(); half.gain.value = 0.5;
    this.monoIn.connect(split);
    split.connect(half, 0); split.connect(half, 1);
    half.connect(merge, 0, 0); half.connect(merge, 0, 1);
    this.monoOut = merge;
    // players -> preamp
    this.players.forEach(p => p.gain.connect(this.preampNode));
    this._route();
    this.built = true;
  },
  _route() {
    try { this.masterNode.disconnect(); } catch (_) {}
    try { this.monoOut.disconnect(); } catch (_) {}
    if (this.mono) { this.masterNode.connect(this.monoIn); this.monoOut.connect(this.ctx.destination); }
    else { this.masterNode.connect(this.ctx.destination); }
  },
  _db2lin(db) { return Math.pow(10, db / 20); },
  _resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); },
  _P() { return this.players[this.active]; },
  _idle() { return this.players[this.active ^ 1]; },

  /* ---------- transport ---------- */
  play(ids, startId) {
    if (!ids || !ids.length) return;
    this._ensureGraph();
    this.order = this.shuffle ? this._shuf(ids, startId) : ids.slice();
    this.pos = startId ? this.order.indexOf(startId) : 0; if (this.pos < 0) this.pos = 0;
    this.queue = []; this.history = [];
    this._load(this.order[this.pos], true);
  },
  playId(id) { this._ensureGraph(); if (this.cur) this.history.push(this.cur.id); this._load(id, true); },

  _load(id, autoplay, viaFade) {
    const t = byId.get(id); if (!t) return;
    this.cur = t;
    const url = LumaDB.fileUrl(id);
    if (!url) { toast("Re-open this folder to play — tap Open folder"); renderNow(); return; }
    if (!this.built || this.built === "no") { this._loadFallback(url, t, autoplay); return; }
    this._resume();
    const p = viaFade ? this._P() : this._P();
    p.el.src = url; p.el.playbackRate = this.speed; p.el.currentTime = 0;
    p.norm = this._normGain(t);
    if (!viaFade) { try { p.gain.gain.cancelScheduledValues(this.ctx.currentTime); } catch (_) {} p.gain.gain.value = p.norm; }
    if (autoplay) p.el.play().catch(() => {});
    this.fading = false; this.preloadedId = null;
    this._count(t);
    if (this.normalize && this.measuring !== t.id && (t.normGain == null)) this._measure(t);
    renderNow(); if (typeof pushRecent === "function") pushRecent(t.id);
  },
  _loadFallback(url, t, autoplay) {
    // no Web Audio: use single element on player 0
    const el = this.players[0] ? this.players[0].el : (this._fb || (this._fb = new Audio()));
    el.src = url; if (autoplay) el.play().catch(() => {});
    this._count(t); renderNow();
  },
  _count(t) { t.lastPlayed = Date.now(); t.playCount = (t.playCount || 0) + 1; LumaDB.update({ id: t.id, playCount: t.playCount, lastPlayed: t.lastPlayed }); logPlay(t.id); },

  toggle() {
    this._ensureGraph(); this._resume();
    if (!this.cur) { const ids = visibleIds(); if (ids.length) this.play(ids, ids[0]); return; }
    const el = this._P().el;
    el.paused ? el.play().catch(() => {}) : el.pause();
  },

  _peekNext(auto) {
    if (this.repeat === 2 && auto) return this.cur ? this.cur.id : null;   // repeat one
    if (this.queue.length) return this.queue[0];
    let n = this.pos + 1;
    if (n >= this.order.length) { if (this.repeat === 1 || !auto) n = 0; else return null; }
    return this.order[n];
  },
  next(auto) {
    this._ensureGraph();
    if (auto && this.sleepEndOfTrack) { this._P().el.pause(); this.clearSleep(); toast("Sleep timer — paused"); if (typeof renderPlaybackPanel === "function") renderPlaybackPanel(); return; }
    if (this.repeat === 2 && auto) { const el = this._P().el; el.currentTime = 0; el.play().catch(() => {}); return; }
    if (this.cur) this.history.push(this.cur.id);
    let id;
    if (this.queue.length) { id = this.queue.shift(); }
    else {
      let n = this.pos + 1;
      if (n >= this.order.length) { if (this.repeat === 1 || !auto) n = 0; else { this._P().el.pause(); return; } }
      this.pos = n; id = this.order[this.pos];
    }
    if (id != null) this._load(id, true);
    if (typeof renderQueue === "function") renderQueue();
  },
  prev() {
    this._ensureGraph();
    const el = this._P().el;
    if (el.currentTime > 3) { el.currentTime = 0; return; }
    if (this.history.length) { const id = this.history.pop(); this._load(id, true); if (typeof renderQueue === "function") renderQueue(); return; }
    let n = this.pos - 1; if (n < 0) n = this.order.length - 1; if (n < 0) n = 0; this.pos = n; this._load(this.order[this.pos], true);
  },
  seek(f) { const el = this._P().el; if (el.duration) el.currentTime = f * el.duration; },
  setVol(v) { this.vol = v; if (this.masterNode) this.masterNode.gain.value = v; else if (this._P()) this._P().el.volume = v; settings.volume = v; scheduleSave(); renderVol(); },
  get muted() { return this._muted || false; },
  setMuted(m) { this._muted = m; if (this.masterNode) this.masterNode.gain.value = m ? 0 : this.vol; else if (this._P()) this._P().el.muted = m; renderVol(); },

  setShuffle(on) {
    this.shuffle = on; const cur = this.cur ? this.cur.id : null;
    const ids = this.order.length ? this.order.slice() : visibleIds();
    this.order = on ? this._shuf(ids, cur) : ids.slice();
    this.pos = cur ? this.order.indexOf(cur) : this.pos; renderNow();
    if (typeof renderQueue === "function") renderQueue();
  },
  cycleRepeat() { this.repeat = (this.repeat + 1) % 3; renderNow(); },
  _shuf(ids, first) { const p = ids.filter(x => x !== first); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[p[i], p[j]] = [p[j], p[i]]; } return first && ids.includes(first) ? [first, ...p] : p; },

  /* ---------- queue ---------- */
  addToQueue(id) { this.queue.push(id); toast("Added to queue"); if (typeof renderQueue === "function") renderQueue(); },
  playNext(id) { this.queue.unshift(id); toast("Playing next"); if (typeof renderQueue === "function") renderQueue(); },
  removeFromQueue(i) { this.queue.splice(i, 1); if (typeof renderQueue === "function") renderQueue(); },
  clearQueue() { this.queue = []; if (typeof renderQueue === "function") renderQueue(); },
  upNext() {
    const out = this.queue.slice();
    let n = this.pos + 1, guard = 0;
    while (out.length < 30 && guard++ < this.order.length) {
      if (n >= this.order.length) { if (this.repeat === 1) n = 0; else break; }
      out.push(this.order[n]); n++;
    }
    return out;
  },

  /* ---------- crossfade / gapless tick ---------- */
  _tick() {
    renderProgress();
    if (!this.built || this.built === "no") return;
    const p = this._P(); const el = p.el; const d = el.duration;
    if (!d || !isFinite(d)) return;
    const remain = d - el.currentTime;
    const nextId = this._peekNext(true);
    // preload next for gapless
    if (this.gapless && !this.crossfade && nextId && remain < 8 && this.preloadedId !== nextId) {
      const u = LumaDB.fileUrl(nextId); if (u) { this._idle().el.src = u; this.preloadedId = nextId; }
    }
    // crossfade
    if (this.crossfade > 0 && nextId && nextId !== this.cur.id && !this.fading && remain <= this.crossfade) {
      this._crossfadeTo(nextId);
    }
  },
  _crossfadeTo(id) {
    const t = byId.get(id); const u = t && LumaDB.fileUrl(id); if (!u) return;
    this.fading = true;
    const cf = this.crossfade, now = this.ctx.currentTime;
    const cur = this._P(), nxt = this._idle();
    nxt.el.src = u; nxt.el.playbackRate = this.speed; nxt.el.currentTime = 0;
    nxt.norm = this._normGain(t);
    try { nxt.el.play().catch(() => {}); } catch (_) {}
    try {
      cur.gain.gain.cancelScheduledValues(now); cur.gain.gain.setValueAtTime(cur.gain.gain.value, now); cur.gain.gain.linearRampToValueAtTime(0.0001, now + cf);
      nxt.gain.gain.cancelScheduledValues(now); nxt.gain.gain.setValueAtTime(0.0001, now); nxt.gain.gain.linearRampToValueAtTime(nxt.norm, now + cf);
    } catch (_) {}
    // advance bookkeeping to the next track now
    if (this.cur) this.history.push(this.cur.id);
    if (this.queue.length && this.queue[0] === id) this.queue.shift();
    else { let n = this.pos + 1; if (n >= this.order.length) n = 0; this.pos = n; }
    this.active ^= 1; this.cur = t; this._count(t);
    if (this.normalize && t.normGain == null) this._measure(t);
    renderNow(); if (typeof pushRecent === "function") pushRecent(t.id); if (typeof renderQueue === "function") renderQueue();
    setTimeout(() => { try { cur.el.pause(); } catch (_) {} this.fading = false; }, cf * 1000 + 60);
  },

  /* ---------- EQ ---------- */
  setEqOn(on) { this.eqOn = on; this._applyEq(); this._save(); },
  setEqBand(i, db) { this.eqGains[i] = db; if (this.eqOn) this._applyEq(); this._save(); },
  setPreamp(db) { this.preamp = db; if (this.eqOn) this._applyEq(); this._save(); },
  setEqPreset(name) { const p = EQ_PRESETS[name]; if (!p) return; this.eqGains = p.slice(); this.eqOn = true; this._applyEq(); this._save(); },
  _applyEq() {
    if (!this.built || this.built === "no") return;
    this.eqNodes.forEach((b, i) => { b.gain.value = this.eqOn ? this.eqGains[i] : 0; });
    if (this.preampNode) this.preampNode.gain.value = this._db2lin(this.eqOn ? this.preamp : 0);
  },

  /* ---------- normalization ---------- */
  setNormalize(on) { this.normalize = on; if (this.built && this.built !== "no" && this.cur) { const p = this._P(); const g = this._normGain(this.cur); if (!this.fading) p.gain.gain.value = g; } this._save(); },
  _normGain(t) {
    if (!this.normalize || !t) return 1;
    if (t.normGain == null) return 1;             // not measured yet → unity this pass
    return Math.min(4, Math.max(0.25, t.normGain));
  },
  _measure(t) {
    // measure integrated RMS while the track plays, store a gain for next time
    if (!this.analyser) return;
    this.measuring = t.id;
    const buf = new Float32Array(this.analyser.fftSize);
    let sum = 0, n = 0; const id = t.id;
    const step = () => {
      if (this.measuring !== id || !this.cur || this.cur.id !== id) return;
      this.analyser.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      sum += s / buf.length; n++;
      if (n >= 240) {                              // ~ up to a minute of samples
        const rms = Math.sqrt(sum / n) || 0.0001;
        const gain = Math.min(4, Math.max(0.25, this.normTarget / rms));
        t.normGain = gain; LumaDB.update({ id, normGain: gain });
        this.measuring = null; return;
      }
      setTimeout(step, 250);
    };
    setTimeout(step, 500);
  },

  /* ---------- speed / mono ---------- */
  setSpeed(x) { this.speed = x; this.players.forEach(p => p.el.playbackRate = x); if (this._fb) this._fb.playbackRate = x; this._save(); },
  setMono(on) { this.mono = on; if (this.built && this.built !== "no") this._route(); this._save(); },

  /* ---------- sleep timer ---------- */
  setSleep(minutes, endOfTrack) {
    this.clearSleep();
    this.sleepEndOfTrack = !!endOfTrack;
    if (endOfTrack) { this.sleepAt = -1; toast("Sleep: end of track"); return; }
    if (!minutes) return;
    this.sleepAt = Date.now() + minutes * 60000;
    this.sleepTimer = setTimeout(() => this._sleepFire(), minutes * 60000);
    toast("Sleep timer: " + minutes + " min");
  },
  clearSleep() { if (this.sleepTimer) clearTimeout(this.sleepTimer); this.sleepTimer = null; this.sleepAt = 0; this.sleepEndOfTrack = false; },
  _sleepFire() {
    const el = this._P() && this._P().el; if (!el) return;
    if (this.built && this.built !== "no" && this.masterNode) {
      const now = this.ctx.currentTime; try { this.masterNode.gain.cancelScheduledValues(now); this.masterNode.gain.linearRampToValueAtTime(0.0001, now + 6); } catch (_) {}
      setTimeout(() => { el.pause(); this.masterNode.gain.value = this.vol; }, 6200);
    } else el.pause();
    this.clearSleep(); toast("Sleep timer — paused");
    if (typeof renderPlaybackPanel === "function") renderPlaybackPanel();
  },

  _save() { const pb = (settings.playback ||= {}); pb.crossfade = this.crossfade; pb.gapless = this.gapless; pb.normalize = this.normalize; pb.eqOn = this.eqOn; pb.eqGains = this.eqGains.slice(); pb.preamp = this.preamp; pb.speed = this.speed; pb.mono = this.mono; scheduleSave(); },
  setCrossfade(s) { this.crossfade = s; this._save(); },
  setGapless(on) { this.gapless = on; this._save(); },
};
