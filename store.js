/* ==========================================================
   BREACH & WHACK — STORE + PROGRESSION
   Player profile (localStorage), XP / levels / coins, unlocks,
   achievements, missions, leaderboard.

   SECURITY NOTE: everything in localStorage is client-side and can
   be edited by the player. It is validated on load (validate()) for
   sanity only. A future backend must NOT trust these numbers — it
   should recompute XP/coins/unlocks from a per-round event report
   (see lastRun / Progress.finishMatch) and own the leaderboard.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, CFG = BW.CFG, clamp = BW.clamp;
  const KEY = 'breachwhack.v2', OLD_BEST = 'breachwhack.best';

  const defaults = () => ({
    version: 2, username: 'OPERATOR', avatar: 0, created: Date.now(),
    level: 1, xp: 0, coins: 300,
    stats: { kills: 0, headshots: 0, shots: 0, hits: 0, misses: 0, hostages: 0, escaped: 0, bestCombo: 0, bestScore: 0,
             bestHeadStreak: 0, bestRoundAcc: 0, bestEndless: 0, bestCleanRound: 0, playTime: 0, games: 0, fav: {} },
    inventory: { skins: {}, agents: {} },          // dynamic maps must default to {} (see merge)
    equipment: { slots: ['viper', 'mantis', 'raven'], skins: {}, agent: 'recon' },
    crosshair: Object.assign({ preset: 'tactical' }, BW.CROSSHAIRS[0].c),
    achievements: {},
    missions: { day: '', week: '', daily: [], weekly: null },
    scores: [],
    settings: { muted: false, shake: true, dust: true, lastMode: 'classic' },
    lastRun: null
  });

  /* ---------- load / validate ---------- */
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const dyn = s => {                       // dynamic-key maps: copy primitives only
    const o = {};
    Object.keys(s).forEach(k => { if (k !== '__proto__' && k !== 'constructor' && (typeof s[k] === 'number' || typeof s[k] === 'boolean' || typeof s[k] === 'string')) o[k] = s[k]; });
    return o;
  };
  function merge(def, src) {
    if (!isObj(src)) return def;
    const out = {};
    for (const k in def) {
      const d = def[k], s = src[k];
      if (isObj(d)) out[k] = Object.keys(d).length ? merge(d, s) : (isObj(s) ? dyn(s) : d);
      else if (Array.isArray(d)) out[k] = Array.isArray(s) ? s.slice(0, 400) : d;
      else if (d === null) out[k] = isObj(s) ? s : null;
      else out[k] = typeof s === typeof d ? s : d;
    }
    return out;
  }
  const cleanName = s => String(s || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || 'OPERATOR';
  BW.cleanName = cleanName;

  // agent unlock rule, evaluated against any profile object (used by validate + Progress)
  function agentOk(p, a) {
    const u = a.unlock;
    switch (u.type) {
      case 'default': return true;
      case 'level': return p.level >= u.v;
      case 'kills': return p.stats.kills >= u.v;
      case 'headshots': return p.stats.headshots >= u.v;
      case 'achievement': return !!p.achievements[u.v];
    }
    return false;
  }

  function validate(p) {
    const num = (v, a, b, d) => Number.isFinite(v) ? clamp(v, a, b) : d;
    p.level = Math.floor(num(p.level, 1, 300, 1));
    p.xp = num(p.xp, 0, 1e9, 0);
    if (p.xp >= CFG.xpNeed(p.level)) p.xp = 0;
    p.coins = Math.floor(num(p.coins, 0, 1e9, 0));
    for (const k in p.stats) if (k !== 'fav') p.stats[k] = num(p.stats[k], 0, 1e10, 0);
    p.username = cleanName(p.username);
    p.avatar = Math.floor(num(p.avatar, 0, BW.Art.AVATARS - 1, 0));
    Object.keys(p.inventory.skins).forEach(k => { if (!BW.skinKeyValid(k)) delete p.inventory.skins[k]; });
    Object.keys(p.inventory.agents).forEach(k => { const a = BW.agent(k); if (!a || !agentOk(p, a)) delete p.inventory.agents[k]; });   // never trust the stored unlock list
    p.inventory.agents.recon = true;
    const eq = p.equipment;
    const slotsOk = eq.slots.length === 3 && new Set(eq.slots).size === 3 &&
      eq.slots.every(id => BW.weapon(id) && p.level >= BW.weapon(id).level);
    if (!slotsOk) eq.slots = ['viper', 'mantis', 'raven'];
    Object.keys(eq.skins).forEach(w => {
      const s = eq.skins[w];
      if (!BW.weapon(w) || !(s === 'default' || p.inventory.skins[w + ':' + s])) delete eq.skins[w];
    });
    if (!BW.agent(eq.agent) || !p.inventory.agents[eq.agent]) eq.agent = 'recon';
    const c = p.crosshair;
    c.size = num(c.size, 0, 30, 10); c.thickness = num(c.thickness, 1, 6, 3);
    c.gap = num(c.gap, 0, 20, 9); c.opacity = num(c.opacity, 0.2, 1, 1);
    if (!/^#[0-9a-f]{6}$/i.test(c.color)) c.color = '#57ff8a';
    if (!p.settings.lastMode || !BW.MODES.some(m => m.id === p.settings.lastMode && !m.soon)) p.settings.lastMode = 'classic';
    p.scores = p.scores.filter(s => isObj(s) && Number.isFinite(s.s) && Number.isFinite(s.t)).slice(-300);
    return p;
  }

  /* ---------- persistence ---------- */
  const Store = BW.Store = { player: null };
  let saveTimer = 0;
  Store.load = () => {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    const p = merge(defaults(), raw);
    if (!raw) {                                  // migrate the v1 best score
      try { p.stats.bestScore = parseInt(localStorage.getItem(OLD_BEST), 10) || 0; } catch (e) { /* ignore */ }
    }
    Store.player = validate(p);
    return Store.player;
  };
  Store.saveNow = () => {
    clearTimeout(saveTimer); saveTimer = 0;
    try { localStorage.setItem(KEY, JSON.stringify(Store.player)); } catch (e) { /* private mode / quota */ }
  };
  Store.save = () => { if (!saveTimer) saveTimer = setTimeout(Store.saveNow, 400); };   // debounced
  Store.reset = () => {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    Store.player = validate(defaults());
    P.pendingLevelUps.length = 0;
    P.ensureMissions();
    Store.saveNow();
  };
  addEventListener('beforeunload', () => { if (Store.player) Store.saveNow(); });

  /* ---------- progression ---------- */
  const P = BW.Progress = { pendingLevelUps: [] };
  Object.defineProperty(P, 'player', { get: () => Store.player });   // P.player === Store.player
  const pl = () => Store.player;
  P.save = () => Store.save();

  P.levelInfo = () => { const p = pl(), need = CFG.xpNeed(p.level); return { level: p.level, xp: p.xp, need, pct: clamp(p.xp / need * 100, 0, 100) }; };

  P.addCoins = n => { if (n > 0) { pl().coins += Math.round(n); Store.save(); } };

  P.addXP = n => {
    const p = pl();
    p.xp += Math.max(0, Math.round(n));
    while (p.xp >= CFG.xpNeed(p.level) && p.level < 300) {
      p.xp -= CFG.xpNeed(p.level);
      const from = p.level, to = ++p.level;
      const coins = CFG.levelCoins(to);
      p.coins += coins;
      const items = BW.rewardsForLevel(to);
      items.forEach(it => { if (it.kind === 'skin') P.grantSkin(it.key); });
      const info = { from, to, coins, items };
      P.pendingLevelUps.push(info);
      BW.emit('levelup', info);
    }
    P.syncUnlocks();
    Store.save();
  };

  /* --- weapons / skins / agents / crosshair --- */
  P.weaponUnlocked = id => { const w = BW.weapon(id); return !!w && pl().level >= w.level; };
  P.skinOwned = (w, s) => s === 'default' || !!pl().inventory.skins[w + ':' + s];
  P.equippedSkinId = w => { const s = pl().equipment.skins[w]; return s && P.skinOwned(w, s) ? s : 'default'; };
  P.equippedSkin = w => BW.skin(P.equippedSkinId(w));
  P.grantSkin = key => { if (BW.skinKeyValid(key)) { pl().inventory.skins[key] = true; BW.emit('unlock', { kind: 'skin', key }); } };

  P.equipWeapon = (slot, id) => {
    const eq = pl().equipment;
    if (!P.weaponUnlocked(id) || slot < 0 || slot > 2) return false;
    const other = eq.slots.indexOf(id);
    if (other >= 0) eq.slots[other] = eq.slots[slot];     // swap if already in another slot
    eq.slots[slot] = id;
    Store.save(); return true;
  };
  P.buySkin = (w, s) => {
    const p = pl(), sk = BW.skin(s), key = w + ':' + s;
    if (P.skinOwned(w, s)) return { ok: false, reason: 'owned' };
    if (BW.SKIN_LOCKS[key]) return { ok: false, reason: 'locked' };
    if (p.coins < sk.price) return { ok: false, reason: 'coins' };
    p.coins -= sk.price; p.inventory.skins[key] = true;
    Store.saveNow(); return { ok: true };
  };
  P.equipSkin = (w, s) => { if (!P.skinOwned(w, s)) return false; pl().equipment.skins[w] = s; Store.save(); return true; };

  P.agentUnlocked = a => agentOk(pl(), a);
  P.syncUnlocks = () => {
    const p = pl();
    BW.AGENTS.forEach(a => {
      if (!p.inventory.agents[a.id] && P.agentUnlocked(a)) { p.inventory.agents[a.id] = true; BW.emit('unlock', { kind: 'agent', id: a.id, name: a.name }); }
    });
  };
  P.equipAgent = id => { if (!pl().inventory.agents[id]) return false; pl().equipment.agent = id; Store.save(); return true; };
  P.crosshairUnlocked = c => pl().level >= c.level;
  P.setCrosshair = cfg => { Object.assign(pl().crosshair, cfg); Store.save(); };

  /* --- achievements --- */
  P.evaluate = () => {
    const p = pl();
    BW.ACHIEVEMENTS.forEach(a => {
      if (p.achievements[a.id] || (p.stats[a.stat] || 0) < a.target) return;
      p.achievements[a.id] = Date.now();
      p.coins += a.coins;
      BW.emit('achievement', a);
      P.addXP(a.xp);
    });
  };

  /* --- missions (deterministic per local day / week) --- */
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  BW.dayKey = dayKey; BW.weekStart = weekStart;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  BW.rng = rng; BW.hash = hash;
  const pick = (pool, n, key) => {
    const r = rng(hash(key)), a = pool.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  };
  P.ensureMissions = () => {
    const m = pl().missions, now = new Date(), dk = dayKey(now), wk = dayKey(weekStart(now));
    if (m.day !== dk || m.daily.length !== 3) {
      m.day = dk;
      m.daily = pick(BW.MISSIONS.daily, 3, 'daily' + dk).map(d => ({ id: d.id, progress: 0, done: false }));
    }
    if (m.week !== wk || !m.weekly) {
      m.week = wk;
      m.weekly = { id: pick(BW.MISSIONS.weekly, 1, 'weekly' + wk)[0].id, progress: 0, done: false };
    }
  };
  BW.timeToDailyReset = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n; };
  BW.timeToWeeklyReset = () => { const n = new Date(), s = weekStart(n); s.setDate(s.getDate() + 7); return s - n; };

  function missionEvent(stat, val) {
    P.ensureMissions();
    const m = pl().missions, list = m.daily.concat([m.weekly]);
    list.forEach(rec => {
      const def = BW.missionDef(rec.id);
      if (!def || rec.done || def.stat !== stat) return;
      rec.progress = def.kind === 'max' ? Math.max(rec.progress, val) : rec.progress + val;
      if (rec.progress >= def.target) {
        rec.progress = def.target; rec.done = true;
        pl().coins += def.coins;
        if (def.skin) P.grantSkin(def.skin);
        BW.emit('mission', def);
        P.addXP(def.xp);
      }
    });
  }
  P.trackerMission = () => {
    const m = pl().missions, rec = m.daily.find(r => !r.done) || (m.weekly && !m.weekly.done ? m.weekly : null);
    if (!rec) return null;
    const def = BW.missionDef(rec.id);
    return def ? { name: def.name, progress: rec.progress, target: def.target } : null;
  };

  /* --- live stat tracking (called by the game) --- */
  P.track = (evt, d) => {
    const s = pl().stats;
    switch (evt) {
      case 'shot': s.shots++; break;
      case 'hit': s.hits++; break;
      case 'miss': s.misses++; break;
      case 'hostage': s.hostages++; break;
      case 'escape': s.escaped++; break;
      case 'kill':
        s.kills++; if (d.head) s.headshots++;
        s.fav[d.weapon] = (s.fav[d.weapon] || 0) + 1;
        missionEvent('kills', 1); if (d.head) missionEvent('headshots', 1);
        P.syncUnlocks(); P.evaluate(); break;
      case 'combo': s.bestCombo = Math.max(s.bestCombo, d); missionEvent('combo', d); P.evaluate(); break;
      case 'streak': s.bestHeadStreak = Math.max(s.bestHeadStreak, d); P.evaluate(); break;
    }
    Store.save();
  };

  /* --- end of round: returns the completion bonus (caller applies the mode multiplier) --- */
  P.finishMatch = sum => {
    const s = pl().stats;
    s.games++; s.playTime += sum.time;
    s.bestScore = Math.max(s.bestScore, sum.score);
    if (sum.mode === 'endless') s.bestEndless = Math.max(s.bestEndless, Math.floor(sum.time));
    if (sum.shots >= 20) s.bestRoundAcc = Math.max(s.bestRoundAcc, sum.acc);
    if (!sum.hostages) s.bestCleanRound = Math.max(s.bestCleanRound, sum.kills);
    const p = pl();
    p.scores.push({ s: sum.score, t: Date.now(), m: sum.mode });
    if (p.scores.length > 300) p.scores.shift();
    p.lastRun = { t: Date.now(), mode: sum.mode, score: sum.score, kills: sum.kills, heads: sum.heads, shots: sum.shots, hits: sum.hits, combo: sum.bestCombo, time: Math.round(sum.time) };
    missionEvent('games', 1); missionEvent('score', sum.score);
    if (sum.shots >= 20) missionEvent('acc', sum.acc);
    P.syncUnlocks(); P.evaluate();
    Store.saveNow();
    const perfect = sum.shots >= 20 && sum.acc >= 90 && !sum.hostages;
    return { xp: CFG.XP.complete + (perfect ? CFG.XP.perfect : 0), coins: CFG.COINS.complete, perfect };
  };

  /* ---------- leaderboard (local; swap get() for a fetch() when a backend exists) ---------- */
  const NAMES = ['NIGHTFALL', 'NEXUS', 'VOID', 'RAVEN', 'ORACLE', 'HAVOC', 'ZENITH', 'KESTREL', 'SABLE', 'OBELISK'];
  const TOP = { daily: 15000, weekly: 24000, monthly: 34000, all: 45000 };
  BW.Leaderboard = {
    PERIODS: [['daily', 'DAILY'], ['weekly', 'WEEKLY'], ['monthly', 'MONTHLY'], ['all', 'ALL TIME']],
    get(period) {
      const now = new Date();
      const since = { daily: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
                      weekly: weekStart(now).getTime(), monthly: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), all: 0 }[period] || 0;
      const key = period + ':' + (period === 'daily' ? dayKey(now) : period === 'weekly' ? dayKey(weekStart(now)) : period === 'monthly' ? dayKey(now).slice(0, 7) : 'x');
      const r = rng(hash(key));
      const rows = NAMES.map((n, i) => ({ name: n, score: Math.round(TOP[period] * (1 - i * 0.085) * (0.95 + r() * 0.1)), you: false }));
      const p = pl();
      let best = 0;
      p.scores.forEach(s => { if (s.t >= since && s.s > best) best = s.s; });
      if (period === 'all') best = Math.max(best, p.stats.bestScore);
      rows.push({ name: p.username, score: best, you: true });
      rows.sort((a, b) => b.score - a.score);
      rows.forEach((x, i) => { x.rank = i + 1; });
      return rows;
    }
  };

  Store.load();
  P.ensureMissions();
  P.syncUnlocks();
})();
