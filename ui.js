/* ==========================================================
   BREACH & WHACK — UI CORE
   Screen manager, delegated events, toasts, main menu, mode
   select, pause, game over, level-up. Other screens live in
   screens.js / screens2.js and register into BW.UI.screens.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, P = BW.Progress, Art = BW.Art, A = BW.Audio, { fmt, esc } = BW;
  const $ = id => document.getElementById(id);
  const app = $('app'), host = $('screens'), toastBox = $('toasts');

  const UI = BW.UI = { screens: {}, acts: {}, inputs: {}, cur: null, state: {} };

  /* ---------- shared markup helpers ---------- */
  UI.bar = pct => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div>`;
  UI.segs = v => '<span class="segs">' + Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('') + '</span>';
  UI.rarityTag = r => `<span class="rtag" style="--rc:${BW.RARITY[r].color}">${BW.RARITY[r].name}</span>`;
  UI.shell = (title, body, sub) => {
    const p = P.player;
    return `<div class="scr-head"><button class="btn ghost" type="button" data-act="go" data-to="menu">◀ BACK</button>` +
      `<h2>${title}</h2>${sub ? `<div class="scr-sub">${sub}</div>` : ''}` +
      `<div class="scr-wallet"><b>LV ${p.level}</b><span>🪙 ${fmt(p.coins)}</span></div></div><div class="scr-body">${body}</div>`;
  };

  /* ---------- screen manager ---------- */
  function ensure(name) {
    let el = $('scr-' + name);
    if (!el) {
      el = document.createElement('section');
      el.id = 'scr-' + name; el.className = 'screen scr-' + name; el.hidden = true;
      host.appendChild(el);
    }
    return el;
  }

  UI.show = (name, arg) => {
    const def = UI.screens[name];
    if (!def) return;
    UI.cur = name;
    P.ensureMissions();
    host.querySelectorAll('.screen:not(.modal)').forEach(s => { s.hidden = true; });
    const el = ensure(name);
    el.innerHTML = def.html(arg);
    el.hidden = false; el.scrollTop = 0;
    app.dataset.ctx = 'menu';
    if (def.after) def.after(el, arg);
    if (name === 'menu' || name === 'gameover') setTimeout(UI.flushLevelUps, 500);
  };
  UI.refresh = () => { if (UI.cur && !$('scr-' + UI.cur).hidden) { const el = $('scr-' + UI.cur), st = el.scrollTop; UI.show(UI.cur, UI.state.arg); el.scrollTop = st; } };
  UI.hideAll = () => { host.querySelectorAll('.screen:not(.modal)').forEach(s => { s.hidden = true; }); UI.cur = null; };

  /* ---------- delegated events ---------- */
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    A.sfx('click');
    const f = UI.acts[b.dataset.act];
    if (f) f(b.dataset, b);
  });
  host.addEventListener('mouseover', e => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && !b.contains(e.relatedTarget)) A.sfx('hover');
  });
  ['input', 'change'].forEach(type => host.addEventListener(type, e => {
    const t = e.target, f = t.dataset && UI.inputs[t.dataset.in];
    if (f) f(t, type);
  }));
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const lv = $('scr-levelup');
    if (lv && !lv.hidden) { UI.acts.lvcontinue(); return; }
    if (BW.Game.phase() === 'menu' && UI.cur && UI.cur !== 'menu') UI.show('menu');
  });

  /* ---------- toasts ---------- */
  function toast(kind, icon, title, sub) {
    const d = document.createElement('div');
    d.className = 'toast t-' + kind;
    d.innerHTML = `<i>${icon}</i><div><b>${esc(title)}</b><span>${esc(sub)}</span></div>`;
    toastBox.appendChild(d);
    while (toastBox.children.length > 4) toastBox.firstChild.remove();
    setTimeout(() => d.remove(), 4300);
  }
  BW.on('achievement', a => { toast('ach', a.icon, 'ACHIEVEMENT UNLOCKED', a.name + ' · +' + fmt(a.coins) + ' coins'); A.sfx('achieve'); });
  BW.on('mission', d => { toast('mis', '✔', 'MISSION COMPLETE', d.name + ' · +' + fmt(d.xp) + ' XP'); A.sfx('achieve'); });
  BW.on('unlock', d => {
    if (d.kind === 'agent') toast('unl', '★', 'AGENT UNLOCKED', d.name);
    else if (d.kind === 'skin') { const [w, s] = d.key.split(':'); toast('unl', '◈', 'SKIN UNLOCKED', BW.weapon(w).name + ' · ' + BW.skin(s).name); }
  });
  BW.on('levelup', d => {
    A.sfx('levelup');
    const ph = BW.Game.phase();
    if (ph !== 'menu' && ph !== 'over') toast('lvl', '▲', 'LEVEL UP', 'LEVEL ' + d.to + ' · +' + fmt(d.coins) + ' coins');
  });

  /* ---------- main menu ---------- */
  UI.screens.menu = {
    html() {
      const p = P.player, li = P.levelInfo(), nu = BW.nextUnlock(li.level);
      const dDone = p.missions.daily.filter(r => r.done).length;
      const aDone = Object.keys(p.achievements).length;
      const items = [
        ['mode', 'PLAY', '', 'primary'], ['armory', 'ARMORY', ''], ['agents', 'AGENTS', ''],
        ['missions', 'MISSIONS', dDone + '/3 DAILY'], ['achievements', 'ACHIEVEMENTS', aDone + '/' + BW.ACHIEVEMENTS.length],
        ['leaderboard', 'LEADERBOARD', ''], ['profile', 'PROFILE', ''], ['settings', 'SETTINGS', '']
      ];
      return `<div class="menu">
        <div class="menu-main">
          <h1 class="menu-title">BREACH<span>&amp;</span>WHACK</h1>
          <div class="menu-bar"></div>
          <div class="menu-sub">TACTICAL RANGE · FAN CONCEPT</div>
          <nav class="menu-list">${items.map(i => `<button class="mbtn ${i[3] || ''}" type="button" data-act="go" data-to="${i[0]}"><span>${i[1]}</span><em>${i[2]}</em></button>`).join('')}</nav>
        </div>
        <aside class="menu-card">
          <div class="pc-top">${Art.avatar(p.avatar)}<div><b>${esc(p.username)}</b><span>LEVEL ${li.level}</span></div></div>
          ${UI.bar(li.pct)}<div class="pc-xp">${fmt(li.xp)} / ${fmt(li.need)} XP</div>
          <div class="pc-row"><span>🪙 COINS</span><b>${fmt(p.coins)}</b></div>
          <div class="pc-row"><span>HIGH SCORE</span><b>${fmt(p.stats.bestScore)}</b></div>
          <div class="pc-row"><span>NEXT UNLOCK</span><b>${nu ? 'LV ' + nu.level + ' · ' + esc(nu.items[0].name) : '—'}</b></div>
        </aside>
      </div>`;
    }
  };

  /* ---------- mode select (PLAY) ---------- */
  UI.screens.mode = {
    html() {
      const p = P.player, last = p.settings.lastMode;
      const cards = BW.MODES.map(m => `<button class="mode-card ${m.id === last ? 'sel' : ''}" type="button" ${m.soon ? 'disabled' : `data-act="startmode" data-v="${m.id}"`}>
          <b>${m.name}</b><span>${m.desc}</span><em>${m.soon ? 'COMING SOON' : m.rewardMul > 1 ? '+' + Math.round((m.rewardMul - 1) * 100) + '% REWARDS' : m.time ? m.time + ' SECONDS' : m.lives + ' LIVES'}</em></button>`).join('');
      const loadout = p.equipment.slots.map((id, i) => {
        const w = BW.weapon(id), sk = P.equippedSkin(id);
        return `<div class="lo-slot" style="${Art.skinVars(sk)}"><i>${i + 1}</i>${Art.weaponSVG(w, sk.p)}<span>${w.name}</span></div>`;
      }).join('');
      return UI.shell('SELECT MODE', `<div class="modes">${cards}</div>
        <div class="loadout"><div class="lo-head"><b>YOUR LOADOUT</b><button class="btn ghost" type="button" data-act="go" data-to="armory">EDIT IN ARMORY</button></div><div class="lo-list">${loadout}</div></div>`);
    }
  };
  UI.acts.go = d => UI.show(d.to);
  UI.acts.startmode = d => BW.Game.start(d.v);

  /* ---------- pause ---------- */
  UI.screens.pause = {
    html() {
      return `<div class="center-card"><h2 class="big">PAUSED</h2><p>The clock is stopped.</p>
        <div class="btn-col"><button class="btn primary" type="button" data-act="resume">RESUME</button>
        <button class="btn" type="button" data-act="restart">RESTART ROUND</button>
        <button class="btn ghost" type="button" data-act="quit">QUIT TO MENU</button></div></div>`;
    }
  };
  UI.acts.resume = () => BW.Game.resume();
  UI.acts.restart = () => BW.Game.start(P.player.settings.lastMode);
  UI.acts.quit = () => BW.Game.quit();

  /* ---------- game over ---------- */
  UI.showGameOver = sum => { UI.state.arg = sum; UI.show('gameover', sum); };
  UI.screens.gameover = {
    html(s) {
      const li = P.levelInfo();
      const cells = [['KILLS', s.kills], ['HEADSHOTS', s.heads], ['ACCURACY', s.shots ? s.acc + '%' : '--'], ['BEST COMBO', 'x' + s.bestCombo]];
      const endless = s.mode === 'endless';
      return `<div class="center-card go">
        <h2 class="big">${endless ? 'DOWN' : 'MISSION COMPLETE'}</h2>
        <div class="go-mode">${s.modeName}${s.newBest ? ' · <b class="gold">NEW BEST!</b>' : ''}${s.perfect ? ' · <b class="gold">PERFECT ROUND</b>' : ''}</div>
        <div class="go-score"><span>SCORE</span><b>${fmt(s.score)}</b></div>
        <div class="go-grid">${cells.map(c => `<div><span>${c[0]}</span><b>${c[1]}</b></div>`).join('')}</div>
        ${s.accBonus ? `<div class="go-note">Accuracy bonus included: <b>+${fmt(s.accBonus)}</b></div>` : ''}
        <div class="go-rewards"><div><b>+${fmt(s.xp)}</b><span>XP</span></div><div><b>🪙 +${fmt(s.coins)}</b><span>COINS</span></div></div>
        <div class="go-level"><span>LEVEL ${li.level}</span>${UI.bar(li.pct)}<span>${fmt(li.xp)} / ${fmt(li.need)}</span></div>
        <div class="btn-row"><button class="btn primary" type="button" data-act="again">PLAY AGAIN</button>
        <button class="btn" type="button" data-act="goarmory">ARMORY</button>
        <button class="btn ghost" type="button" data-act="quit">MAIN MENU</button></div></div>`;
    }
  };
  UI.acts.again = () => BW.Game.start(P.player.settings.lastMode);
  UI.acts.goarmory = () => { BW.Game.quit(); UI.show('armory'); };

  /* ---------- level-up modal (queued) ---------- */
  const lvIcon = { weapon: '🔫', agent: '★', crosshair: '⌖', skin: '◈' };
  function showLevelUp(d) {
    const el = ensure('levelup');
    el.classList.add('modal');
    el.innerHTML = `<div class="center-card lv"><div class="lv-tag">LEVEL UP</div><div class="lv-num">${d.from} <i>→</i> ${d.to}</div>
      <div class="lv-reward"><span>REWARD</span><b>🪙 +${fmt(d.coins)} COINS</b></div>
      ${d.items.length ? `<div class="lv-items"><span>NEW ITEM UNLOCKED</span>${d.items.map(i => `<b>${lvIcon[i.kind] || '★'} ${esc(i.name)}</b>`).join('')}</div>` : ''}
      <button class="btn primary" type="button" data-act="lvcontinue">CONTINUE</button></div>`;
    el.hidden = false;
    A.sfx('levelup');
  }
  UI.flushLevelUps = () => {
    const el = $('scr-levelup');
    if ((el && !el.hidden) || !P.pendingLevelUps.length) return;
    const q = P.pendingLevelUps.splice(0);           // several level-ups at once → one combined card
    showLevelUp({ from: q[0].from, to: q[q.length - 1].to, coins: q.reduce((n, d) => n + d.coins, 0), items: [].concat(...q.map(d => d.items)) });
  };
  UI.acts.lvcontinue = () => {
    const el = $('scr-levelup');
    if (el) el.hidden = true;
    UI.flushLevelUps();
  };
})();
