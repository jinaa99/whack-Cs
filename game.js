/* ==========================================================
   BREACH & WHACK — GAMEPLAY

   Core loop (unchanged from the original): game clock → update()
   → spawn / expire → tryFire() → elementFromPoint hit detection →
   hitEnemy / hitHostage / miss → render() with change-detection.

   Scoring
   ─────────────────────────────────────────────
   kill points   = weapon pts × (headshot ? weapon.head : 1) × combo mult
   combo mult    = 1 + min(combo, 10) × 0.1
   chain bonus   = every 5th kill in a row → +10 × combo
   pierce        = Mantis AWP also drops a second agent
   hostage       = −150, combo broken (Endless: −1 life)
   miss / escape = combo broken (Endless escape: −1 life)
   round end     = accuracy bonus = accuracy% × 5  (≥ 10 shots)
   XP / coins    = see BW.CFG (kill 25 / headshot 40 XP …), × mode.rewardMul
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, { clamp, fmt } = BW;
  const P = BW.Progress, Art = BW.Art, FX = BW.FX, A = BW.Audio, CFG = BW.CFG;

  /* ---------- config ---------- */
  const HOLE_COUNT = 9, LEVEL_SECONDS = 12, HOSTAGE_TIME = 1500, HOSTAGE_PENALTY = 150;
  const COMBO_CAP = 10, CHAIN_EVERY = 5, REWARD_DIVISOR = 30, MAX_MARKS = 14;
  const ACC_BONUS_MIN_SHOTS = 10, ACC_BONUS_PER_PCT = 5, DEAD_LINGER = 260, COUNTDOWN = 3;
  const BOARD_W = 756, BOARD_H = 546;                 // natural board size (before --fit scaling)
  const RARITY_ROLL = [[0.02, 'legendary'], [0.10, 'epic'], [0.30, 'rare']];

  /* ---------- DOM ---------- */
  const $ = id => document.getElementById(id);
  const app = $('app'), stage = $('stage'), grid = $('grid'), marksLayer = $('marks');
  const crosshair = $('crosshair'), xh = $('xh'), muzzle = $('muzzle'), notifEl = $('notif');
  const slotList = $('slotList'), weaponView = $('weaponView'), wvArt = $('wvArt'), wvMuzzle = $('wvMuzzle'), wvFlash = $('wvFlash');
  const hitmarker = $('hitmarker'), countdownEl = $('countdown');
  const ui = {};
  ['score', 'time', 'timeLabel', 'lives', 'combo', 'fire', 'comboBox', 'rewardFill', 'ammoCount', 'ammoHint', 'reloadFill', 'instruction',
   'intelBest', 'intelAcc', 'intelHeads', 'intelKills', 'pcAvatar', 'pcName', 'pcLevel', 'pcXpFill', 'pcXpText', 'pcCoins', 'pcNext',
   'mtTitle', 'mtFill', 'mtText', 'modeTag', 'fxHeat'].forEach(id => { ui[id] = $(id); });

  /* ---------- state ---------- */
  const state = {
    phase: 'menu',                 // menu | countdown | play | paused | over
    mode: BW.MODES[0], score: 0, timeLeft: 60, elapsed: 0, level: 1, lives: 0,
    combo: 0, bestCombo: 0, headStreak: 0, bestHeadStreak: 0,
    slots: ['viper', 'mantis', 'raven'], weapon: 'viper', ammo: {},
    reloadUntil: 0, reloadWeapon: null, lastShot: -1e9, nextSpawn: 0,
    shots: 0, hits: 0, kills: 0, heads: 0, hostages: 0, escaped: 0, accBonus: 0,
    reward: 0, mxp: 0, mcoins: 0, countdown: 0, lastCount: 0
  };
  let clock = 0;                   // advances only while playing → pause "just works"
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, held: false };
  const holes = [];
  let notifTimer = 0, kickTimer = 0, goTimer = 0, hurtTimer = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const W = () => BW.weapon(state.weapon);
  const accuracy = () => (state.shots ? Math.round((state.hits / state.shots) * 100) : 0);
  const inRound = () => state.phase === 'play' || state.phase === 'countdown' || state.phase === 'paused';
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  /* ---------- build board ---------- */
  function buildHoles() {
    const tpl = i => `
      <div class="hole-plate"></div>
      <div class="hole-glow"></div>
      <div class="hole-rim"></div>
      <div class="hole-wall"></div>
      <div class="hole-pit"></div>
      <div class="hole-clip"><div class="popper">${Art.agentHTML(BW.ENEMY_LOOKS[0])}</div></div>
      <div class="hole-shade"></div>
      <div class="hit hit-head" data-hole="${i}" data-part="head"></div>
      <div class="hit hit-body" data-hole="${i}" data-part="body"></div>
      <div class="hole-lip"></div>`;
    for (let i = 0; i < HOLE_COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'hole';
      el.innerHTML = tpl(i);
      grid.appendChild(el);
      holes.push({ i, el, occ: null, popper: el.querySelector('.popper'), agent: el.querySelector('.agent') });
    }
  }

  function buildSlots() {
    slotList.innerHTML = state.slots.map((id, i) => {
      const w = BW.weapon(id), sk = P.equippedSkin(id);
      return `<button class="slot" type="button" data-slot="${i}"><span class="slot-art" style="${Art.skinVars(sk)}">${Art.weaponSVG(w, sk.p)}</span>` +
             `<span class="slot-name">${w.name}</span><span class="slot-key">KEY ${i + 1}</span></button>`;
    }).join('');
  }

  function setWeaponView() {
    const w = W(), sk = P.equippedSkin(w.id), m = Art.muzzle(w.art);
    wvArt.innerHTML = Art.weaponSVG(w, sk.p);
    wvArt.style.cssText = Art.skinVars(sk);
    wvMuzzle.style.left = (m[0] / 320 * 100) + '%';
    wvMuzzle.style.top = (m[1] / 110 * 100) + '%';
    wvFlash.style.left = wvMuzzle.style.left; wvFlash.style.top = wvMuzzle.style.top;
    restart(weaponView, 'switch');
    applyCrosshair();
  }

  function applyCrosshair() {
    Art.applyXh(xh, P.player.crosshair, state.phase === 'menu' ? 0 : W().cross);
  }

  /* ---------- fit board to the viewport ---------- */
  function fit() {
    const w = innerWidth, h = innerHeight;
    const aw = w - (w > 1050 ? 2 * 196 : 0) - 32, ah = h - 250;
    app.style.setProperty('--fit', clamp(Math.min(aw / (BOARD_W * 1.1), ah / BOARD_H), 0.4, 1.15).toFixed(3));
  }

  /* ---------- effects ---------- */
  function kick(mag) {
    const shake = P.player.settings.shake;
    const m = (shake ? 1 : 0) * (reducedMotion ? mag * 0.3 : mag), r = () => Math.random() - 0.5;
    stage.style.transform = m ? `translate(${r() * m}px, ${r() * m}px) rotate(${r() * m * 0.08}deg)` : '';
    restart(muzzle, 'shot');
    restart(weaponView, 'kick'); restart(wvFlash, 'on');
    clearTimeout(kickTimer);
    kickTimer = setTimeout(() => { stage.style.transform = ''; }, 110);
  }

  function addPop(hole, text, color, size) {
    const p = document.createElement('div');
    p.className = 'pop'; p.textContent = text; p.style.color = color; p.style.fontSize = size + 'px';
    hole.el.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
    setTimeout(() => p.remove(), 1200);
  }

  function addMark() {
    const m = document.createElement('div');
    m.className = 'mark';
    m.style.left = (8 + Math.random() * 84) + '%'; m.style.top = (8 + Math.random() * 84) + '%';
    marksLayer.appendChild(m);
    while (marksLayer.children.length > MAX_MARKS) marksLayer.firstChild.remove();
  }

  function notify(text) {
    notifEl.hidden = true; void notifEl.offsetWidth;
    notifEl.textContent = text; notifEl.hidden = false;
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => { notifEl.hidden = true; }, 2200);
  }

  function hitMarker(kind) {
    hitmarker.style.setProperty('--hx', pointer.x + 'px'); hitmarker.style.setProperty('--hy', pointer.y + 'px');
    hitmarker.className = 'hitmarker hm-' + kind;
    void hitmarker.offsetWidth;
    hitmarker.classList.add('go');
  }

  function barrelPoint() { const r = wvMuzzle.getBoundingClientRect(); return [r.left, r.top]; }

  function hurt() {
    app.classList.add('hurt'); clearTimeout(hurtTimer);
    hurtTimer = setTimeout(() => app.classList.remove('hurt'), 260);
  }

  /* ---------- rewards ---------- */
  function gain(xp, coins) {
    const mul = state.mode.rewardMul || 1;
    xp = Math.round(xp * mul); coins = Math.round(coins * mul);
    if (xp) { state.mxp += xp; P.addXP(xp); }
    if (coins) { state.mcoins += coins; P.addCoins(coins); }
  }

  /* ---------- holes ---------- */
  function rollRarity() {
    const r = Math.random();
    for (const [t, name] of RARITY_ROLL) if (r < t) return name;
    return 'common';
  }

  function pickLook() {
    if (Math.random() < 0.6) return BW.agent(P.player.equipment.agent).look;     // equipped agent = enemy style
    return BW.ENEMY_LOOKS[Math.floor(Math.random() * BW.ENEMY_LOOKS.length)];
  }

  function setOccupant(h, occ) {
    h.occ = occ;
    if (occ) Art.applyLook(h.agent, occ.look, { hostage: occ.type === 'hostage', rarity: occ.type === 'enemy' ? occ.rarity : '' });
    paintHole(h);
  }

  function paintHole(h) {
    const o = h.occ, up = !!o && !o.dead;
    h.popper.classList.toggle('up', up);
    h.popper.classList.toggle('dead', !!o && o.dead);
    h.el.classList.toggle('active', up);
    h.el.classList.toggle('hostage', up && o.type === 'hostage');
  }

  function kill(h) { h.occ.dead = true; h.occ.deadAt = clock; paintHole(h); }

  function clearHoles() {
    holes.forEach(h => { h.occ = null; paintHole(h); h.el.querySelectorAll('.pop').forEach(p => p.remove()); });
  }

  /* ---------- round flow ---------- */
  const level = () => 1 + Math.floor((state.mode.time ? state.mode.time - state.timeLeft : state.elapsed) / LEVEL_SECONDS);

  function start(modeId) {
    const mode = BW.MODES.find(m => m.id === modeId && !m.soon) || BW.MODES[0];
    P.ensureMissions();
    const slots = P.player.equipment.slots.slice();
    const ammo = {};
    slots.forEach(id => { ammo[id] = BW.weapon(id).mag; });
    Object.assign(state, {
      phase: 'countdown', mode, score: 0, timeLeft: mode.time || 0, elapsed: 0, level: 1, lives: mode.lives,
      combo: 0, bestCombo: 0, headStreak: 0, bestHeadStreak: 0, slots, weapon: slots[0], ammo,
      reloadUntil: 0, reloadWeapon: null, lastShot: -1e9, nextSpawn: 0,
      shots: 0, hits: 0, kills: 0, heads: 0, hostages: 0, escaped: 0, accBonus: 0, reward: 0, mxp: 0, mcoins: 0,
      countdown: COUNTDOWN + 0.999, lastCount: 0
    });
    clock = 0; pointer.held = false;
    clearHoles(); marksLayer.innerHTML = '';
    app.classList.add('in-game'); app.dataset.ctx = 'game';
    if (BW.UI) BW.UI.hideAll();
    fit(); buildSlots(); setWeaponView();
    ui.pcAvatar.innerHTML = Art.avatar(P.player.avatar);
    P.player.settings.lastMode = mode.id; P.save();
    A.sfx('start');
  }

  function tickCountdown(dt) {
    state.countdown -= dt / 1000;
    const n = Math.ceil(state.countdown);
    if (state.countdown <= 0) {
      state.phase = 'play';
      countdownEl.textContent = 'GO'; countdownEl.hidden = false; restart(countdownEl, 'cd');
      A.sfx('go');
      clearTimeout(goTimer); goTimer = setTimeout(() => { countdownEl.hidden = true; }, 650);
      return;
    }
    if (n !== state.lastCount) {
      state.lastCount = n;
      countdownEl.textContent = String(n); countdownEl.hidden = false; restart(countdownEl, 'cd');
      A.sfx('tick');
    }
  }

  function pause() {
    if (state.phase !== 'play') return;
    state.phase = 'paused'; pointer.held = false;
    app.dataset.ctx = 'menu';
    BW.UI.show('pause');
  }
  function resume() {
    if (state.phase !== 'paused') return;
    state.phase = 'play'; app.dataset.ctx = 'game';
    BW.UI.hideAll();
  }
  function quit() {
    state.phase = 'menu'; pointer.held = false;
    clearHoles(); countdownEl.hidden = true;
    app.classList.remove('in-game', 'scoped'); app.dataset.ctx = 'menu';
    BW.UI.show('menu');
  }

  function endRound() {
    state.phase = 'over'; pointer.held = false;
    app.dataset.ctx = 'menu';
    clearHoles();
    const prevBest = P.player.stats.bestScore;
    const acc = accuracy();
    state.accBonus = state.shots >= ACC_BONUS_MIN_SHOTS ? acc * ACC_BONUS_PER_PCT : 0;
    state.score += state.accBonus;
    const sum = {
      mode: state.mode.id, modeName: state.mode.name, score: state.score, kills: state.kills, heads: state.heads,
      shots: state.shots, hits: state.hits, acc, bestCombo: state.bestCombo, hostages: state.hostages, escaped: state.escaped,
      time: state.elapsed, accBonus: state.accBonus, newBest: state.score > prevBest && state.score > 0
    };
    const bonus = P.finishMatch(sum);
    gain(bonus.xp, bonus.coins);
    sum.perfect = bonus.perfect; sum.xp = state.mxp; sum.coins = state.mcoins;
    A.sfx('over');
    BW.UI.showGameOver(sum);
  }

  function loseLife(reason) {
    if (!state.mode.lives) return;
    state.lives--;
    hurt();
    if (state.lives <= 0) { endRound(); return; }
    notify(reason + ' · ' + state.lives + ' LIVES LEFT');
  }

  /* ---------- weapons ---------- */
  function pickSlot(i) {
    const id = state.slots[i];
    if (!id || id === state.weapon || !inRound()) return;
    state.weapon = id; state.reloadUntil = 0; state.reloadWeapon = null;
    A.sfx('switch'); setWeaponView();
  }

  function startReload() {
    const w = W();
    if (state.reloadUntil || state.ammo[w.id] === w.mag) return;
    state.reloadUntil = clock + w.reload; state.reloadWeapon = w.id;
    A.sfx('reload');
  }
  function finishReload() {
    if (state.reloadUntil && clock >= state.reloadUntil) {
      state.ammo[state.reloadWeapon] = BW.weapon(state.reloadWeapon).mag;
      state.reloadUntil = 0; state.reloadWeapon = null;
      A.sfx('reloaded');
    }
  }

  /* ---------- shooting ---------- */
  function spreadPoint(x, y, spread) {
    if (!spread) return [x, y];
    const r = spread * Math.sqrt(Math.random()), a = Math.random() * 6.283;
    return [x + r * Math.cos(a), y + r * Math.sin(a)];
  }

  function tryFire(x, y) {
    if (state.phase !== 'play' || state.reloadUntil) return;
    const w = W();
    if (clock - state.lastShot < w.rate) return;
    if (state.ammo[w.id] <= 0) { startReload(); return; }

    state.lastShot = clock; state.ammo[w.id]--; state.shots++;
    P.track('shot');
    A.sfx('shot_' + w.art);
    kick(w.recoil);
    const bp = barrelPoint(); FX.smoke(bp[0], bp[1], w.art === 'sniper' || w.art === 'shotgun' ? 3 : 1);
    if (state.ammo[w.id] <= 0) startReload();

    // every pellet is a separate hit-test (1 for normal guns)
    const found = new Map();
    for (let i = 0; i < (w.pellets || 1); i++) {
      const [px, py] = spreadPoint(x, y, w.spread);
      const el = document.elementFromPoint(px, py);
      const part = el && el.closest && el.closest('[data-part]');
      if (part) {
        const idx = +part.dataset.hole, head = part.dataset.part === 'head', prev = found.get(idx);
        found.set(idx, { head: (prev && prev.head) || head, x: px, y: py });
      } else if (w.pellets) FX.impact(px, py);
    }

    let hitAny = false, enemyHit = false;
    found.forEach((f, idx) => {
      const h = holes[idx];
      if (!h.occ || h.occ.dead) return;
      if (h.occ.type === 'hostage') { hitAny = true; hitHostage(h, f); return; }
      if (state.mode.headOnly && !f.head) { addPop(h, 'HEADSHOTS ONLY', '#9a948a', 18); FX.sparks(f.x, f.y, 4, '#9a948a'); return; }
      hitAny = true; enemyHit = true;
      hitEnemy(h, f.head, w, f);
    });
    if (enemyHit) { state.hits++; P.track('hit'); }
    if (!hitAny) miss(x, y);
  }

  function miss(x, y) {
    state.combo = 0; state.headStreak = 0;
    P.track('miss');
    A.sfx('miss');
    addMark(); FX.impact(x, y);
  }

  function hitHostage(h, f) {
    A.sfx('bad'); hitMarker('bad'); hurt();
    addPop(h, `FRIENDLY FIRE -${HOSTAGE_PENALTY}`, '#ff4d4d', 22);
    FX.sparks(f.x, f.y, 10, '#ff4d4d');
    state.score = Math.max(0, state.score - HOSTAGE_PENALTY);
    state.combo = 0; state.headStreak = 0; state.hostages++;
    P.track('hostage');
    kill(h);
    if (state.mode.lives) loseLife('FRIENDLY FIRE'); else notify('FRIENDLY FIRE · -' + HOSTAGE_PENALTY + ' · COMBO BROKEN');
  }

  function hitEnemy(h, head, w, f) {
    state.kills++;
    if (head) { state.heads++; state.headStreak++; state.bestHeadStreak = Math.max(state.bestHeadStreak, state.headStreak); P.track('streak', state.headStreak); }
    else state.headStreak = 0;
    P.track('kill', { head, weapon: w.id });
    A.sfx(head ? 'headshot' : 'hit'); hitMarker(head ? 'head' : 'body');
    FX.sparks(f.x, f.y, head ? 16 : 9, head ? '#ff6a3a' : '#ffc46b');

    const prevCombo = state.combo;
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    P.track('combo', state.combo);
    comboFeedback(prevCombo);

    const mult = 1 + Math.min(state.combo, COMBO_CAP) * 0.1;
    let gained = Math.round(w.pts * (head ? w.head : 1) * mult);
    addPop(h, head ? `HEADSHOT +${gained}` : `+${gained}`, head ? '#ff4d4d' : '#ffc46b', head ? 26 : 22);
    kill(h);
    gain(head ? CFG.XP.head : CFG.XP.kill, head ? CFG.COINS.head : CFG.COINS.kill);

    if (w.pierce) {                                     // Mantis AWP goes through
      const other = holes.find(o => o !== h && o.occ && !o.occ.dead && o.occ.type === 'enemy');
      if (other) {
        const extra = Math.round(w.pts * mult);
        gained += extra; state.kills++;
        P.track('kill', { head: false, weapon: w.id });
        addPop(other, `PIERCE +${extra}`, '#ffc46b', 20);
        kill(other); gain(CFG.XP.kill, CFG.COINS.kill);
      }
    }

    if (state.combo % CHAIN_EVERY === 0) {
      const bonus = state.combo * 10;
      gained += bonus;
      notify(`COMBO x${state.combo} · +${bonus}`);
      A.sfx('combo');
      gain(CFG.XP.chain, CFG.COINS.chain);
    }

    state.score += gained;
    addReward(gained);
  }

  function comboFeedback(prev) {
    restart(ui.comboBox, 'pulse');
    const heat = state.combo >= 15 ? 3 : state.combo >= 10 ? 2 : state.combo >= 5 ? 1 : 0;
    if (heat !== +(ui.fxHeat.dataset.heat || 0)) ui.fxHeat.dataset.heat = heat;
    if (state.combo >= 10 && state.combo % 5 === 0) restart(app, 'combo-flash');
    if (prev === 0) return;
  }

  function addReward(points) {
    state.reward += points / REWARD_DIVISOR;
    while (state.reward >= 100) {
      state.reward -= 100;
      gain(0, CFG.COINS.supply);
      notify('SUPPLY DROP · +' + Math.round(CFG.COINS.supply * state.mode.rewardMul) + ' COINS');
      A.sfx('combo');
    }
  }

  /* ---------- simulation ---------- */
  function update(dt) {
    clock += dt;
    state.elapsed += dt / 1000;
    if (state.mode.time) {
      state.timeLeft -= dt / 1000;
      if (state.timeLeft <= 0) { state.timeLeft = 0; endRound(); return; }
    }
    const lv = level();
    if (lv !== state.level) { state.level = lv; notify('LEVEL ' + lv); }

    finishReload();
    if (pointer.held && W().auto) tryFire(pointer.x, pointer.y);

    const mode = state.mode;
    for (const h of holes) {                           // dead linger, escapes
      const o = h.occ;
      if (!o) continue;
      if (o.dead) { if (clock - o.deadAt > DEAD_LINGER) setOccupant(h, null); }
      else if (clock - o.t0 > o.dur) {
        if (o.type === 'enemy') {
          state.escaped++; state.combo = 0; state.headStreak = 0;
          P.track('escape');
          setOccupant(h, null);
          if (mode.lives) { loseLife('AGENT ESCAPED'); if (state.phase !== 'play') return; }
        } else setOccupant(h, null);
      }
    }

    const alive = holes.filter(h => h.occ && !h.occ.dead).length;
    const maxUp = Math.min(2 + lv, 5) + mode.maxUpBonus;
    if (alive < maxUp && clock >= state.nextSpawn) {
      const free = holes.filter(h => !h.occ);
      if (free.length) {
        const h = free[Math.floor(Math.random() * free.length)];
        const hostage = Math.random() < mode.hostageChance;
        setOccupant(h, {
          type: hostage ? 'hostage' : 'enemy',
          look: hostage ? BW.HOSTAGE_LOOK : pickLook(),
          rarity: rollRarity(),
          t0: clock,
          dur: hostage ? HOSTAGE_TIME : Math.max(520, 2100 - lv * 170) * mode.durMul,
          dead: false
        });
      }
      state.nextSpawn = clock + (Math.max(260, 900 - lv * 90) + Math.random() * 300) * mode.spawnMul;
    }
  }

  /* ---------- HUD rendering (writes only when a value changed) ---------- */
  const cache = new Map();
  const setText = (n, v) => { if (cache.get(n) !== v) { n.textContent = v; cache.set(n, v); } };
  const setW = (n, v) => { if (cache.get(n) !== v) { n.style.width = v; cache.set(n, v); } };
  const toggle = (n, c, on) => { if (n.classList.contains(c) !== on) n.classList.toggle(c, on); };
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  function render() {
    const s = state, w = W(), p = P.player;
    const timed = !!s.mode.time, secs = timed ? Math.ceil(s.timeLeft) : Math.floor(s.elapsed);

    setText(ui.score, fmt(s.score));
    setText(ui.time, mmss(secs));
    setText(ui.timeLabel, timed ? 'TIME' : 'SURVIVED');
    toggle(ui.time, 'low', timed && s.phase === 'play' && secs <= 10);
    setText(ui.lives, s.mode.lives ? '♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(Math.max(0, s.mode.lives - s.lives)) : '');
    setText(ui.modeTag, s.mode.name);
    setText(ui.combo, 'x' + s.combo);
    ui.fire.style.setProperty('--fire', 1 + Math.min(s.combo, COMBO_CAP) * 0.07);
    if (s.combo === 0 && ui.fxHeat.dataset.heat !== '0') ui.fxHeat.dataset.heat = 0;
    setW(ui.rewardFill, Math.min(100, s.reward) + '%');

    const reloading = !!s.reloadUntil;
    setText(ui.ammoCount, reloading ? '· ·' : s.ammo[w.id] + '/' + w.mag);
    toggle(ui.ammoCount, 'reloading', reloading);
    toggle(ui.ammoCount, 'low', !reloading && s.ammo[w.id] <= 2);
    setText(ui.ammoHint, reloading ? 'RELOADING' : 'PRESS R');
    setW(ui.reloadFill, reloading ? Math.min(100, 100 - ((s.reloadUntil - clock) / BW.weapon(s.reloadWeapon).reload) * 100) + '%' : '0%');

    setText(ui.instruction,
      s.phase === 'play' ? `LEVEL ${s.level} · DROP THE ENEMY AGENTS!` :
      s.phase === 'paused' ? 'PAUSED' : s.phase === 'countdown' ? 'GET READY' : 'RANGE STANDBY');

    setText(ui.intelBest, fmt(Math.max(p.stats.bestScore, s.score)));
    setText(ui.intelAcc, s.shots ? accuracy() + '%' : '--');
    setText(ui.intelHeads, String(s.heads));
    setText(ui.intelKills, String(s.kills));

    const li = P.levelInfo();
    setText(ui.pcLevel, 'LV ' + li.level);
    setText(ui.pcName, p.username);
    setText(ui.pcCoins, fmt(p.coins));
    setText(ui.pcXpText, fmt(li.xp) + ' / ' + fmt(li.need) + ' XP');
    setW(ui.pcXpFill, li.pct.toFixed(1) + '%');
    const nu = BW.nextUnlock(li.level);
    setText(ui.pcNext, nu ? 'LV ' + nu.level + ' · ' + nu.items[0].name : 'ALL REWARDS UNLOCKED');

    const mt = P.trackerMission();
    setText(ui.mtTitle, mt ? mt.name : 'ALL DAILY MISSIONS DONE');
    setText(ui.mtText, mt ? fmt(mt.progress) + ' / ' + fmt(mt.target) : '✓');
    setW(ui.mtFill, mt ? Math.min(100, mt.progress / mt.target * 100).toFixed(0) + '%' : '100%');

    slotList.querySelectorAll('.slot').forEach((b, i) => toggle(b, 'active', state.slots[i] === s.weapon));
    toggle(app, 'scoped', !!w.scope && s.phase === 'play');
  }

  /* ---------- input ---------- */
  function movePointer(e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    crosshair.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    app.style.setProperty('--mx', e.clientX + 'px');
    app.style.setProperty('--my', e.clientY + 'px');
    app.style.setProperty('--ry', ((e.clientX / innerWidth - 0.5) * 5).toFixed(2) + 'deg');
    app.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * 2).toFixed(3));
  }

  app.addEventListener('pointermove', movePointer);
  app.addEventListener('pointerdown', e => {
    movePointer(e);
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, .screen, input, select')) return;   // UI, not a shot
    if (state.phase !== 'play') return;
    pointer.held = true;
    tryFire(e.clientX, e.clientY);
  });
  addEventListener('pointerup', () => { pointer.held = false; });
  addEventListener('pointercancel', () => { pointer.held = false; });
  addEventListener('blur', () => { pointer.held = false; });
  app.addEventListener('contextmenu', e => e.preventDefault());

  slotList.addEventListener('click', e => {
    const b = e.target.closest('.slot');
    if (b) pickSlot(+b.dataset.slot);
  });

  addEventListener('keydown', e => {
    if (!inRound()) return;
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === '1') pickSlot(0);
    else if (k === '2') pickSlot(1);
    else if (k === '3') pickSlot(2);
    else if (k === 'r') { if (state.phase === 'play') startReload(); }
    else if (k === 'm') { P.player.settings.muted = !P.player.settings.muted; P.player.settings.muted || A.sfx('click'); P.save(); }
    else if (k === 'p' || k === 'escape') { state.phase === 'paused' ? resume() : pause(); }
    else if (e.code === 'Space') { e.preventDefault(); if (state.phase === 'paused') resume(); }
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('resize', fit);

  /* ---------- main loop ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 100);              // clamp so a background tab can't skip time
    last = now;
    if (state.phase === 'countdown') tickCountdown(dt);
    else if (state.phase === 'play') update(dt);
    FX.step(dt / 1000); FX.draw();
    if (app.classList.contains('in-game')) render();
    requestAnimationFrame(frame);
  }

  /* ---------- public API (used by ui.js) ---------- */
  BW.Game = {
    start, pause, resume, quit,
    phase: () => state.phase,
    refreshCrosshair: applyCrosshair,
    fit
  };

  /* ---------- init ---------- */
  buildHoles();
  FX.init($('fx'));
  crosshair.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
  applyCrosshair();
  fit();
  requestAnimationFrame(frame);
})();
