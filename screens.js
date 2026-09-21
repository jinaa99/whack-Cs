/* ==========================================================
   BREACH & WHACK — SCREENS: ARMORY (weapons + skins) and AGENTS
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, UI = BW.UI, P = BW.Progress, Art = BW.Art, { fmt, esc } = BW;

  const st = UI.state.armory = { tab: 'rifle', slot: 0, sel: 'viper', view: 'stats', filter: 'all' };

  const lockText = key => { const l = BW.SKIN_LOCKS[key]; return l.level ? 'Requires Level ' + l.level : l.text; };
  function skinState(wid, s) {
    const key = wid + ':' + s.id;
    if (P.equippedSkinId(wid) === s.id) return 'equipped';
    if (P.skinOwned(wid, s.id)) return 'owned';
    return BW.SKIN_LOCKS[key] ? 'locked' : 'shop';
  }

  /* ---------- ARMORY ---------- */
  UI.screens.armory = {
    html() {
      const p = P.player, w = BW.weapon(st.sel), slots = p.equipment.slots;
      const tabs = BW.TYPES.map(t => `<button class="tab ${st.tab === t[0] ? 'on' : ''}" type="button" data-act="atab" data-v="${t[0]}">${t[1]}</button>`).join('');
      const slotBtns = slots.map((id, i) => `<button class="slotpick ${st.slot === i ? 'on' : ''}" type="button" data-act="aslot" data-v="${i}"><b>${i + 1}</b>${BW.weapon(id).name}</button>`).join('');
      const cards = BW.WEAPONS.filter(x => x.type === st.tab).map(x => {
        const lock = !P.weaponUnlocked(x.id), sk = P.equippedSkin(x.id), at = slots.indexOf(x.id);
        return `<button class="wcard ${x.id === st.sel ? 'sel' : ''} ${lock ? 'locked' : ''}" type="button" data-act="asel" data-v="${x.id}">
          <div class="wprev sm" style="${Art.skinVars(sk)}">${Art.weaponSVG(x, sk.p)}</div>
          <b>${x.name}</b><span>${lock ? '🔒 Requires Level ' + x.level : at >= 0 ? 'SLOT ' + (at + 1) : 'OWNED'}</span></button>`;
      }).join('');
      const sk = P.equippedSkin(w.id), lock = !P.weaponUnlocked(w.id), at = slots.indexOf(w.id);
      const stats = `<div class="statrow"><span>DAMAGE</span>${UI.segs(w.dmg)}</div>
        <div class="statrow"><span>ACCURACY</span>${UI.segs(w.acc)}</div>
        <div class="statrow"><span>FIRE RATE</span>${UI.segs(w.fr)}</div>
        <div class="minis"><div><span>MAGAZINE</span><b>${w.mag}</b></div><div><span>RELOAD</span><b>${(w.reload / 1000).toFixed(1)}s</b></div><div><span>HEADSHOT</span><b>×${w.head}</b></div></div>`;
      const actions = lock
        ? `<button class="btn" type="button" disabled>🔒 Requires Level ${w.level}</button>`
        : `<button class="btn primary" type="button" data-act="aequip" ${at === st.slot ? 'disabled' : ''}>${at === st.slot ? 'EQUIPPED IN SLOT ' + (st.slot + 1) : 'EQUIP TO SLOT ' + (st.slot + 1)}</button>
           <button class="btn" type="button" data-act="aview" data-v="${st.view === 'skins' ? 'stats' : 'skins'}">${st.view === 'skins' ? 'WEAPON STATS' : 'VIEW SKINS'}</button>`;

      let body;
      if (st.view === 'skins' && !lock) {
        const filt = [['all', 'ALL'], ['owned', 'OWNED'], ['shop', 'SHOP'], ['locked', 'LOCKED']]
          .map(f => `<button class="tab sm ${st.filter === f[0] ? 'on' : ''}" type="button" data-act="afilter" data-v="${f[0]}">${f[1]}</button>`).join('');
        const skins = BW.SKINS.filter(s => {
          const state = skinState(w.id, s);
          return st.filter === 'all' || (st.filter === 'owned' && (state === 'owned' || state === 'equipped')) || st.filter === state;
        }).map(s => {
          const state = skinState(w.id, s), key = w.id + ':' + s.id;
          const btn = state === 'equipped' ? '<button class="btn sm" type="button" disabled>EQUIPPED</button>'
            : state === 'owned' ? `<button class="btn sm primary" type="button" data-act="sequip" data-v="${s.id}">EQUIP</button>`
            : state === 'locked' ? `<button class="btn sm" type="button" disabled>🔒 ${esc(lockText(key))}</button>`
            : `<button class="btn sm gold" type="button" data-act="sbuy" data-v="${s.id}" ${p.coins < s.price ? 'disabled' : ''}>BUY 🪙 ${fmt(s.price)}</button>`;
          return `<div class="scard ${state}"><div class="wprev sm" style="${Art.skinVars(s)}">${Art.weaponSVG(w, s.p)}</div>
            <b>${s.name}</b>${UI.rarityTag(s.rarity)}${btn}</div>`;
        }).join('') || '<p class="empty">Nothing here.</p>';
        body = `<div class="filters">${filt}</div><div class="skins">${skins}</div>`;
      } else body = stats;

      return UI.shell('ARMORY', `
        <div class="tabs">${tabs}</div>
        <div class="armory">
          <div class="alist"><div class="slotbar"><span>LOADOUT SLOT</span>${slotBtns}</div><div class="wgrid">${cards}</div></div>
          <div class="adetail">
            <div class="wprev big" style="${Art.skinVars(sk)}">${Art.weaponSVG(w, sk.p)}</div>
            <div class="wname">${w.name} <em>${sk.name}</em></div>
            <div class="wdesc">${w.desc}</div>
            ${body}
            <div class="btn-row">${actions}</div>
          </div>
        </div>`);
    }
  };
  const A = UI.acts;
  A.atab = d => { st.tab = d.v; const f = BW.WEAPONS.find(w => w.type === d.v); if (f) st.sel = f.id; st.view = 'stats'; UI.refresh(); };
  A.aslot = d => { st.slot = +d.v; UI.refresh(); };
  A.asel = d => { st.sel = d.v; st.view = 'stats'; UI.refresh(); };
  A.aview = d => { st.view = d.v; UI.refresh(); };
  A.afilter = d => { st.filter = d.v; UI.refresh(); };
  A.aequip = () => { P.equipWeapon(st.slot, st.sel); UI.refresh(); };
  A.sequip = d => { P.equipSkin(st.sel, d.v); UI.refresh(); };
  A.sbuy = d => { const r = P.buySkin(st.sel, d.v); if (r.ok) P.equipSkin(st.sel, d.v); UI.refresh(); };

  /* ---------- AGENTS ---------- */
  UI.screens.agents = {
    html() {
      const p = P.player, s = p.stats;
      const cards = BW.AGENTS.map(a => {
        const owned = !!p.inventory.agents[a.id], eq = p.equipment.agent === a.id, u = a.unlock;
        const prog = u.type === 'kills' ? ` (${fmt(Math.min(s.kills, u.v))} / ${fmt(u.v)})` : u.type === 'headshots' ? ` (${fmt(Math.min(s.headshots, u.v))} / ${fmt(u.v)})` : '';
        const btn = eq ? '<button class="btn sm" type="button" disabled>EQUIPPED</button>'
          : owned ? `<button class="btn sm primary" type="button" data-act="aequipagent" data-v="${a.id}">EQUIP</button>`
          : `<button class="btn sm" type="button" disabled>🔒 ${esc(BW.unlockText(u))}${prog}</button>`;
        return `<div class="acard ${owned ? '' : 'locked'} ${eq ? 'equipped' : ''}" style="--rc:${BW.RARITY[a.rarity].color}">
          <div class="aprev">${Art.agentHTML(a.look)}</div><b>${a.name}</b>${UI.rarityTag(a.rarity)}<span>${a.desc}</span>${btn}</div>`;
      }).join('');
      return UI.shell('AGENTS', `<p class="lead">Your equipped agent sets the look of the enemies you shoot at. Purely cosmetic — no gameplay advantage.</p><div class="agents">${cards}</div>`);
    }
  };
  A.aequipagent = d => { P.equipAgent(d.v); UI.refresh(); };

  /* ---------- LOADOUT (quick equip: 3 weapon slots, agent, title, crosshair) ---------- */
  UI.screens.loadout = {
    html() {
      const p = P.player, eq = p.equipment;
      const slotCards = eq.slots.map((id, i) => {
        const w = BW.weapon(id), sk = P.equippedSkin(id);
        const opts = BW.WEAPONS.map(x => {
          const ok = P.weaponUnlocked(x.id), on = x.id === id;
          return `<button class="chip ${on ? 'on' : ''}" type="button" ${ok ? `data-act="lo_weapon" data-slot="${i}" data-v="${x.id}"` : 'disabled'}>${x.name}${ok ? '' : ' 🔒' + x.level}</button>`;
        }).join('');
        return `<section class="panel"><h3>SLOT ${i + 1} · KEY ${i + 1}</h3>
          <div class="wprev" style="${Art.skinVars(sk)}">${Art.weaponSVG(w, sk.p)}</div>
          <div class="wname sm">${w.name} <em>${sk.name}</em></div><div class="chips">${opts}</div></section>`;
      }).join('');
      const agents = BW.AGENTS.map(a => { const ok = !!p.inventory.agents[a.id]; return `<button class="chip ${eq.agent === a.id ? 'on' : ''}" type="button" ${ok ? `data-act="lo_agent" data-v="${a.id}"` : 'disabled'}>${a.name}${ok ? '' : ' 🔒'}</button>`; }).join('');
      const titles = BW.TITLES.map(t => { const ok = !!p.inventory.titles[t.id]; return `<button class="chip ${eq.title === t.id ? 'on' : ''}" type="button" ${ok ? `data-act="lo_title" data-v="${t.id}"` : 'disabled'}>${t.name}${ok ? '' : ' 🔒'}</button>`; }).join('');
      const xhs = BW.CROSSHAIRS.map(x => { const ok = P.crosshairUnlocked(x); return `<button class="chip ${p.crosshair.preset === x.id ? 'on' : ''}" type="button" ${ok ? `data-act="lo_xh" data-v="${x.id}"` : 'disabled'}>${x.name}${ok ? '' : ' 🔒' + x.level}</button>`; }).join('');
      return UI.shell('LOADOUT', `<div class="cols">${slotCards}</div>
        <div class="cols" style="margin-top:14px">
          <section class="panel"><h3>AGENT</h3><div class="chips">${agents}</div></section>
          <section class="panel"><h3>TITLE</h3><div class="chips">${titles}</div></section>
          <section class="panel"><h3>CROSSHAIR</h3><div class="chips">${xhs}</div></section>
        </div>
        <div class="btn-row"><button class="btn primary" type="button" data-act="go" data-to="mode">PLAY</button><button class="btn" type="button" data-act="go" data-to="armory">OPEN ARMORY (SKINS)</button></div>`);
    }
  };
  UI.acts.lo_weapon = d => { P.equipWeapon(+d.slot, d.v); UI.refresh(); };
  UI.acts.lo_agent = d => { P.equipAgent(d.v); UI.refresh(); };
  UI.acts.lo_title = d => { P.equipTitle(d.v); UI.refresh(); };
  UI.acts.lo_xh = d => {
    const x = BW.CROSSHAIRS.find(c => c.id === d.v);
    if (x && P.crosshairUnlocked(x)) { P.setCrosshair(Object.assign({ preset: x.id }, x.c)); BW.Game.refreshCrosshair(); UI.refresh(); }
  };
})();
