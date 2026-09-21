/* ==========================================================
   BREACH & WHACK — VIEWMODEL (first-person hands + weapon)
   Rendered in its own overlay scene AFTER the world with a
   cleared depth buffer, so it can never clip into the wall.
   It is purely visual: reload progress and fire events are
   pushed in by game.js (the game state stays authoritative).
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, T = window.THREE, Art = BW.Art, clamp = BW.clamp;
  const PLANE_W = 1, PLANE_H = 340 / 640, BASE = 0.92;     // viewmodel plane = 640×340 art → 1 × 0.53 units at scale 1

  BW.ViewModel = {
    create(renderer) {
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(60, 16 / 9, 0.05, 10);
      const group = new T.Group(); scene.add(group);
      const mat = new T.MeshBasicMaterial({ transparent: true, depthTest: false, color: 0xe8e8e8 });
      const mesh = new T.Mesh(new T.PlaneGeometry(PLANE_W, PLANE_H), mat); group.add(mesh);

      // muzzle flash: additive star sprite parented to the plane (weapon-specific offset)
      const flashTex = BW.Scene3D.canvasTex(128, 128, (c) => {
        const g = c.createRadialGradient(64, 64, 2, 64, 64, 60); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(.25, 'rgba(255,190,80,.85)'); g.addColorStop(1, 'rgba(255,120,20,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128);
        c.fillStyle = 'rgba(255,240,190,.9)'; c.translate(64, 64);
        for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, -4); c.lineTo(58, 0); c.lineTo(0, 4); c.fill(); }
      });
      const flash = new T.Mesh(new T.PlaneGeometry(0.32, 0.32), new T.MeshBasicMaterial({ map: flashTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthTest: false, depthWrite: false }));
      flash.renderOrder = 2; mesh.add(flash);

      const cache = new Map();            // weaponId:skinId → { tex, muzzle }
      const s = {
        visible: false, aspect: 16 / 9, cfg: null, w: null, key: '',
        swayX: 0, swayY: 0, lastNx: 0, lastNy: 0, vx: 0, vy: 0, breath: 0,
        recPos: 0, recRot: 0, cam: 0, flash: 0, reload: -1, reloadType: 'mag',
        sw: { t: 1, ms: 350, pending: null, swapped: true }
      };

      function apply(entry) {
        mat.map = entry.tex; mat.needsUpdate = true;
        const m = s.cfg.muzzleOffset || [(entry.muzzle[0] - 0.5) * PLANE_W, (0.5 - entry.muzzle[1]) * PLANE_H, 0.01];
        flash.position.set(m[0], m[1], m[2] || 0.01);
      }

      const api = {
        resize(aspect) { s.aspect = aspect; cam.aspect = aspect; cam.updateProjectionMatrix(); },
        setVisible(v) { s.visible = v; },
        camKick: () => s.cam,

        // weapon + skin → (async) canvas texture. Switching lowers the old model, swaps, raises the new one.
        equip(w, skin, instant) {
          const key = w.id + ':' + skin.id;
          s.w = w; s.cfg = BW.viewModel(w); s.reloadType = s.cfg.reload; s.reload = -1;
          const load = cache.get(key) ? Promise.resolve(cache.get(key)) : Art.viewmodelCanvas(w, skin).then(r => {
            const tex = new T.CanvasTexture(r.canvas); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
            const e = { tex, muzzle: r.muzzle }; cache.set(key, e); return e;
          });
          s.key = key; s.sw.ms = s.cfg.switchMs || 350;
          if (instant || !mat.map) { s.sw.t = 1; s.sw.swapped = true; load.then(e => { if (s.key === key) apply(e); }); }
          else { s.sw.t = 0; s.sw.swapped = false; s.sw.pending = load.then(e => ({ key, e })); }
          return load;
        },

        fire() {
          const r = s.cfg.recoil;
          s.recPos = Math.min(r.position * 2.2, s.recPos + r.position);
          s.recRot = Math.min(r.rotation * 2.2, s.recRot + r.rotation);
          s.cam = Math.min(r.camera * 3, s.cam + r.camera);
          s.flash = 1; flash.rotation.z = Math.random() * 6.28; flash.scale.setScalar(0.75 + Math.random() * 0.5);
        },

        // progress 0..1 while the game is reloading, -1 otherwise (the game logic decides when it ends)
        reload(p) { s.reload = p; },

        // muzzle in screen px (for smoke) — computed from the overlay camera
        muzzleScreen() {
          const v = new T.Vector3(); flash.getWorldPosition(v); v.project(cam);
          return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
        },

        update(dt, nx, ny) {
          if (!s.cfg) return;
          const c = s.cfg;
          // sway: follows the mouse (velocity + offset), then drifts home
          const vx = (nx - s.lastNx) / Math.max(dt, 0.001), vy = (ny - s.lastNy) / Math.max(dt, 0.001); s.lastNx = nx; s.lastNy = ny;
          const k = 1 - Math.exp(-dt * c.sway.speed);
          s.vx += (clamp(vx, -6, 6) - s.vx) * k; s.vy += (clamp(vy, -6, 6) - s.vy) * k;
          s.swayX += ((-nx * c.sway.amount * 1.6 - s.vx * c.sway.amount * 0.5) - s.swayX) * k;
          s.swayY += ((ny * c.sway.amount * 0.9 + s.vy * c.sway.amount * 0.3) - s.swayY) * k;
          s.breath += dt;
          // recoil recovers exponentially; `recovery` is (roughly) the ms it takes
          const rk = Math.exp(-dt * 3.2 / (c.recoil.recovery / 1000));
          s.recPos *= rk; s.recRot *= rk; s.cam *= Math.exp(-dt * 6);
          s.flash = Math.max(0, s.flash - dt * 16);

          // switch animation: lower → swap texture → raise (overshoot then settle)
          let swY = 0;
          if (s.sw.t < 1) {
            s.sw.t = Math.min(1, s.sw.t + dt * 1000 / s.sw.ms);
            if (s.sw.t < 0.45) { const e = s.sw.t / 0.45; swY = -0.75 * e * e; }
            else {
              if (!s.sw.swapped && s.sw.pending) { const p = s.sw.pending; s.sw.pending = null; p.then(r => { if (s.key === r.key) { apply(r.e); } }); s.sw.swapped = true; }
              const e = (s.sw.t - 0.45) / 0.55, b = 1 - e; swY = -0.75 * b * b * (1 + 0.6 * Math.sin(e * Math.PI));
            }
          }

          // reload pose
          let rx = 0, ry = 0, rz = 0;
          if (s.reload >= 0) {
            const p = s.reload, bell = Math.pow(Math.sin(Math.PI * clamp(p, 0, 1)), 0.75);
            if (s.reloadType === 'tilt') { ry = -0.13 * bell; rz = -0.36 * bell; rx = -0.05 * bell; }
            else if (s.reloadType === 'mag') { ry = -0.15 * bell; rz = 0.26 * bell; rx = -0.06 * bell + Math.sin(p * Math.PI * 6) * 0.02 * bell; }
            else if (s.reloadType === 'bolt') { ry = -0.11 * bell; rz = 0.14 * bell; rx = -0.07 * Math.sin(p * Math.PI * 4) * bell; }
            else { ry = -0.09 * bell; rz = 0.12 * bell; rx = 0.08 * Math.sin(p * Math.PI * 6) * bell; }      // pump
          }
          const aK = clamp(s.aspect / 1.78, 0.42, 1);           // narrow screens: shrink + tuck towards the centre
          const idleY = Math.sin(s.breath * 1.5) * 0.006, idleX = Math.cos(s.breath * 0.9) * 0.004;
          group.position.set(
            c.pos[0] * aK + s.swayX + idleX + s.recPos * 0.55 + rx,
            c.pos[1] + s.swayY + idleY - s.recPos * 0.4 + ry + swY,
            c.pos[2]);
          group.rotation.set(0, 0, c.rot[2] - s.recRot + rz + s.swayX * 0.8);
          group.scale.setScalar(c.scale * BASE * (0.55 + 0.45 * aK) * (1 + s.recPos * 0.25));
          flash.material.opacity = s.flash;
          mesh.visible = !!mat.map;
        },

        render() { if (s.visible && mat.map) renderer.render(scene, cam); },
        debug: () => ({ weapon: s.w && s.w.id, recPos: s.recPos, recRot: s.recRot, flash: s.flash, reload: s.reload, switching: s.sw.t < 1, pos: group.position.toArray(), rot: group.rotation.z, scale: group.scale.x, hasTex: !!mat.map })
      };
      cam.position.set(0, 0, 0);
      return api;
    }
  };
})();
