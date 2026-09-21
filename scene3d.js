/* ==========================================================
   BREACH & WHACK — SCENE 3D (Three.js renderer)
   Owns: camera, room, 9 recessed target holes, enemy sprites,
   lighting, decals, raycast picking. It never touches score,
   combo, XP or ammo: game.js tells it WHAT to show and asks it
   WHAT a shot hit → 'head' | 'body' | miss.
   The first-person weapon lives in viewmodel.js.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, T = window.THREE, Art = BW.Art, clamp = BW.clamp;
  const S3 = BW.Scene3D = { ok: false };

  /* ---------- layout (world units, wall plane at z = 0, camera looks toward -z) ---------- */
  const COLS = [-1.95, 0, 1.95], ROWS = [4.4, 2.78, 1.16];       // hole centres → holes 1..9, row-major
  const HOLE_W = 1.4, HOLE_H = 1.3, WALL_W = 16, WALL_H = 7.6, WALL_D = 0.6;
  const CAM = { x: 0, y: 1.75, z: 7.6, fov: 54, pitch: 0.05 };
  const AG_W = 1.1, AG_H = AG_W * 300 / 256;                     // enemy plane (matches the 256×300 sprite)
  const HIDE_DROP = 1.55;                                        // how far below the rim an agent rests
  const RARITY_GLOW = { common: 0xff7a20, rare: 0x4da3ff, epic: 0xb46bff, legendary: 0xffb020 };

  const holes = [], hitBoxes = [], envObjs = [];
  let renderer, scene, camera, canvas, wall, VM, decals = [], decalIdx = 0;
  const ray = new T.Raycaster(), ndc = new T.Vector2(), tmp = new T.Vector3();
  const st = { mode: 'menu', aim: 'cursor', time: 0, px: 0, py: 0, yaw: 0, pitch: 0, shake: 0, flash: 0, demo: 0, look: { x: 0, y: 0 }, quality: 1 };
  let flashLight;

  /* ---------- procedural textures ---------- */
  const rnd = BW.rng ? BW.rng(1337) : Math.random;
  function canvasTex(w, h, draw, opts = {}) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(cv);
    tex.encoding = T.sRGBEncoding; tex.anisotropy = opts.aniso || 4;
    if (opts.repeat) { tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(opts.repeat[0], opts.repeat[1]); }
    return tex;
  }
  function speckle(c, w, h, n, a) {
    for (let i = 0; i < n; i++) { c.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${rnd() * a})` : `rgba(0,0,0,${rnd() * a * 1.6})`; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  }
  function mottle(c, w, h, n) {
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 160, g = c.createRadialGradient(x, y, 0, x, y, r);
      const d = rnd() < 0.5; g.addColorStop(0, d ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.045)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function hazard(c, x, y, w, h, size) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#d99a1c'; c.fillRect(x, y, w, h); c.fillStyle = '#14161a';
    for (let i = -h; i < w + h; i += size * 2) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + size, y + h); c.lineTo(x + i + size + h, y); c.lineTo(x + i + h, y); c.closePath(); c.fill(); }
    c.restore();
  }

  function wallTexture() {
    return canvasTex(2048, 972, (c, w, h) => {
      c.fillStyle = '#34383d'; c.fillRect(0, 0, w, h); mottle(c, w, h, 70); speckle(c, w, h, 16000, 0.09);
      const pw = w / 8, ph = h / 4;                                    // big steel panels
      for (let x = 0; x <= w; x += pw) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 2, 0, 4, h); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x + 2, 0, 1.5, h); }
      for (let y = 0; y <= h; y += ph) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, y - 2, w, 4); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(0, y + 2, w, 1.5); }
      for (let x = 0; x <= w; x += pw) for (let y = 0; y <= h; y += ph) for (const [dx, dy] of [[14, 14], [-14, 14], [14, -14], [-14, -14]]) {
        c.fillStyle = '#0d0e10'; c.beginPath(); c.arc(x + dx, y + dy, 5, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(x + dx - 1, y + dy - 1, 2, 0, 7); c.fill();
      }
      c.fillStyle = '#1d2024'; c.fillRect(0, 0, w, 70); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, 70, w, 2);          // top beam
      hazard(c, 0, h - 54, w, 54, 26);                                                                                          // skirting
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, h - 58, w, 4);
      c.font = '800 64px Oxanium, sans-serif'; c.fillStyle = 'rgba(255,255,255,.07)'; c.textBaseline = 'middle';
      c.textAlign = 'left'; c.fillText('RANGE 01', 60, 210); c.textAlign = 'right'; c.fillText('LIVE FIRE', w - 60, 210);
      for (let i = 0; i < 26; i++) { c.strokeStyle = `rgba(255,255,255,${0.02 + rnd() * 0.05})`; c.lineWidth = 1; const x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 60); c.stroke(); }
    });
  }
  function floorTexture() {
    return canvasTex(1024, 896, (c, w, h) => {
      c.fillStyle = '#26282c'; c.fillRect(0, 0, w, h); mottle(c, w, h, 60); speckle(c, w, h, 14000, 0.1);
      for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(255,255,255,${0.02 + rnd() * 0.06})`; c.lineWidth = 1; const x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 200, y + (rnd() - 0.5) * 30); c.stroke(); }
      c.fillStyle = 'rgba(232,190,60,.55)'; [w * 0.3, w * 0.5, w * 0.7].forEach(x => { for (let y = 20; y < h - 200; y += 90) c.fillRect(x - 3, y, 6, 50); });      // lane markings
      hazard(c, 0, h * 0.34 - 20, w, 40, 20);                                                                                                       // firing line (z ≈ 4.8)
      c.fillStyle = 'rgba(255,255,255,.12)'; c.font = '800 56px Oxanium, sans-serif'; c.textAlign = 'center';
      ['1', '2', '3'].forEach((n, i) => c.fillText(n, w * (0.3 + i * 0.2) - 0, h * 0.34 + 90));
    });
  }
  function ceilingTexture() {
    return canvasTex(1024, 512, (c, w, h) => {
      c.fillStyle = '#1b1d21'; c.fillRect(0, 0, w, h); speckle(c, w, h, 6000, 0.07);
      for (let x = 0; x <= w; x += 128) { c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - 2, 0, 4, h); }
      for (let y = 0; y <= h; y += 128) { c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(0, y - 2, w, 4); }
    });
  }
  function sideTexture() {
    return canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = '#212429'; c.fillRect(0, 0, w, h); speckle(c, w, h, 5000, 0.07);
      for (let x = 0; x <= w; x += 128) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 2, 0, 4, h); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x + 2, 0, 1, h); }
      hazard(c, 0, h - 34, w, 34, 17);
    });
  }
  function glowTexture() {
    return canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  }
  function decalTexture() {
    return canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 1, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(.28, 'rgba(0,0,0,.9)'); g.addColorStop(.42, 'rgba(70,60,50,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.2; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + rnd(); c.beginPath(); c.moveTo(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9); c.lineTo(32 + Math.cos(a) * (18 + rnd() * 12), 32 + Math.sin(a) * (18 + rnd() * 12)); c.stroke(); }
    });
  }
  S3.canvasTex = canvasTex; S3.glowTexture = glowTexture;

  /* ---------- geometry helpers ---------- */
  function roundedRect(shape, cx, cy, w, h, r) {
    const x = cx - w / 2, y = cy - h / 2;
    shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y); return shape;
  }

  /* ==========================================================
     BUILD THE WORLD
     ========================================================== */
  function buildRoom() {
    const wallTex = wallTexture(); wallTex.repeat.set(1 / WALL_W, 1 / WALL_H); wallTex.offset.set(0.5, 0);
    const wallMat = new T.MeshStandardMaterial({ map: wallTex, roughness: 0.92, metalness: 0.08 });
    const cavMat = new T.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.85, metalness: 0.35, side: T.DoubleSide });

    // wall = one slab with 9 real cut-outs; the cut-out side faces form the cavities
    const shape = new T.Shape(); shape.moveTo(-WALL_W / 2, 0); shape.lineTo(WALL_W / 2, 0); shape.lineTo(WALL_W / 2, WALL_H); shape.lineTo(-WALL_W / 2, WALL_H); shape.closePath();
    ROWS.forEach(y => COLS.forEach(x => shape.holes.push(roundedRect(new T.Path(), x, y, HOLE_W, HOLE_H, 0.26))));
    const geo = new T.ExtrudeGeometry(shape, { depth: WALL_D, bevelEnabled: false, curveSegments: 6 });
    wall = new T.Mesh(geo, [wallMat, cavMat]);
    wall.position.z = -WALL_D; wall.receiveShadow = true; wall.castShadow = false;
    scene.add(wall); wall.layers.enable(2); envObjs.push(wall);

    // floor
    const floorTex = floorTexture();
    const floor = new T.Mesh(new T.PlaneGeometry(WALL_W, 14), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.62, metalness: 0.18 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 7); floor.receiveShadow = true;
    scene.add(floor); floor.layers.enable(2); envObjs.push(floor);

    // ceiling + light strips
    const ceilTex = ceilingTexture(); ceilTex.wrapS = ceilTex.wrapT = T.RepeatWrapping; ceilTex.repeat.set(4, 4);
    const ceil = new T.Mesh(new T.PlaneGeometry(WALL_W, 14), new T.MeshStandardMaterial({ map: ceilTex, roughness: 0.9, metalness: 0.1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, WALL_H, 7); scene.add(ceil); ceil.layers.enable(2); envObjs.push(ceil);
    const strip = new T.MeshBasicMaterial({ color: 0xffb070 });
    [-4.5, 4.5].forEach(x => [1.5, 5, 8.5, 12].forEach(z => { const m = new T.Mesh(new T.BoxGeometry(0.35, 0.05, 2.2), strip); m.position.set(x, WALL_H - 0.03, z); scene.add(m); }));
    const cool = new T.MeshBasicMaterial({ color: 0xbfd6ff });
    [0].forEach(x => [1.5, 5, 8.5, 12].forEach(z => { const m = new T.Mesh(new T.BoxGeometry(1.4, 0.05, 0.25), cool); m.position.set(x, WALL_H - 0.03, z); scene.add(m); }));

    // side walls
    const sideTex = sideTexture(); sideTex.wrapS = sideTex.wrapT = T.RepeatWrapping; sideTex.repeat.set(4, 2);
    const sideMat = new T.MeshStandardMaterial({ map: sideTex, roughness: 0.9, metalness: 0.15 });
    [-1, 1].forEach(s => {
      const m = new T.Mesh(new T.PlaneGeometry(14, WALL_H), sideMat);
      m.rotation.y = -s * Math.PI / 2; m.position.set(s * WALL_W / 2, WALL_H / 2, 7); scene.add(m); m.layers.enable(2); envObjs.push(m);
      // wall-mounted lamp
      const lamp = new T.Mesh(new T.BoxGeometry(0.15, 0.7, 0.5), strip); lamp.position.set(s * (WALL_W / 2 - 0.1), 4.4, 3.5); scene.add(lamp);
    });

    // hazard beam over the targets + floor bumper (silhouette depth)
    const beam = new T.Mesh(new T.BoxGeometry(WALL_W, 0.3, 0.5), new T.MeshStandardMaterial({ color: 0x24272b, roughness: 0.6, metalness: 0.5 }));
    beam.position.set(0, 6.05, 0.22); beam.castShadow = true; scene.add(beam);
  }

  function buildLights() {
    scene.add(new T.HemisphereLight(0xc4cad4, 0x1c1a18, 0.78));
    const dir = new T.DirectionalLight(0xe6eeff, 0.72);
    dir.position.set(-3.5, 7, 11); dir.target.position.set(0, 2.6, 0);
    dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); dir.shadow.bias = -0.0004; dir.shadow.radius = 3;
    Object.assign(dir.shadow.camera, { left: -9, right: 9, top: 6, bottom: -1, near: 1, far: 30 });
    scene.add(dir, dir.target);
    [-1, 1].forEach(s => { const p = new T.PointLight(0xff8a30, 0.7, 16, 1.6); p.position.set(s * 5.6, 5.2, 3); scene.add(p); });
    const cool = new T.PointLight(0xa8c0ff, 0.28, 18, 1.6); cool.position.set(0, 6.3, 5); scene.add(cool);
    flashLight = new T.PointLight(0xffb060, 0, 9, 1.8); flashLight.position.set(0.4, 1.5, 6.6); scene.add(flashLight);   // muzzle-flash spill
  }

  function buildHoles() {
    // raised metal frame (one shared geometry) with bolts
    const fs = new T.Shape(); roundedRect(fs, 0, 0, HOLE_W + 0.24, HOLE_H + 0.24, 0.32);
    fs.holes.push(roundedRect(new T.Path(), 0, 0, HOLE_W, HOLE_H, 0.26));
    const frameGeo = new T.ExtrudeGeometry(fs, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 6 });
    const frameMat = new T.MeshStandardMaterial({ color: 0x23272d, roughness: 0.9, metalness: 0.02 });
    const boltGeo = new T.CylinderGeometry(0.045, 0.045, 0.06, 10), boltMat = new T.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.7 });
    const glowTex = glowTexture(), backGeo = new T.PlaneGeometry(HOLE_W + 0.4, HOLE_H + 0.4);
    const agGeo = new T.PlaneGeometry(AG_W, AG_H); agGeo.translate(0, AG_H / 2, 0);
    const headGeo = new T.BoxGeometry(0.62, 0.68, 0.25), bodyGeo = new T.BoxGeometry(1.02, 0.46, 0.25);
    const glowGeo = new T.PlaneGeometry(2.4, 2.2), spillGeo = new T.PlaneGeometry(2.9, 2.6);

    ROWS.forEach((cy, r) => COLS.forEach((cx, c) => {
      const i = r * 3 + c, g = new T.Group(); g.position.set(cx, cy, 0); scene.add(g);
      const fr = new T.Mesh(frameGeo, frameMat); fr.position.z = 0.0; fr.castShadow = true; fr.receiveShadow = true; g.add(fr);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const b = new T.Mesh(boltGeo, boltMat); b.rotation.x = Math.PI / 2; b.position.set(sx * (HOLE_W / 2 + 0.085), sy * (HOLE_H / 2 + 0.085), 0.13); g.add(b); });
      // cavity back plate (dark, faintly lit)
      const back = new T.Mesh(backGeo, new T.MeshBasicMaterial({ color: 0x040405 })); back.position.z = -WALL_D + 0.01; g.add(back);
      const glowMat = new T.MeshBasicMaterial({ map: glowTex, color: 0xff7a20, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      const glow = new T.Mesh(glowGeo, glowMat); glow.position.z = -WALL_D + 0.06; g.add(glow);
      const spillMat = glowMat.clone(); const spill = new T.Mesh(spillGeo, spillMat); spill.position.z = 0.1; g.add(spill);      // light spilling on the wall face
      // agent: sprite plane INSIDE the cavity + invisible hit boxes that travel with it
      const ag = new T.Group(); ag.position.set(0, -HIDE_DROP - HOLE_H / 2, -0.3); g.add(ag);
      const mat = new T.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, color: 0xd8d8d8 });
      const mesh = new T.Mesh(agGeo, mat); mesh.visible = false; ag.add(mesh);
      const head = new T.Mesh(headGeo, new T.MeshBasicMaterial()); head.position.set(0, 0.70, 0.02); head.userData = { hole: i, part: 'head' }; head.layers.mask = 0; ag.add(head);
      const body = new T.Mesh(bodyGeo, new T.MeshBasicMaterial()); body.position.set(0, 0.23, 0.02); body.userData = { hole: i, part: 'body' }; body.layers.mask = 0; ag.add(body);
      hitBoxes.push(head, body);
      holes.push({ i, cx, cy, g, ag, mesh, mat, glow, glowMat, spillMat, head, body, state: 'hidden', phase: 'hidden', t: 0, y: -HIDE_DROP, rot: 0, tex: null, token: 0, glowTarget: 0, mdl: null });
    }));
    for (let k = 0; k < 18; k++) {                                   // bullet-hole decal pool
      const d = new T.Mesh(new T.PlaneGeometry(0.2, 0.2), new T.MeshBasicMaterial({ map: S3._decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      d.visible = false; scene.add(d); decals.push(d);
    }
  }

  /* ==========================================================
     PUBLIC API
     ========================================================== */
  S3.init = cv => {
    canvas = cv;
    try {
      renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    } catch (e) { console.warn('[scene3d] WebGL unavailable:', e.message); return false; }
    if (!renderer.getContext()) return false;
    if (T.ColorManagement) T.ColorManagement.legacyMode = false;      // hex colours are sRGB → correct (darker) materials
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.28;
    renderer.localClippingEnabled = true;               // per-hole rim clipping for the 3D enemy
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.autoClear = false;
    scene = new T.Scene(); scene.background = new T.Color(0x07080a); scene.fog = new T.Fog(0x07080a, 10, 28);
    camera = new T.PerspectiveCamera(CAM.fov, 16 / 9, 0.1, 60);
    S3._decalTex = decalTexture();
    buildLights(); buildRoom(); buildHoles();
    VM = S3.vm = BW.ViewModel.create(renderer);
    S3.resize(); addEventListener('resize', S3.resize);
    S3.ok = true;
    S3.setMode('menu');
    if (BW.Model3D) { BW.on('model3d', () => S3.attachModels()); BW.Model3D.load(); }     // GLB enemy; sprites are used until it is ready (or forever if it fails)
    return true;
  };

  S3.resize = () => {
    if (!renderer) return;
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    camera.aspect = w / h;
    // narrow / portrait screens: pull back so all 3 columns stay visible
    const need = (COLS[2] + HOLE_W / 2 + 0.7) * 2, vis = 2 * CAM.z * Math.tan(CAM.fov * Math.PI / 360) * camera.aspect;
    camera.fov = need > vis ? Math.min(85, CAM.fov * need / vis * 0.98) : CAM.fov;
    camera.updateProjectionMatrix();
    if (VM) VM.resize(camera.aspect);
  };

  S3.setMode = mode => {
    st.mode = mode; st.demo = 0;
    if (mode === 'menu') holes.forEach(h => S3.setHole(h.i, 'hidden', null, true));
    if (VM) VM.setVisible(mode === 'game');
  };
  S3.setAimMode = m => { st.aim = m; st.look.x = st.look.y = 0; };
  S3.lookDelta = (dx, dy, sens) => {
    st.look.x = clamp(st.look.x - dx * sens, -0.42, 0.42);
    st.look.y = clamp(st.look.y - dy * sens, -0.24, 0.24);
  };
  S3.pointer = (nx, ny) => { st.px = nx; st.py = ny; };            // -1..1, drives sway + subtle camera parallax
  S3.shake = mag => { st.shake = Math.max(st.shake, mag); };

  /* ---------- hole / agent state ---------- */
  const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const upY = h => -HOLE_H / 2;                                     // plane bottom sits on the rim
  const hidY = () => -HOLE_H / 2 - HIDE_DROP;

  /* ---------- enemy model (GLB) — sprite stays as the fallback and for hostages ---------- */
  const SPRITE_HIT = { head: { y: 0.70, w: 0.62, h: 0.68 }, body: { y: 0.23, w: 1.02, h: 0.46 } };
  function fitBox(box, base, d) { box.position.y = d.y; box.scale.set(d.w / base[0], d.h / base[1], 1); }
  function applyHit(h, asModel) {                                  // hit-boxes follow whatever is drawn
    const H = asModel ? BW.Model3D.template.hit : SPRITE_HIT;
    fitBox(h.head, [0.62, 0.68], H.head); fitBox(h.body, [1.02, 0.46], H.body);
  }
  S3.attachModels = () => {
    if (!BW.Model3D || BW.Model3D.state !== 'ready') return false;
    holes.forEach(h => {
      if (h.mdl) return;
      const rim = new T.Plane(new T.Vector3(0, 1, 0), -(h.cy - HOLE_H / 2 - 0.015));      // keep y ≥ this hole's rim
      const m = BW.Model3D.spawn(rim); if (m) { h.mdl = m; h.ag.add(m.group); }
    });
    return true;
  };
  S3.modelInfo = () => ({ state: BW.Model3D ? BW.Model3D.state : 'none', error: BW.Model3D && BW.Model3D.error, attached: holes.filter(h => h.mdl).length });

  function setTexture(h, entry) {
    if (!entry.tex) { entry.tex = new T.CanvasTexture(entry.canvas); entry.tex.encoding = T.sRGBEncoding; entry.tex.anisotropy = 4; }
    h.mat.map = entry.tex; h.mat.needsUpdate = true;
  }

  // state: 'hidden' | 'up' | 'dead'  · occ: { look, hostage, rarity, agentId }
  S3.setHole = (i, state, occ, instant) => {
    const h = holes[i]; if (!h) return;
    if (state === 'up' && occ) {
      h.token++;
      const asModel = !occ.hostage && !!h.mdl;                     // enemies = 3D model · hostage / fallback = sprite
      if (h.mdl) h.mdl.group.visible = asModel;
      if (asModel) h.mdl.group.rotation.y = (Math.random() * 2 - 1) * ((BW.Model3D.cfg && BW.Model3D.cfg.facing) || 0.25);
      applyHit(h, asModel);
      setTexture(h, Art.agentCanvas(occ.look, { hostage: occ.hostage }));
      if (!asModel && BW.ASSETS && (occ.hostage ? BW.ASSETS.hostage : (BW.ASSETS.agents || {})[occ.agentId])) {       // optional user PNG/WebP
        const tk = h.token;
        Art.agentImage(occ.agentId, occ.hostage).then(im => { if (im && tk === h.token) { const tex = new T.Texture(im); tex.encoding = T.sRGBEncoding; tex.needsUpdate = true; h.mat.map = tex; h.mat.needsUpdate = true; } });
      }
      h.glowMat.color.setHex(occ.hostage ? 0x4da3ff : (RARITY_GLOW[occ.rarity] || RARITY_GLOW.common));
      h.spillMat.color.copy(h.glowMat.color);
      h.mesh.visible = !asModel; h.state = 'up'; h.phase = 'rise'; h.t = 0; h.rot = 0; h.glowTarget = 1;
      h.hostage = !!occ.hostage;
      h.head.layers.mask = h.body.layers.mask = 2;                 // hit-boxes live on layer 1
    } else if (state === 'dead') {
      h.state = 'dead'; h.phase = 'fall'; h.t = 0; h.glowTarget = 0; h.head.layers.mask = h.body.layers.mask = 0;
    } else {                                                       // hidden → retreat (or instant reset)
      h.head.layers.mask = h.body.layers.mask = 0; h.glowTarget = 0;
      if (instant || h.state === 'hidden') { h.state = 'hidden'; h.phase = 'hidden'; h.y = hidY(); h.mesh.visible = false; if (h.mdl) h.mdl.group.visible = false; h.ag.position.y = h.y; h.glowMat.opacity = h.spillMat.opacity = 0; }
      else { h.state = 'hidden'; h.phase = 'retreat'; h.t = 0; }
    }
  };

  function updateHoles(dt) {
    for (const h of holes) {
      h.t += dt;
      if (h.phase === 'rise') {
        const k = Math.min(1, h.t / 0.34); h.y = hidY() + (upY() - hidY()) * easeOutBack(k);
        if (k >= 1) { h.phase = 'idle'; h.t = 0; }
      } else if (h.phase === 'idle') {
        h.y = upY() + Math.sin(st.time * 2.4 + h.i * 1.7) * 0.012; h.rot = Math.sin(st.time * 1.6 + h.i) * 0.012;
      } else if (h.phase === 'retreat' || h.phase === 'fall') {
        const dur = h.phase === 'retreat' ? 0.2 : 0.28, k = Math.min(1, h.t / dur), e = k * k;
        h.y = h.y + (hidY() - h.y) * Math.min(1, e * 0.5 + dt * 6);
        if (h.phase === 'fall') h.rot = Math.min(0.3, h.rot + dt * 1.6);
        if (k >= 1 && h.y < hidY() + 0.05) { h.phase = 'hidden'; h.mesh.visible = false; if (h.mdl) h.mdl.group.visible = false; h.rot = 0; }
      }
      h.ag.position.y = h.y; h.ag.rotation.z = h.rot;
      if (h.mdl && h.mdl.group.visible) h.mdl.pivot.rotation.y = Math.sin(st.time * 1.3 + h.i * 2.1) * 0.05;      // idle: slow turn of the 3D enemy
      const gT = h.glowTarget * (h.phase === 'rise' || h.phase === 'idle' ? 1 : 0);
      h.glowMat.opacity += (gT * 0.5 - h.glowMat.opacity) * Math.min(1, dt * 10);
      h.spillMat.opacity = h.glowMat.opacity * 0.3;
    }
  }

  /* ---------- picking ---------- */
  function setRay(px, py) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
  }

  // → { hole, part:'head'|'body' }  or  { miss:true, env }
  S3.pick = (px, py) => {
    setRay(px, py);
    ray.layers.set(2); const env = ray.intersectObjects(envObjs, false)[0] || null;
    ray.layers.set(1); const hits = ray.intersectObjects(hitBoxes, false);
    let best = hits[0] || null;
    if (best && env && env.distance < best.distance - 0.02) best = null;          // the wall is in front → blocked
    if (!best) return { miss: true, env, sx: px, sy: py };
    const hole = best.object.userData.hole;
    const head = hits.find(x => x.object.userData.hole === hole && x.object.userData.part === 'head' && x.distance < best.distance + 0.3);
    if (head) best = head;
    return { hole, part: best.object.userData.part, sx: px, sy: py, point: best.point };
  };

  // bullet-hole decal for a missed shot that landed on the wall face
  S3.impact = pick => {
    const e = pick && pick.env;
    if (!e || e.object !== wall || !e.face || e.face.normal.z < 0.9 || e.point.z < -0.01) return;
    const d = decals[decalIdx++ % decals.length];
    d.position.set(e.point.x, e.point.y, e.point.z + 0.004); d.rotation.z = Math.random() * 6.28; d.scale.setScalar(0.8 + Math.random() * 0.6); d.visible = true;
  };
  S3.clearDecals = () => decals.forEach(d => { d.visible = false; });

  // world → screen (px) helpers for HUD pop-ups / particles
  function project(x, y, z) {
    camera.updateMatrixWorld(); tmp.set(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (tmp.x * 0.5 + 0.5) * r.width, y: r.top + (-tmp.y * 0.5 + 0.5) * r.height };
  }
  // part: 'head' | 'body' → centre of that hit-box (on the agent's plane, inside the cavity) · 'top' → above the hole (pop-ups)
  S3.holeScreen = (i, part) => {
    const h = holes[i], base = h.cy - HOLE_H / 2;                  // live hit-box positions (sprite or 3D model)
    return part === 'head' ? project(h.cx, base + h.head.position.y, -0.28) : part === 'body' ? project(h.cx, base + h.body.position.y, -0.28) : project(h.cx, h.cy + 0.85, 0);
  };
  S3.aimCenter = () => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  S3.holeCount = () => holes.length;
  S3.holeState = i => holes[i] && holes[i].state;

  /* ---------- render ---------- */
  S3.muzzleFlashLight = v => { st.flash = v; };

  S3.render = dt => {
    if (!S3.ok) return;
    st.time += dt;
    // camera: eye height, gentle breathing, mouse parallax, look-mode yaw/pitch, recoil + shake
    const look = st.aim === 'look' && st.mode === 'game';
    const kick = VM ? VM.camKick() : 0;
    const sh = st.shake; st.shake *= Math.pow(0.0005, dt);
    camera.position.set(
      CAM.x + st.px * 0.22 + Math.sin(st.time * 0.7) * 0.02 + (Math.random() - 0.5) * sh * 0.06,
      CAM.y + Math.sin(st.time * 1.3) * 0.012 - st.py * 0.05 + (Math.random() - 0.5) * sh * 0.06,
      CAM.z);
    const yaw = (look ? st.look.x : -st.px * 0.03), pitch = CAM.pitch + (look ? st.look.y : st.py * -0.015) + kick;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (st.mode === 'menu') { camera.position.x += Math.sin(st.time * 0.25) * 0.5; camera.rotation.y += Math.sin(st.time * 0.25) * -0.035; }
    // menu ambience: random targets pop up behind the menu
    if (st.mode === 'menu') {
      st.demo -= dt;
      if (st.demo <= 0) {
        st.demo = 1.1 + Math.random() * 0.9; const h = holes[Math.floor(Math.random() * 9)];
        if (h.state === 'hidden') {
          const looks = BW.ENEMY_LOOKS; S3.setHole(h.i, 'up', { look: looks[Math.floor(Math.random() * looks.length)], hostage: Math.random() < 0.15, rarity: 'common' });
          setTimeout(() => { if (st.mode === 'menu') S3.setHole(h.i, 'hidden'); }, 1500 + Math.random() * 900);
        }
      }
    }
    updateHoles(dt);
    flashLight.intensity = st.flash; st.flash *= Math.pow(0.0004, dt);
    renderer.clear();
    renderer.render(scene, camera);
    if (VM && st.mode === 'game') { VM.update(dt, st.px, st.py); renderer.clearDepth(); VM.render(); }
  };
  S3.info = () => renderer ? { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tex: renderer.info.memory.textures, geo: renderer.info.memory.geometries } : null;
  S3.state = st;
})();
