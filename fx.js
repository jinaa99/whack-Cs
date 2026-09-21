/* ==========================================================
   BREACH & WHACK — FX (procedural audio + canvas particles)
   No audio files: every sound is synthesized. No broken URLs.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW;

  /* ---------- audio ---------- */
  // steps: ['tone', wave, f0, f1, dur, gain, delay] | ['noise', filterHz, filterType, dur, gain, delay]
  const S = {
    shot_pistol:  [['tone', 'square', 300, 90, 0.07, 0.13], ['noise', 2600, 'bandpass', 0.06, 0.12]],
    shot_rifle:   [['tone', 'square', 180, 60, 0.08, 0.14], ['noise', 1800, 'bandpass', 0.08, 0.14]],
    shot_smg:     [['tone', 'square', 240, 80, 0.05, 0.1],  ['noise', 3200, 'bandpass', 0.05, 0.1]],
    shot_sniper:  [['tone', 'sawtooth', 90, 28, 0.32, 0.18], ['noise', 1200, 'lowpass', 0.3, 0.2]],
    shot_shotgun: [['tone', 'sawtooth', 110, 35, 0.22, 0.18], ['noise', 900, 'lowpass', 0.26, 0.24]],
    hit:      [['tone', 'triangle', 240, 110, 0.07, 0.14]],
    headshot: [['tone', 'sine', 1500, 3000, 0.16, 0.16], ['tone', 'triangle', 320, 120, 0.1, 0.12]],
    miss:     [['noise', 1400, 'highpass', 0.05, 0.06]],
    bad:      [['tone', 'triangle', 110, 40, 0.3, 0.18], ['tone', 'sawtooth', 200, 90, 0.2, 0.08, 0.05]],
    combo:    [['tone', 'triangle', 900, 1800, 0.1, 0.14]],
    reload:   [['tone', 'square', 420, 200, 0.04, 0.08], ['tone', 'square', 300, 620, 0.05, 0.08, 0.14]],
    reloaded: [['tone', 'square', 520, 780, 0.05, 0.09]],
    switch:   [['tone', 'square', 500, 700, 0.04, 0.07], ['noise', 3500, 'highpass', 0.03, 0.05]],
    levelup:  [['tone', 'sine', 520, 520, 0.14, 0.16], ['tone', 'sine', 660, 660, 0.14, 0.16, 0.12], ['tone', 'sine', 880, 880, 0.14, 0.16, 0.24], ['tone', 'sine', 1040, 1040, 0.4, 0.16, 0.36]],
    achieve:  [['tone', 'sine', 880, 880, 0.12, 0.14], ['tone', 'sine', 1320, 1320, 0.3, 0.14, 0.1]],
    click:    [['tone', 'square', 800, 600, 0.03, 0.06]],
    hover:    [['tone', 'sine', 1200, 1200, 0.02, 0.025]],
    tick:     [['tone', 'sine', 700, 700, 0.09, 0.12]],
    go:       [['tone', 'square', 1100, 1100, 0.2, 0.12]],
    start:    [['tone', 'sawtooth', 200, 900, 0.3, 0.1]],
    over:     [['tone', 'sawtooth', 500, 90, 0.6, 0.14]]
  };

  let ac = null, master = null, noiseBuf = null, armed = false, lastHover = 0;
  const A = BW.Audio = {};

  // browsers block audio until the first user gesture — stay silent until then
  const arm = () => { armed = true; removeEventListener('pointerdown', arm); removeEventListener('keydown', arm); };
  addEventListener('pointerdown', arm); addEventListener('keydown', arm);

  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  A.sfx = name => {
    if (!armed) return;
    const p = BW.Store && BW.Store.player;
    if (p && p.settings.muted) return;
    const cfg = S[name];
    if (!cfg) return;
    if (name === 'hover') { const n = performance.now(); if (n - lastHover < 60) return; lastHover = n; }
    try {
      const c = ctx(), t0 = c.currentTime;
      cfg.forEach(st => {
        if (st[0] === 'tone') {
          const [, wave, f0, f1, dur, gain, delay = 0] = st, t = t0 + delay;
          const o = c.createOscillator(), g = c.createGain();
          o.type = wave; o.frequency.setValueAtTime(f0, t);
          if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
          g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
          o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
        } else {
          const [, hz, type, dur, gain, delay = 0] = st, t = t0 + delay;
          const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
          src.buffer = noiseBuf; f.type = type; f.frequency.value = hz;
          g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
          src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
        }
      });
    } catch (e) { /* audio unavailable */ }
  };

  /* ---------- particles (one canvas, pooled arrays) ---------- */
  const FX = BW.FX = {};
  let cv, cx, W = 0, H = 0, dpr = 1, smokeSprite = null;
  const parts = [], dust = [];
  const MAX = 240;

  function makeSmoke() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(200,200,205,.55)'); gr.addColorStop(1, 'rgba(200,200,205,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }

  FX.init = canvas => {
    cv = canvas; cx = cv.getContext('2d'); smokeSprite = makeSmoke();
    for (let i = 0; i < 28; i++) dust.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.6, v: 4 + Math.random() * 10, a: 0.08 + Math.random() * 0.18 });
    FX.resize();
    addEventListener('resize', FX.resize);
  };
  FX.resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  };

  const add = p => { if (parts.length >= MAX) parts.shift(); parts.push(p); };

  FX.sparks = (x, y, n, color) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = 120 + Math.random() * 320;
      add({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.18 + Math.random() * 0.22, max: 0.4, c: color || '#ffc46b' });
    }
  };
  FX.impact = (x, y) => {                               // dust + debris on a missed shot
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * Math.random(), v = 60 + Math.random() * 160;
      add({ k: 'd', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.3, max: 0.6, c: '#9a948a' });
    }
    add({ k: 'm', x, y, vx: 0, vy: -18, life: 0.6, max: 0.6, r: 10 });
  };
  FX.smoke = (x, y, n) => {
    for (let i = 0; i < (n || 2); i++) add({ k: 'm', x, y, vx: -20 + Math.random() * 40, vy: -30 - Math.random() * 30, life: 0.8 + Math.random() * 0.5, max: 1.2, r: 12 });
  };

  FX.step = dt => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 's' || p.k === 'd') p.vy += 700 * dt;
      if (p.k === 'm') p.r += 22 * dt;
    }
    const p = BW.Store && BW.Store.player;
    if (!p || p.settings.dust) dust.forEach(d => { d.y -= d.v * dt / H || 0; if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); } });
  };

  FX.draw = () => {
    if (!cx) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    const st = BW.Store && BW.Store.player;
    if (!st || st.settings.dust) {
      cx.fillStyle = '#ffc890';
      dust.forEach(d => { cx.globalAlpha = d.a; cx.fillRect(d.x * W, d.y * H, d.s, d.s); });
    }
    cx.globalAlpha = 1;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], t = p.life / p.max;
      if (p.k === 'm') {
        cx.globalAlpha = Math.max(0, t) * 0.55;
        cx.drawImage(smokeSprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else if (p.k === 's') {
        cx.globalAlpha = Math.min(1, t * 1.6); cx.strokeStyle = p.c; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); cx.stroke();
      } else {
        cx.globalAlpha = Math.min(1, t * 1.4); cx.fillStyle = p.c; cx.fillRect(p.x, p.y, 2.5, 2.5);
      }
    }
    cx.globalAlpha = 1;
  };
})();
