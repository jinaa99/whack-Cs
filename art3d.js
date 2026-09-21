/* ==========================================================
   BREACH & WHACK — ART 3D (canvas textures for the WebGL scene)
   • Art.agentCanvas     enemy / hostage sprite (procedural, or the user's image)
   • Art.viewmodelCanvas first-person hands + weapon (procedural, or user layers)
   Everything is cached; nothing is fetched unless listed in assets.js.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, Art = BW.Art;

  /* ---------- image loader (only ever called for manifest entries) ---------- */
  const imgCache = new Map();
  Art.loadImage = url => {
    if (!url) return Promise.resolve(null);
    if (!imgCache.has(url)) {
      imgCache.set(url, new Promise(res => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => { console.warn('[assets] could not load', url); res(null); };
        im.src = url;
      }));
    }
    return imgCache.get(url);
  };

  const rr = (c, x, y, w, h, r) => {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    c.beginPath(); c.moveTo(x + tl, y); c.lineTo(x + w - tr, y); c.quadraticCurveTo(x + w, y, x + w, y + tr);
    c.lineTo(x + w, y + h - br); c.quadraticCurveTo(x + w, y + h, x + w - br, y + h); c.lineTo(x + bl, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - bl); c.lineTo(x, y + tl); c.quadraticCurveTo(x, y, x + tl, y); c.closePath();
  };
  const vgrad = (c, y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

  /* ==========================================================
     AGENT SPRITE — 256×300, feet at the bottom edge
     ========================================================== */
  const agentCache = new Map();
  Art.AGENT_W = 256; Art.AGENT_H = 300;

  function drawAgent(c, L, hostage) {
    const W = 256, H = 300;
    c.clearRect(0, 0, W, H);
    // torso
    rr(c, 4, 195, 248, 105, [38, 38, 0, 0]); c.fillStyle = vgrad(c, 195, 300, L.torso, '#17191b'); c.fill();
    const sh = c.createLinearGradient(0, 0, W, 0); sh.addColorStop(0, 'rgba(255,255,255,.14)'); sh.addColorStop(.3, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.4)');
    rr(c, 4, 195, 248, 105, [38, 38, 0, 0]); c.fillStyle = sh; c.fill();
    if (!hostage) {
      // shoulder pads + vest
      [6, 190].forEach(x => { rr(c, x, 201, 60, 47, [26, 26, 8, 8]); c.fillStyle = vgrad(c, 201, 248, L.vest, '#0c0d0e'); c.fill(); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 8, 203, 44, 3); });
      rr(c, 58, 219, 140, 81, [22, 22, 0, 0]); c.fillStyle = vgrad(c, 219, 300, L.vest, '#0c0d0e'); c.fill();
      c.fillStyle = L.acc; c.fillRect(58, 219, 140, 4);
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2; rr(c, 58, 219, 140, 81, [22, 22, 0, 0]); c.stroke();
    } else {
      // civilian: open collar + lanyard, no armor
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(120, 200, 16, 100);
      c.fillStyle = '#b8c6d6'; rr(c, 92, 205, 72, 12, 6); c.fill();
    }
    // head
    const hx = 49, hy = 49, hw = 158, hh = 179;
    rr(c, hx, hy, hw, hh, [77, 77, 60, 60]); c.fillStyle = vgrad(c, hy, hy + hh, L.mask, L.mask2); c.fill();
    const rg = c.createRadialGradient(hx + hw * .32, hy + hh * .22, 4, hx + hw * .32, hy + hh * .22, hw * .7);
    rg.addColorStop(0, 'rgba(255,255,255,.3)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    rr(c, hx, hy, hw, hh, [77, 77, 60, 60]); c.fillStyle = rg; c.fill();
    const sg = c.createLinearGradient(hx, hy, hx + hw, hy + hh); sg.addColorStop(.55, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.38)');
    rr(c, hx, hy, hw, hh, [77, 77, 60, 60]); c.fillStyle = sg; c.fill();
    // eyes
    if (hostage) {
      c.fillStyle = L.eye; [92, 148].forEach(x => { c.beginPath(); c.ellipse(x, 128, 9, 6, 0, 0, 7); c.fill(); });
      c.strokeStyle = 'rgba(60,30,10,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(128, 172, 14, .15, Math.PI - .15); c.stroke();
    } else {
      rr(c, 64, 108, 128, 34, 17); c.fillStyle = 'rgba(0,0,0,.62)'; c.fill();
      c.shadowColor = L.eye; c.shadowBlur = 12; c.fillStyle = L.eye;
      [72, 152].forEach(x => { rr(c, x, 116, 32, 17, 8); c.fill(); });
      c.shadowBlur = 0;
    }
    if (L.helmet) {
      rr(c, 36, 11, 184, 85, [92, 92, 12, 12]); c.fillStyle = vgrad(c, 11, 96, '#41454b', '#17191c'); c.fill();
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(56, 14, 144, 4);
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; rr(c, 36, 11, 184, 85, [92, 92, 12, 12]); c.stroke();
    }
    if (L.visor) {
      rr(c, 44, 57, 168, 119, [84, 84, 38, 38]); c.fillStyle = vgrad(c, 57, 176, 'rgba(150,190,220,.32)', 'rgba(20,30,40,.55)'); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; c.stroke();
    }
    if (hostage) {
      // raised hands (skin) + hostage tag
      [[-6, 150, -.24], [222, 150, .24]].forEach(([x, y, r]) => {
        c.save(); c.translate(x + 20, y + 60); c.rotate(r); rr(c, -20, -60, 40, 100, 20); c.fillStyle = vgrad(c, -60, 40, '#e0c49a', '#b89a6c'); c.fill();
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke(); c.restore();
      });
      rr(c, 62, 258, 132, 30, 4); c.fillStyle = '#ffd166'; c.fill();
      c.fillStyle = '#0c0d0e'; c.font = '800 20px Oxanium, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('⚠ HOSTAGE', 128, 274);
    }
    // rim light (top-left) for the "lit from above" look
    c.strokeStyle = 'rgba(255,220,170,.22)'; c.lineWidth = 3; c.beginPath(); c.arc(hx + 78, hy + 78, 76, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
  }

  // → HTMLCanvasElement (or an Image when the user supplied one via assets.js)
  Art.agentCanvas = (look, o = {}) => {
    const key = JSON.stringify(look) + (o.hostage ? 'H' : '');
    let e = agentCache.get(key);
    if (!e) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 300;
      drawAgent(cv.getContext('2d'), look, !!o.hostage);
      e = { canvas: cv, tex: null }; agentCache.set(key, e);
    }
    return e;
  };
  // optional user image for an agent id / the hostage (async; the scene swaps the texture in when ready)
  Art.agentImage = (agentId, hostage) => {
    const A = BW.ASSETS || {};
    return Art.loadImage(hostage ? A.hostage : (A.agents || {})[agentId]);
  };

  /* ==========================================================
     WEAPON (standalone SVG → image) + hands → viewmodel canvas
     ========================================================== */
  const SVGN = 'http://www.w3.org/2000/svg';
  const HANDS_AT = {          // hand anchors in the weapon's 320×110 viewBox
    rifle:   { grip: [206, 84], fore: [104, 58] },
    smg:     { grip: [164, 82], fore: [84, 58] },
    pistol:  { grip: [214, 86], fore: [196, 100] },
    sniper:  { grip: [204, 84], fore: [162, 76] },
    shotgun: { grip: [226, 82], fore: [114, 66] }
  };
  const VM_W = 640, VM_H = 340, K = 1.75, OX = 40, OY = 84;    // canvas mapping of the weapon art

  Art.weaponSVGStandalone = (w, s) => {
    const S = Art.shapes(w.art);
    return `<svg xmlns="${SVGN}" viewBox="0 0 320 110" width="${320 * 2}" height="${110 * 2}">` +
      `<defs><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient></defs>` +
      `<g fill="${s.c}">${S.body}</g><g fill="#16181b">${S.dark}</g><g fill="${s.a}">${S.acc}</g>` +
      `<g fill="${s.a}" opacity=".85">${Art.patternSVG(s.p, S.region)}</g><g fill="url(#sh)" opacity="${s.m}">${S.body}</g></svg>`;
  };

  function drawHand(c, anchor, tip, side) {
    // forearm sleeve from the off-screen point (tip) to the wrist, then a gloved hand over the weapon
    const [x, y] = anchor, dx = tip[0] - x, dy = tip[1] - y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    c.save(); c.lineCap = 'round';
    const g = c.createLinearGradient(x, y, tip[0], tip[1]); g.addColorStop(0, '#3b4236'); g.addColorStop(1, '#1d211a');
    c.strokeStyle = g; c.lineWidth = 78; c.beginPath(); c.moveTo(x + ux * 46, y + uy * 46); c.lineTo(tip[0], tip[1]); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 8; c.beginPath(); c.moveTo(x + ux * 46 - uy * 24, y + uy * 46 + ux * 24); c.lineTo(tip[0] - uy * 24, tip[1] + ux * 24); c.stroke();
    // cuff
    c.strokeStyle = '#101210'; c.lineWidth = 80; c.beginPath(); c.moveTo(x + ux * 42, y + uy * 42); c.lineTo(x + ux * 56, y + uy * 56); c.stroke();
    // glove: palm + knuckles + fingers wrapped over the weapon
    c.translate(x, y); c.rotate(Math.atan2(uy, ux) - Math.PI / 2);
    const pg = c.createLinearGradient(-30, -20, 30, 30); pg.addColorStop(0, '#34383e'); pg.addColorStop(1, '#14161a');
    c.fillStyle = pg; rr(c, -32, -26, 64, 70, 24); c.fill();
    c.fillStyle = '#0f1114'; for (let i = 0; i < 4; i++) { rr(c, -30 + i * 15.5, -34, 14, 30, 7); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { rr(c, -30 + i * 15.5, -34, 14, 30, 7); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-26, -22, 52, 4);
    // thumb
    c.fillStyle = '#1a1c20'; c.save(); c.rotate(side * 0.7); rr(c, side > 0 ? 18 : -38, -6, 20, 44, 10); c.fill(); c.restore();
    c.restore();
  }

  const vmCache = new Map();
  // → Promise<{ canvas, muzzle:[u,v] (0..1 of the canvas), custom:boolean }>
  Art.viewmodelCanvas = (w, skin) => {
    const key = w.id + ':' + skin.id;
    if (vmCache.has(key)) return vmCache.get(key);
    const A = BW.ASSETS || {}, cfg = (A.weapons || {})[w.id] || {};
    const p = new Promise(async resolve => {
      const cv = document.createElement('canvas'); cv.width = VM_W; cv.height = VM_H;
      const c = cv.getContext('2d');
      const mz = Art.shapes(w.art).muzzle, muzzle = [(OX + mz[0] * K) / VM_W, (OY + mz[1] * K) / VM_H];
      const hands = A.hands || {};
      const userWeapon = await Art.loadImage(cfg[skin.id] || cfg.default);
      if (userWeapon || hands.combined) {                       // user-supplied art: back hand → weapon → front hand
        const [hb, hf, hc] = await Promise.all([Art.loadImage(hands.back), Art.loadImage(hands.front), Art.loadImage(hands.combined)]);
        const fit = im => { const s = Math.min(VM_W / im.width, VM_H / im.height); return [(VM_W - im.width * s) / 2, VM_H - im.height * s, im.width * s, im.height * s]; };
        if (hb) c.drawImage(hb, ...fit(hb));
        const main = hc && !userWeapon ? hc : userWeapon;
        if (main) c.drawImage(main, ...fit(main));
        if (hf) c.drawImage(hf, ...fit(hf));
        return resolve({ canvas: cv, muzzle: cfg.muzzle || muzzle, custom: true });
      }
      const img = new Image();
      img.onload = () => {
        const H = HANDS_AT[w.art] || HANDS_AT.rifle, P = a => [OX + a[0] * K, OY + a[1] * K];
        drawHand(c, P(H.fore), [P(H.fore)[0] + 70, VM_H + 90], -1);               // BACK hand (support)
        c.filter = 'none'; c.drawImage(img, OX, OY, 320 * K, 110 * K);            // WEAPON
        drawHand(c, P(H.grip), [P(H.grip)[0] + 40, VM_H + 110], 1);               // FRONT hand (trigger)
        resolve({ canvas: cv, muzzle, custom: false });
      };
      img.onerror = () => resolve({ canvas: cv, muzzle, custom: false });
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Art.weaponSVGStandalone(w, skin));
    });
    vmCache.set(key, p);
    return p;
  };
})();
