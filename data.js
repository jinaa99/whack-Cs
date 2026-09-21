/* ==========================================================
   BREACH & WHACK — DATA (content definitions, no logic)
   Everything the player can unlock or equip is declared here,
   so new weapons / skins / agents / missions are one-line edits.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW = { version: 2 };

  /* ---------- tiny helpers + event bus ---------- */
  const bus = {};
  BW.on = (e, f) => { (bus[e] = bus[e] || []).push(f); };
  BW.emit = (e, d) => { (bus[e] || []).forEach(f => f(d)); };
  BW.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  BW.fmt = n => Math.round(n).toLocaleString('en-US');
  BW.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- reward numbers ---------- */
  BW.CFG = {
    XP:    { kill: 25, head: 40, chain: 100, complete: 100, perfect: 500 },
    COINS: { kill: 2,  head: 4,  chain: 10,  complete: 50,  supply: 75 },
    xpNeed: L => 400 + 370 * (L - 1),          // xp required to leave level L
    levelCoins: L => 100 + 15 * L              // coins granted on reaching level L
  };

  BW.RARITY = {
    common:    { name: 'COMMON',    color: '#9aa3ad' },
    rare:      { name: 'RARE',      color: '#4da3ff' },
    epic:      { name: 'EPIC',      color: '#b46bff' },
    legendary: { name: 'LEGENDARY', color: '#ffb020' }
  };

  /* ---------- weapons ----------
     pts    score per kill        rate   ms between shots
     dmg/acc/fr  1–10 bars        spread px of random aim error
     art    silhouette (pistol|rifle|smg|sniper|shotgun)              */
  BW.TYPES = [['pistol', 'PISTOLS'], ['rifle', 'RIFLES'], ['smg', 'SMG'], ['sniper', 'SNIPERS'], ['special', 'SPECIAL']];

  BW.WEAPONS = [
    { id: 'raven',    name: 'Raven-9',      type: 'pistol',  art: 'pistol',  level: 1,  pts: 60,  rate: 190,  mag: 12, reload: 1000, head: 2,   dmg: 4,  acc: 8,  fr: 9,  auto: false, recoil: 5,  spread: 2,  cross: 2, desc: 'Reliable starter sidearm. Light, quick, forgiving.' },
    { id: 'talon',    name: 'Talon-45',     type: 'pistol',  art: 'pistol',  level: 5,  pts: 75,  rate: 170,  mag: 15, reload: 1100, head: 2,   dmg: 5,  acc: 8,  fr: 8,  auto: false, recoil: 6,  spread: 2,  cross: 2, desc: 'Tactical pistol with a bigger magazine.' },
    { id: 'bulldog',  name: 'Bulldog .50',  type: 'pistol',  art: 'pistol',  level: 12, pts: 130, rate: 420,  mag: 7,  reload: 1500, head: 2.5, dmg: 8,  acc: 7,  fr: 4,  auto: false, recoil: 12, spread: 3,  cross: 3, desc: 'Heavy hand cannon. Slow, brutal headshots.' },
    { id: 'viper',    name: 'Viper-47',     type: 'rifle',   art: 'rifle',   level: 1,  pts: 100, rate: 105,  mag: 30, reload: 1500, head: 2,   dmg: 7,  acc: 6,  fr: 8,  auto: true,  recoil: 9,  spread: 6,  cross: 5, desc: 'Hard-hitting assault rifle. Hold to spray.' },
    { id: 'falcon',   name: 'Falcon AR',    type: 'rifle',   art: 'rifle',   level: 10, pts: 95,  rate: 90,   mag: 30, reload: 1400, head: 2,   dmg: 6,  acc: 8,  fr: 9,  auto: true,  recoil: 7,  spread: 4,  cross: 4, desc: 'Controllable rifle. Faster, tighter, a touch lighter.' },
    { id: 'specter',  name: 'Specter SMG',  type: 'smg',     art: 'smg',     level: 8,  pts: 55,  rate: 65,   mag: 40, reload: 1300, head: 1.6, dmg: 4,  acc: 5,  fr: 10, auto: true,  recoil: 5,  spread: 8,  cross: 6, desc: 'Sprays a wall of lead. Wild but huge magazine.' },
    { id: 'mantis',   name: 'Mantis AWP',   type: 'sniper',  art: 'sniper',  level: 1,  pts: 250, rate: 1350, mag: 5,  reload: 2800, head: 2,   dmg: 10, acc: 10, fr: 1,  auto: false, recoil: 22, spread: 0,  cross: 0, scope: true, pierce: true, desc: 'One shot, two agents. The bullet goes through.' },
    { id: 'wraith',   name: 'Wraith DMR',   type: 'sniper',  art: 'sniper',  level: 20, pts: 200, rate: 750,  mag: 8,  reload: 2200, head: 2.2, dmg: 8,  acc: 9,  fr: 3,  auto: false, recoil: 16, spread: 0,  cross: 0, scope: true, desc: 'Tactical marksman rifle. Fast follow-ups.' },
    { id: 'breacher', name: 'Breacher-12',  type: 'special', art: 'shotgun', level: 15, pts: 85,  rate: 850,  mag: 6,  reload: 2200, head: 1.5, dmg: 9,  acc: 3,  fr: 2,  auto: false, recoil: 20, spread: 34, pellets: 6, cross: 12, desc: 'Six pellets per shot. Clears a cluster.' }
  ];
  BW.weapon = id => BW.WEAPONS.find(w => w.id === id);

  /* ---------- weapon skins (cosmetic only) ----------
     c body colour · a accent · g glow · m metal sheen 0–1 · p pattern */
  BW.SKINS = [
    { id: 'default',    name: 'DEFAULT',     rarity: 'common',    price: 0,    c: '#4a4d52', a: '#ff8a00', g: 'transparent', m: 0.25, p: 'none' },
    { id: 'nightops',   name: 'NIGHT OPS',   rarity: 'common',    price: 600,  c: '#23272b', a: '#7a8f45', g: 'transparent', m: 0.15, p: 'stripe' },
    { id: 'bloodmoon',  name: 'BLOOD MOON',  rarity: 'rare',      price: 1500, c: '#4a1216', a: '#ff3b3b', g: '#ff3b3b55',   m: 0.35, p: 'chevron' },
    { id: 'phantom',    name: 'PHANTOM',     rarity: 'rare',      price: 1800, c: '#2e3a52', a: '#7fd0ff', g: '#7fd0ff44',   m: 0.4,  p: 'dots' },
    { id: 'cyber',      name: 'CYBER',       rarity: 'epic',      price: 3000, c: '#1b1030', a: '#00e5ff', g: '#00e5ff66',   m: 0.5,  p: 'stripe' },
    { id: 'obsidian',   name: 'OBSIDIAN',    rarity: 'epic',      price: 3500, c: '#0d0e10', a: '#b46bff', g: '#b46bff66',   m: 0.7,  p: 'chevron' },
    { id: 'goldenfang', name: 'GOLDEN FANG', rarity: 'legendary', price: 8000, c: '#b8892b', a: '#fff1b0', g: '#ffb02099',   m: 0.8,  p: 'dots' }
  ];
  BW.skin = id => BW.SKINS.find(s => s.id === id) || BW.SKINS[0];
  BW.skinKeyValid = k => { const [w, s] = String(k).split(':'); return !!BW.weapon(w) && BW.SKINS.some(x => x.id === s); };
  // skins that cannot be bought — earned only
  BW.SKIN_LOCKS = {
    'viper:goldenfang': { level: 30 },
    'mantis:goldenfang': { text: 'Weekly Operation: NO MERCY' }
  };

  /* ---------- agents (unlockable collection; also the enemy look) ---------- */
  BW.AGENTS = [
    { id: 'recon',   name: 'RECON',   rarity: 'common',    unlock: { type: 'default' },                  desc: 'Standard field operative.',
      look: { mask: '#4b4a33', mask2: '#2d2c20', torso: '#5a5541', eye: '#d8c9a6', vest: '#3a3a2a', acc: '#b4873f', helmet: false, visor: false } },
    { id: 'phantom', name: 'PHANTOM', rarity: 'rare',      unlock: { type: 'level', v: 10 },            desc: 'Silent infiltrator with a tinted visor.',
      look: { mask: '#3a3f44', mask2: '#22262a', torso: '#2c3034', eye: '#7fd0ff', vest: '#1c1f22', acc: '#7fd0ff', helmet: true,  visor: true } },
    { id: 'viper',   name: 'VIPER',   rarity: 'rare',      unlock: { type: 'headshots', v: 100 },       desc: 'Toxic-green strike specialist.',
      look: { mask: '#3d5a2c', mask2: '#22351a', torso: '#2c3d22', eye: '#c8ff6a', vest: '#1a2614', acc: '#8dff3a', helmet: false, visor: true } },
    { id: 'reaper',  name: 'REAPER',  rarity: 'epic',      unlock: { type: 'kills', v: 500 },           desc: 'Black armor, red optics. Fear made flesh.',
      look: { mask: '#1e1f22', mask2: '#0c0d0e', torso: '#1a1b1e', eye: '#ff3b3b', vest: '#0a0a0b', acc: '#ff3b3b', helmet: true,  visor: false } },
    { id: 'ghost',   name: 'GHOST',   rarity: 'epic',      unlock: { type: 'achievement', v: 'combomaster' }, desc: 'Pale operative. Special challenge unit.',
      look: { mask: '#c9d2da', mask2: '#8a949e', torso: '#a9b3bd', eye: '#4da3ff', vest: '#6f7a85', acc: '#4da3ff', helmet: false, visor: false } },
    { id: 'elite',   name: 'ELITE',   rarity: 'legendary', unlock: { type: 'level', v: 25 },            desc: 'Gold-trimmed commander of the range.',
      look: { mask: '#2a2620', mask2: '#14110d', torso: '#2f2a22', eye: '#ffd166', vest: '#b8892b', acc: '#ffd166', helmet: true,  visor: true } }
  ];
  BW.agent = id => BW.AGENTS.find(a => a.id === id);

  // generic enemy looks (the original six)
  BW.ENEMY_LOOKS = [
    { mask: '#4b4a33', mask2: '#2d2c20', torso: '#5a5541', eye: '#d8c9a6', vest: '#34342a', acc: '#8a6a2a', helmet: false, visor: false },
    { mask: '#3a3f44', mask2: '#22262a', torso: '#2c3034', eye: '#c9d4dd', vest: '#1c1f22', acc: '#5f6a73', helmet: true,  visor: false },
    { mask: '#7d7146', mask2: '#4f472b', torso: '#6b6141', eye: '#1a1a1a', vest: '#4a4128', acc: '#a58e4a', helmet: false, visor: false },
    { mask: '#2f3338', mask2: '#1b1e21', torso: '#262a2e', eye: '#8fb6c9', vest: '#15181b', acc: '#8fb6c9', helmet: true,  visor: true },
    { mask: '#8d8a80', mask2: '#56544c', torso: '#4a4741', eye: '#1a1a1a', vest: '#33312c', acc: '#9d9a8e', helmet: false, visor: false },
    { mask: '#3c4247', mask2: '#23282c', torso: '#2a2f33', eye: '#c2cdd6', vest: '#181b1e', acc: '#c2cdd6', helmet: true,  visor: false }
  ];
  BW.HOSTAGE_LOOK = { mask: '#e0c49a', mask2: '#b89a6c', torso: '#dfe6ee', eye: '#2a1f14', vest: '#c5d0dc', acc: '#4da3ff', helmet: false, visor: false };

  /* ---------- crosshairs ---------- */
  BW.CROSSHAIRS = [
    { id: 'tactical',  name: 'TACTICAL',  level: 1,  c: { color: '#57ff8a', size: 10, thickness: 3, gap: 9, dot: false, outline: true,  opacity: 1, ring: false } },
    { id: 'minimal',   name: 'MINIMAL',   level: 1,  c: { color: '#ffffff', size: 6,  thickness: 2, gap: 5, dot: false, outline: false, opacity: 1, ring: false } },
    { id: 'dot',       name: 'DOT',       level: 1,  c: { color: '#57ff8a', size: 0,  thickness: 2, gap: 0, dot: true,  outline: true,  opacity: 1, ring: false } },
    { id: 'sniper',    name: 'SNIPER',    level: 1,  c: { color: '#ffd166', size: 24, thickness: 2, gap: 4, dot: true,  outline: true,  opacity: 1, ring: false } },
    { id: 'classic',   name: 'CLASSIC',   level: 1,  c: { color: '#ffe14d', size: 8,  thickness: 2, gap: 4, dot: true,  outline: true,  opacity: 1, ring: false } },
    { id: 'precision', name: 'PRECISION', level: 1,  c: { color: '#ff5a5a', size: 5,  thickness: 2, gap: 2, dot: true,  outline: true,  opacity: 1, ring: false } },
    { id: 'ring',      name: 'RING',      level: 7,  c: { color: '#00e5ff', size: 6,  thickness: 2, gap: 6, dot: true,  outline: true,  opacity: 1, ring: true } },
    { id: 'phantom',   name: 'PHANTOM',   level: 20, c: { color: '#b46bff', size: 8,  thickness: 2, gap: 5, dot: true,  outline: true,  opacity: 1, ring: true } }
  ];

  /* ---------- game modes (data-driven difficulty) ---------- */
  BW.MODES = [
    { id: 'classic',  name: 'CLASSIC',       desc: '60 seconds. Score as high as you can.',                time: 60, lives: 0, hostageChance: 0.14, spawnMul: 1,    durMul: 1,   maxUpBonus: 0, headOnly: false, rewardMul: 1 },
    { id: 'endless',  name: 'ENDLESS',       desc: '5 lives. Escapes and friendly fire cost one. Survive.', time: 0,  lives: 5, hostageChance: 0.14, spawnMul: 1,    durMul: 1,   maxUpBonus: 0, headOnly: false, rewardMul: 1 },
    { id: 'hardcore', name: 'HARDCORE',      desc: 'Faster spawns, shorter exposure. +25% rewards.',       time: 60, lives: 0, hostageChance: 0.14, spawnMul: 0.65, durMul: 0.8, maxUpBonus: 1, headOnly: false, rewardMul: 1.25 },
    { id: 'headshot', name: 'HEADSHOT ONLY', desc: 'Body shots do not count. +15% rewards.',               time: 60, lives: 0, hostageChance: 0.14, spawnMul: 1,    durMul: 1,   maxUpBonus: 0, headOnly: true,  rewardMul: 1.15 },
    { id: 'hostage',  name: 'HOSTAGE',       desc: 'Crowded with civilians. Precision matters.',           time: 60, lives: 0, hostageChance: 0.38, spawnMul: 1,    durMul: 1,   maxUpBonus: 0, headOnly: false, rewardMul: 1.1 },
    { id: 'boss',     name: 'BOSS WAVE',     desc: 'Elite target incoming.',                               soon: true }
  ];

  /* ---------- achievements: {stat} on player.stats must reach {target} ---------- */
  BW.ACHIEVEMENTS = [
    { id: 'firstblood',  name: 'FIRST BLOOD',  desc: 'Get your first kill',                          icon: '◎', stat: 'kills',           target: 1,   xp: 100,  coins: 100 },
    { id: 'headhunter',  name: 'HEADHUNTER',   desc: '100 headshots',                                icon: '⌖', stat: 'headshots',       target: 100, xp: 400,  coins: 500 },
    { id: 'nomercy',     name: 'NO MERCY',     desc: '500 kills',                                    icon: '☠', stat: 'kills',           target: 500, xp: 800,  coins: 1000 },
    { id: 'onetap',      name: 'ONE TAP',      desc: '10 consecutive headshots',                     icon: '✦', stat: 'bestHeadStreak',  target: 10,  xp: 500,  coins: 600 },
    { id: 'deadeye',     name: 'DEAD EYE',     desc: '95% accuracy in a round (20+ shots)',          icon: '◉', stat: 'bestRoundAcc',    target: 95,  xp: 600,  coins: 800 },
    { id: 'combomaster', name: 'COMBO MASTER', desc: 'Reach x15 combo',                              icon: '♨', stat: 'bestCombo',       target: 15,  xp: 500,  coins: 600 },
    { id: 'impossible',  name: 'IMPOSSIBLE',   desc: 'Reach x25 combo',                              icon: '♛', stat: 'bestCombo',       target: 25,  xp: 1500, coins: 2000 },
    { id: 'veteran',     name: 'VETERAN',      desc: 'Complete 25 rounds',                           icon: '★', stat: 'games',           target: 25,  xp: 500,  coins: 700 },
    { id: 'survivor',    name: 'SURVIVOR',     desc: 'Survive 90 seconds in Endless',                icon: '⛨', stat: 'bestEndless',     target: 90,  xp: 600,  coins: 800 },
    { id: 'cleanhands',  name: 'CLEAN HANDS',  desc: '40 kills in a round without hitting a hostage', icon: '✚', stat: 'bestCleanRound',  target: 40,  xp: 500,  coins: 700 }
  ];

  /* ---------- missions ----------
     kind 'sum' adds up over the period · 'max' keeps the best single value */
  BW.MISSIONS = {
    daily: [
      { id: 'd_kills', name: 'Get 20 kills',                   stat: 'kills',     kind: 'sum', target: 20,   xp: 300, coins: 100 },
      { id: 'd_head',  name: 'Get 10 headshots',               stat: 'headshots', kind: 'sum', target: 10,   xp: 500, coins: 150 },
      { id: 'd_combo', name: 'Reach x10 combo',                stat: 'combo',     kind: 'max', target: 10,   xp: 250, coins: 100 },
      { id: 'd_score', name: 'Score 8,000 in one round',       stat: 'score',     kind: 'max', target: 8000, xp: 400, coins: 150 },
      { id: 'd_games', name: 'Complete 3 rounds',              stat: 'games',     kind: 'sum', target: 3,    xp: 300, coins: 100 },
      { id: 'd_acc',   name: 'Finish a round with 70% accuracy', stat: 'acc',     kind: 'max', target: 70,   xp: 350, coins: 120 }
    ],
    weekly: [
      { id: 'w_nomercy', name: 'NO MERCY',     desc: 'Kill 250 enemies',   stat: 'kills',     kind: 'sum', target: 250, xp: 1500, coins: 5000, skin: 'mantis:goldenfang', reward: '5,000 COINS + Golden Fang (Mantis AWP)' },
      { id: 'w_head',    name: 'HEADHUNT WEEK', desc: '100 headshots',      stat: 'headshots', kind: 'sum', target: 100, xp: 1200, coins: 3000, reward: '3,000 COINS' },
      { id: 'w_ops',     name: 'OPERATOR',      desc: 'Complete 15 rounds', stat: 'games',     kind: 'sum', target: 15,  xp: 1000, coins: 2500, skin: 'viper:phantom', reward: '2,500 COINS + Phantom (Viper-47)' }
    ]
  };
  BW.missionDef = id => BW.MISSIONS.daily.concat(BW.MISSIONS.weekly).find(m => m.id === id);

  // extra level rewards that are not weapons/agents/crosshairs
  BW.LEVEL_SPECIAL = {
    30: [{ kind: 'skin', key: 'viper:goldenfang', name: 'Golden Fang · Viper-47' }]
  };

  /* what a given level hands out */
  BW.rewardsForLevel = L => {
    const items = [];
    if (L > 1) {
      BW.WEAPONS.forEach(w => { if (w.level === L) items.push({ kind: 'weapon', id: w.id, name: w.name }); });
      BW.CROSSHAIRS.forEach(c => { if (c.level === L) items.push({ kind: 'crosshair', id: c.id, name: c.name + ' crosshair' }); });
    }
    BW.AGENTS.forEach(a => { if (a.unlock.type === 'level' && a.unlock.v === L) items.push({ kind: 'agent', id: a.id, name: a.name + ' agent' }); });
    (BW.LEVEL_SPECIAL[L] || []).forEach(s => items.push(s));
    return items;
  };
  BW.nextUnlock = level => {
    for (let L = level + 1; L <= level + 40; L++) {
      const items = BW.rewardsForLevel(L);
      if (items.length) return { level: L, items };
    }
    return null;
  };

  BW.unlockText = u => {
    switch (u.type) {
      case 'level': return 'Requires Level ' + u.v;
      case 'kills': return 'Get ' + BW.fmt(u.v) + ' total kills';
      case 'headshots': return 'Get ' + BW.fmt(u.v) + ' total headshots';
      case 'achievement': { const a = BW.ACHIEVEMENTS.find(x => x.id === u.v); return 'Achievement: ' + (a ? a.name : u.v); }
      default: return 'Unlocked';
    }
  };
})();
