/* ==========================================================
   BREACH & WHACK — ART (weapon silhouettes, agent markup,
   crosshair). Pure markup builders, no game state.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW;

  /* ---------- weapon silhouettes (viewBox 0 0 320 110, muzzle on the left) ----------
     body = painted with the skin colour, dark = metal parts, acc = accent,
     region = where skin patterns are drawn, muzzle = barrel tip           */
  const SHAPES = {
    rifle: {
      body: '<rect x="62" y="36" width="72" height="22" rx="3"/><rect x="122" y="32" width="84" height="28" rx="4"/><path d="M204 36L308 44V74L204 64Z"/><path d="M196 60h20l10 34h-20z"/>',
      dark: '<rect x="6" y="44" width="60" height="7" rx="2"/><rect x="2" y="40" width="12" height="15" rx="2"/><path d="M142 60h30l8 42h-30z"/><rect x="84" y="28" width="12" height="9" rx="2"/><rect x="128" y="28" width="76" height="5" rx="1"/>',
      acc: '<rect x="130" y="42" width="70" height="5"/>',
      region: [132, 36, 66, 20], muzzle: [4, 47]
    },
    smg: {
      body: '<rect x="44" y="36" width="150" height="24" rx="4"/><path d="M190 40h60l6 8h48v6h-52l-6 6h-56z"/>',
      dark: '<rect x="6" y="42" width="42" height="8"/><rect x="2" y="39" width="10" height="14"/><path d="M96 58h18l4 50h-18z"/><path d="M150 58h20l8 34h-20z"/><rect x="100" y="30" width="10" height="7"/><path d="M240 42L306 50V56L240 50Z"/>',
      acc: '<rect x="60" y="42" width="110" height="5"/>',
      region: [62, 36, 110, 20], muzzle: [3, 46]
    },
    pistol: {
      body: '<rect x="70" y="30" width="170" height="30" rx="6"/><path d="M180 60h56l-14 46h-40z"/>',
      dark: '<rect x="56" y="36" width="20" height="18" rx="3"/><path d="M150 60h34v18h-8V68h-26z"/><rect x="222" y="26" width="12" height="6"/><rect x="72" y="26" width="8" height="6"/>',
      acc: '<rect x="96" y="40" width="110" height="5"/>',
      region: [92, 32, 116, 20], muzzle: [54, 45]
    },
    sniper: {
      body: '<rect x="126" y="38" width="90" height="26" rx="4"/><path d="M214 40L312 48V82L214 66Z"/><path d="M196 62h18l8 32h-18z"/>',
      dark: '<rect x="4" y="46" width="126" height="7"/><rect x="0" y="42" width="14" height="15"/><rect x="110" y="16" width="90" height="16" rx="6"/><rect x="126" y="32" width="8" height="8"/><rect x="176" y="32" width="8" height="8"/><rect x="150" y="64" width="24" height="16"/><rect x="206" y="34" width="14" height="4"/>',
      acc: '<rect x="132" y="46" width="76" height="4"/><rect x="112" y="21" width="8" height="6"/>',
      region: [134, 40, 74, 20], muzzle: [0, 49]
    },
    shotgun: {
      body: '<rect x="150" y="36" width="70" height="26" rx="4"/><path d="M218 40L312 46V80L218 64Z"/><rect x="86" y="50" width="56" height="16" rx="5"/>',
      dark: '<rect x="4" y="38" width="150" height="8" rx="2"/><rect x="4" y="47" width="120" height="7" rx="2"/><path d="M214 60h18l8 34h-18z"/>',
      acc: '<rect x="92" y="55" width="44" height="4"/>',
      region: [154, 40, 62, 18], muzzle: [2, 42]
    }
  };

  function pattern(kind, r) {
    const [x, y, w, h] = r;
    let s = '';
    if (kind === 'stripe') {
      for (let i = 0; i < 4; i++) { const a = x + 6 + i * w / 4; s += `<path d="M${a} ${y + h}L${a + 10} ${y}L${a + 16} ${y}L${a + 6} ${y + h}Z"/>`; }
    } else if (kind === 'chevron') {
      for (let i = 0; i < 3; i++) { const a = x + 6 + i * w / 3; s += `<path d="M${a} ${y}L${a + 12} ${y + h / 2}L${a} ${y + h}L${a + 6} ${y + h}L${a + 18} ${y + h / 2}L${a + 6} ${y}Z"/>`; }
    } else if (kind === 'dots') {
      for (let i = 0; i < 6; i++) s += `<circle cx="${x + 8 + i * (w - 16) / 5}" cy="${y + h / 2}" r="3"/>`;
    }
    return s;
  }

  const Art = BW.Art = {};

  // weapon = weapon def (uses .art), patternKind = skin.p
  Art.weaponSVG = (w, patternKind) => {
    const S = SHAPES[w.art] || SHAPES.rifle;
    return `<svg class="wsvg" viewBox="0 0 320 110" aria-hidden="true">` +
      `<g class="wb">${S.body}</g><g class="wd">${S.dark}</g><g class="wa">${S.acc}</g>` +
      `<g class="wp">${pattern(patternKind, S.region)}</g><g class="ws">${S.body}</g></svg>`;
  };
  Art.muzzle = type => (SHAPES[type] || SHAPES.rifle).muzzle;
  Art.skinVars = s => `--wc:${s.c};--wa:${s.a};--wg:${s.g};--wm:${s.m};`;

  /* ---------- agents ---------- */
  Art.lookVars = l => `--mask:${l.mask};--mask2:${l.mask2};--torso:${l.torso};--eye:${l.eye};--vest:${l.vest};--acc:${l.acc};`;
  Art.lookClass = (l, o = {}) =>
    'agent' + (l.helmet ? ' has-helmet' : '') + (l.visor ? ' has-visor' : '') + (o.hostage ? ' is-hostage' : '') + (o.rarity ? ' r-' + o.rarity : '');
  const AGENT_INNER =
    '<i class="sh l"></i><i class="sh r"></i><div class="torso"></div><div class="vest"></div><div class="head"></div>' +
    '<div class="eyes"><i></i><i></i></div><div class="helmet"></div><div class="visor"></div>' +
    '<div class="hands"><i></i><i></i></div><div class="hostage-tag">⚠ HOSTAGE</div><div class="rim"></div>';
  Art.agentHTML = (look, o) => `<div class="${Art.lookClass(look, o)}" style="${Art.lookVars(look)}">${AGENT_INNER}</div>`;
  Art.applyLook = (el, look, o) => { el.className = Art.lookClass(look, o); el.style.cssText = Art.lookVars(look); };

  /* ---------- crosshair (element with .xh class; CSS reads the variables) ---------- */
  Art.XH_HTML = '<i class="xb xt"></i><i class="xb xb2"></i><i class="xb xl"></i><i class="xb xr"></i><i class="xdot"></i><i class="xring"></i>';
  Art.applyXh = (el, c, extraGap) => {
    const s = el.style;
    s.setProperty('--xc', c.color);
    s.setProperty('--xs', c.size + 'px');
    s.setProperty('--xt', c.thickness + 'px');
    s.setProperty('--xg', (c.gap + (extraGap || 0)) + 'px');
    s.setProperty('--xo', c.opacity);
    el.classList.toggle('ol', !!c.outline);
    el.classList.toggle('dot-on', !!c.dot);
    el.classList.toggle('ring-on', !!c.ring);
  };

  /* ---------- avatars ---------- */
  const AV = [['◆', '#ff8a00'], ['✦', '#57ff8a'], ['▲', '#4da3ff'], ['●', '#ff4d4d'], ['■', '#b46bff'], ['✚', '#ffd166'], ['⬢', '#7fd0ff'], ['☠', '#e7e3dc']];
  Art.AVATARS = AV.length;
  Art.avatar = i => { const a = AV[i] || AV[0]; return `<span class="av" style="--avc:${a[1]}">${a[0]}</span>`; };
})();
