/* ==========================================================
   BREACH & WHACK — SCREENS: missions, achievements, leaderboard,
   profile, settings (+ crosshair editor)
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, UI = BW.UI, P = BW.Progress, Art = BW.Art, Store = BW.Store, { fmt, esc } = BW;
  const A = UI.acts;

  const dur = ms => { const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000); return h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h + 'h ' + m + 'm'; };
  const rewardText = d => `+${fmt(d.xp)} XP · 🪙 ${fmt(d.coins)}`;

  /* ---------- MISSIONS ---------- */
  UI.screens.missions = {
    html() {
      const m = P.player.missions;
      const row = rec => {
        const d = BW.missionDef(rec.id), pct = rec.progress / d.target * 100;
        return `<div class="mrow ${rec.done ? 'done' : ''}"><div class="mtxt"><b>${rec.done ? '✔ ' : '☐ '}${esc(d.name)}</b><span>${rewardText(d)}</span></div>
          ${UI.bar(pct)}<div class="mprog">${fmt(rec.progress)} / ${fmt(d.target)}</div></div>`;
      };
      const wd = BW.missionDef(m.weekly.id), wp = m.weekly.progress / wd.target * 100;
      return UI.shell('MISSIONS', `
        <div class="cols">
          <section class="panel"><h3>DAILY MISSIONS <em>resets in ${dur(BW.timeToDailyReset())}</em></h3>${m.daily.map(row).join('')}</section>
          <section class="panel weekly ${m.weekly.done ? 'done' : ''}"><h3>WEEKLY OPERATION <em>resets in ${dur(BW.timeToWeeklyReset())}</em></h3>
            <div class="wk-name">"${esc(wd.name)}"</div><div class="wk-desc">${esc(wd.desc)}</div>
            ${UI.bar(wp)}<div class="mprog">${fmt(m.weekly.progress)} / ${fmt(wd.target)}</div>
            <div class="wk-reward"><span>REWARD</span><b>${esc(wd.reward)}</b><b>+${fmt(wd.xp)} XP</b></div>
            ${m.weekly.done ? '<div class="wk-done">✔ COMPLETE</div>' : ''}</section>
        </div>`);
    }
  };

  /* ---------- ACHIEVEMENTS ---------- */
  UI.screens.achievements = {
    html() {
      const p = P.player;
      const cards = BW.ACHIEVEMENTS.map(a => {
        const got = !!p.achievements[a.id], v = Math.min(p.stats[a.stat] || 0, a.target);
        return `<div class="ach ${got ? 'got' : ''}"><i>${a.icon}</i><div><b>${a.name}</b><span>${a.desc}</span>
          ${got ? '<em>UNLOCKED</em>' : UI.bar(v / a.target * 100) + `<small>${fmt(v)} / ${fmt(a.target)}</small>`}
          <small class="rw">+${fmt(a.xp)} XP · 🪙 ${fmt(a.coins)}</small></div></div>`;
      }).join('');
      return UI.shell('ACHIEVEMENTS', `<div class="achs">${cards}</div>`, `${Object.keys(p.achievements).length} / ${BW.ACHIEVEMENTS.length}`);
    }
  };

  /* ---------- LEADERBOARD ---------- */
  UI.state.lb = 'all';
  UI.screens.leaderboard = {
    html() {
      const tabs = BW.Leaderboard.PERIODS.map(t => `<button class="tab ${UI.state.lb === t[0] ? 'on' : ''}" type="button" data-act="lbperiod" data-v="${t[0]}">${t[1]}</button>`).join('');
      const rows = BW.Leaderboard.get(UI.state.lb).map(r =>
        `<div class="lbrow ${r.you ? 'you' : ''}"><span class="rk">#${r.rank}</span><b>${esc(r.name)}${r.you ? ' <em>YOU</em>' : ''}</b><span class="sc">${r.score ? fmt(r.score) : '—'}</span></div>`).join('');
      return UI.shell('GLOBAL LEADERBOARD', `<div class="tabs">${tabs}</div><div class="lb">${rows}</div>
        <p class="lead small">Local leaderboard: rivals are simulated. The data layer (BW.Leaderboard.get) is ready to be pointed at a server.</p>`);
    }
  };
  A.lbperiod = d => { UI.state.lb = d.v; UI.refresh(); };

  /* ---------- PROFILE ---------- */
  UI.screens.profile = {
    html() {
      const p = P.player, s = p.stats, li = P.levelInfo();
      const acc = s.shots ? (s.hits / s.shots * 100).toFixed(1) + '%' : '--';
      const fav = Object.keys(s.fav).sort((a, b) => s.fav[b] - s.fav[a])[0];
      const hrs = s.playTime >= 3600 ? (s.playTime / 3600).toFixed(1) + 'h' : Math.floor(s.playTime / 60) + 'm';
      const stat = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
      const avs = Array.from({ length: Art.AVATARS }, (_, i) => `<button class="avbtn ${p.avatar === i ? 'on' : ''}" type="button" data-act="avatar" data-v="${i}">${Art.avatar(i)}</button>`).join('');
      const eq = p.equipment, ag = BW.agent(eq.agent);
      const guns = eq.slots.map((id, i) => `<div class="eqrow"><span>SLOT ${i + 1}</span><b>${BW.weapon(id).name} <em>${P.equippedSkin(id).name}</em></b></div>`).join('');
      return UI.shell('PLAYER PROFILE', `<div class="cols">
        <section class="panel prof">
          <div class="prof-top"><div class="bigav">${Art.avatar(p.avatar)}</div><div>
            <input class="nameinput" maxlength="14" value="${esc(p.username)}" data-in="name" aria-label="Username">
            <div class="prof-lv">LEVEL ${li.level}</div></div></div>
          ${UI.bar(li.pct)}<div class="pc-xp">${fmt(li.xp)} / ${fmt(li.need)} XP</div>
          <div class="pc-row"><span>🪙 COINS</span><b>${fmt(p.coins)}</b></div>
          <div class="avs">${avs}</div>
        </section>
        <section class="panel"><h3>COMBAT STATS</h3><div class="statgrid">
          ${stat('KILLS', fmt(s.kills))}${stat('HEADSHOTS', fmt(s.headshots))}${stat('ACCURACY', acc)}${stat('BEST COMBO', 'x' + s.bestCombo)}
          ${stat('HIGH SCORE', fmt(s.bestScore))}${stat('GAMES PLAYED', fmt(s.games))}${stat('PLAY TIME', hrs)}${stat('HOSTAGES HIT', fmt(s.hostages))}
          ${stat('TOTAL SHOTS', fmt(s.shots))}${stat('MISSES', fmt(s.misses))}${stat('FAVORITE WEAPON', fav ? BW.weapon(fav).name : '—')}${stat('ESCAPED', fmt(s.escaped))}
        </div></section>
        <section class="panel"><h3>EQUIPMENT</h3>${guns}
          <div class="eqrow"><span>AGENT</span><b>${ag.name}</b></div>
          <div class="eqrow"><span>CROSSHAIR</span><b>${esc(p.crosshair.preset.toUpperCase())}</b></div></section>
      </div>`);
    }
  };
  A.avatar = d => { P.player.avatar = +d.v; Store.save(); UI.refresh(); };
  UI.inputs.name = (t, type) => {
    if (type !== 'change') return;
    P.player.username = BW.cleanName(t.value); t.value = P.player.username; Store.save();
  };

  /* ---------- SETTINGS + CROSSHAIR EDITOR ---------- */
  const XK = [['size', 'LENGTH', 0, 30, 1], ['thickness', 'THICKNESS', 1, 6, 1], ['gap', 'GAP', 0, 20, 1], ['opacity', 'OPACITY', 20, 100, 5]];
  let resetArmed = false;

  UI.screens.settings = {
    html() {
      const p = P.player, c = p.crosshair, s = p.settings;
      const tog = (k, label) => `<button class="tog ${s[k] ? 'on' : ''}" type="button" data-act="stoggle" data-k="${k}"><span>${label}</span><i>${s[k] ? 'ON' : 'OFF'}</i></button>`;
      const presets = BW.CROSSHAIRS.map(x => {
        const ok = P.crosshairUnlocked(x);
        return `<button class="chip ${c.preset === x.id ? 'on' : ''}" type="button" ${ok ? `data-act="xhpreset" data-v="${x.id}"` : 'disabled'}>${x.name}${ok ? '' : ' 🔒 LV ' + x.level}</button>`;
      }).join('');
      const sliders = XK.map(([k, label, min, max, step]) => {
        const v = k === 'opacity' ? Math.round(c[k] * 100) : c[k];
        return `<label class="slider"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-in="xh" data-k="${k}"><b data-v="${k}">${v}</b></label>`;
      }).join('');
      return UI.shell('SETTINGS', `<div class="cols">
        <section class="panel"><h3>GAME</h3>${tog('muted', 'MUTE SOUND')}${tog('shake', 'SCREEN SHAKE')}${tog('dust', 'AMBIENT PARTICLES')}
          <button class="btn danger" type="button" data-act="reset">${resetArmed ? 'CLICK AGAIN TO ERASE EVERYTHING' : 'RESET PROGRESS'}</button></section>
        <section class="panel"><h3>CROSSHAIR</h3>
          <div class="xhprev" id="xhPrevBox"><div class="xh" id="xhPrev">${Art.XH_HTML}</div></div>
          <div class="chips">${presets}</div>
          ${sliders}
          <label class="check"><input type="checkbox" data-in="xh" data-k="dot" ${c.dot ? 'checked' : ''}> CENTER DOT</label>
          <label class="check"><input type="checkbox" data-in="xh" data-k="outline" ${c.outline ? 'checked' : ''}> OUTLINE</label>
          <label class="slider"><span>COLOR</span><input type="color" value="${c.color}" data-in="xh" data-k="color"></label>
        </section></div>`);
    },
    after() { Art.applyXh(document.getElementById('xhPrev'), P.player.crosshair, 0); }
  };
  A.stoggle = d => { const s = P.player.settings; s[d.k] = !s[d.k]; Store.save(); UI.refresh(); };
  A.xhpreset = d => {
    const x = BW.CROSSHAIRS.find(c => c.id === d.v);
    if (!x || !P.crosshairUnlocked(x)) return;
    P.setCrosshair(Object.assign({ preset: x.id }, x.c));
    BW.Game.refreshCrosshair(); UI.refresh();
  };
  UI.inputs.xh = t => {
    const c = P.player.crosshair, k = t.dataset.k;
    let v = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
    if (k === 'opacity') v = v / 100;
    if (k === 'color' && !/^#[0-9a-f]{6}$/i.test(v)) return;
    P.setCrosshair({ [k]: v, preset: 'custom' });
    const lab = document.querySelector(`b[data-v="${k}"]`);
    if (lab) lab.textContent = k === 'opacity' ? Math.round(c.opacity * 100) : c[k];
    Art.applyXh(document.getElementById('xhPrev'), c, 0);
    BW.Game.refreshCrosshair();
  };
  A.reset = () => {
    if (!resetArmed) { resetArmed = true; UI.refresh(); setTimeout(() => { if (resetArmed) { resetArmed = false; if (UI.cur === 'settings') UI.refresh(); } }, 3500); return; }
    resetArmed = false; Store.reset(); BW.Game.refreshCrosshair(); UI.show('menu');
  };
})();
