/* ==========================================================
   BREACH & WHACK — MODEL 3D (GLB enemy loader)
   Loads the character declared in assets.js → models.enemy and turns it into a
   ready-to-clone template:
     • official GLTFLoader + SkeletonUtils (vendor/gltf-loader.bundle.js, a classic script → works from file:// too)
     • GLB bytes come from fetch() (http) or, from file://, from models/agent/enemy.glb.js (base64 in a <script>)
     • textures down-scaled (a 38 MB GLB carries ~4K PNGs → far too heavy for a 150 px target)
     • T-pose arms lowered, size measured from the SKINNED vertices
     • feet on y = 0, facing +z (towards the camera)
   Anything failing here just leaves state = 'failed' → scene3d.js keeps the sprite enemies.
   ========================================================== */
(() => {
  'use strict';
  const BW = window.BW, T = window.THREE;
  const M = BW.Model3D = { state: 'idle', error: null, template: null, cfg: null, ms: 0 };
  let SU = null;                                            // SkeletonUtils module (from the bundle)

  const yield_ = () => new Promise(r => setTimeout(r, 0));   // let the page breathe between heavy steps

  /* ---------- textures: keep the look, drop the megapixels ---------- */
  function shrink(tex, max) {
    if (!tex || !tex.image) return;
    const im = tex.image, w = im.width || im.videoWidth, h = im.height || im.videoHeight;
    if (!w || Math.max(w, h) <= max) return;
    const k = max / Math.max(w, h), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(im, 0, 0, cv.width, cv.height);
    if (im.close) im.close();                               // free the decoded ImageBitmap
    tex.image = cv; tex.needsUpdate = true; tex.anisotropy = 4;
  }

  function tidyMaterials(root, size) {
    const seen = new Set(), stats = { materials: 0, textures: 0 };
    root.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false;                              // skinned bounds are bind-pose only
      o.castShadow = false; o.receiveShadow = false;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (seen.has(m)) return; seen.add(m); stats.materials++;
        [['map', size], ['normalMap', size / 2], ['metalnessMap', size / 2], ['roughnessMap', size / 2]].forEach(([k, px]) => {
          const t = m[k]; if (t && !seen.has(t)) { seen.add(t); shrink(t, px); stats.textures++; }
        });
        m.aoMap = null;                                     // needs a 2nd UV set; the baked colour already has shading
        if ('metalness' in m) m.metalness = Math.min(m.metalness, 0.2);   // no environment map → full metal would render black
        if ('specularIntensity' in m) m.specularIntensity = 0.5;
        m.needsUpdate = true;
      });
    });
    return stats;
  }

  /* ---------- pose: lower the T-pose arms ---------- */
  const Z = new T.Vector3(0, 0, 1), qP = new T.Quaternion(), qW = new T.Quaternion();
  function turnAboutWorldZ(bone, ang) {                     // world-space rotation of a bone under rotated parents
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(qP);
    qW.setFromAxisAngle(Z, ang);
    bone.quaternion.premultiply(qP.clone().invert().multiply(qW).multiply(qP));
    bone.updateMatrix(); bone.updateMatrixWorld(true);
  }
  function poseArms(root, drop) {
    if (!drop) return;
    const b = {}; root.traverse(o => { if (o.isBone) b[o.name] = o; });
    if (b.arm_upper_l) turnAboutWorldZ(b.arm_upper_l, -drop);     // left arm points +x → swing it down
    if (b.arm_upper_r) turnAboutWorldZ(b.arm_upper_r, drop);      // right arm points −x
    if (b.arm_lower_l) turnAboutWorldZ(b.arm_lower_l, -0.18);     // slight bend so it doesn't look stiff
    if (b.arm_lower_r) turnAboutWorldZ(b.arm_lower_r, 0.18);
    root.updateMatrixWorld(true);
  }

  /* ---------- measure the SKINNED geometry (accessor min/max only describes the bind mesh) ---------- */
  function measure(root) {
    root.updateMatrixWorld(true);
    const box = new T.Box3(), v = new T.Vector3(); let n = 0;
    root.traverse(o => {
      if (!o.isSkinnedMesh) return;
      o.skeleton.update();
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 2) {
        v.fromBufferAttribute(pos, i);                      // r149: boneTransform() reads the bind position from `target` …
        o.boneTransform(i, v);                              // … and writes the skinned position back into it
        v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); n++;
      }
    });
    if (!n) box.setFromObject(root);                        // static fallback
    const bones = {}; root.traverse(o => { if (o.isBone) { o.getWorldPosition(v); bones[o.name] = v.clone(); } });
    return { box, bones };
  }

  /* ---------- where the GLB bytes come from ---------- */
  function scriptBytes(src) {                               // classic <script> works from file:// where fetch() does not
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => {
        try {
          const b64 = window.BW_GLB_BASE64; delete window.BW_GLB_BASE64; s.remove();
          if (!b64) throw new Error('empty ' + src);
          const bin = atob(b64), out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          res(out.buffer);
        } catch (e) { rej(e); }
      };
      s.onerror = () => { s.remove(); rej(new Error('could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function getBytes(cfg) {
    if (location.protocol !== 'file:') {
      try {
        const r = await fetch(cfg.url);
        if (!r.ok) throw new Error('fetch ' + cfg.url + ' → HTTP ' + r.status);
        return await r.arrayBuffer();
      } catch (e) { if (!cfg.script) throw e; }             // fall through to the script copy
    }
    if (!cfg.script) throw new Error('the model can only be read over http(s) (no `script` copy configured)');
    return scriptBytes(cfg.script);
  }

  /* ---------- public: load ---------- */
  M.load = async function (cfg) {
    cfg = cfg || (BW.ASSETS && BW.ASSETS.models && BW.ASSETS.models.enemy);
    if (!cfg || !cfg.url) { M.state = 'idle'; return null; }
    M.cfg = cfg; M.state = 'loading'; M.error = null;
    const t0 = performance.now();
    try {
      if (!window.BW_GLTF) throw new Error('vendor/gltf-loader.bundle.js was not loaded');
      SU = window.BW_GLTF.SkeletonUtils;
      const bytes = await getBytes(cfg);
      const gltf = await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('timeout after 90 s')), 90000);
        new window.BW_GLTF.GLTFLoader().parse(bytes, '', g => { clearTimeout(to); res(g); }, e => { clearTimeout(to); rej(e && e.message ? e : new Error('GLB parse error')); });
      });
      await yield_();
      const root = gltf.scene;
      const tex = tidyMaterials(root, cfg.textureSize || 1024);
      await yield_();
      poseArms(root, cfg.armDrop == null ? 1.3 : cfg.armDrop);
      const { box, bones } = measure(root);
      const size = box.getSize(new T.Vector3()), height = size.y;
      if (!(height > 0.2 && height < 50)) throw new Error('unexpected model height ' + height);

      // placement: 'stand' → feet on the floor, whole figure fits the opening · 'bust' → cropped at the waist, bigger
      const bust = cfg.fit === 'bust';
      const cut = bust ? cfg.bustCut : box.min.y;
      const s = bust ? cfg.bustHeight / (box.max.y - cut) : (cfg.height || 1.24) / height;
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      const rel = y => (y - cut) * s;                        // model-space y → height above the rim (world units)
      const neckY = bones.neck_0 ? bones.neck_0.y : box.max.y - 0.3;
      const headH = (box.max.y - neckY) * (cfg.headHit || 1.35) * s;
      const shoulderW = (size.x) * s * 0.55;
      M.template = {
        root, scale: s, offset: new T.Vector3(-cx * s, -cut * s, -cz * s), fit: bust ? 'bust' : 'stand',
        heightWorld: height * s, sourceHeight: height, sourceBox: { min: box.min.toArray(), max: box.max.toArray() },
        hit: {                                               // hit-box centre / size in the agent's local space
          head: { y: rel((box.max.y + neckY) / 2), h: headH, w: headH * 0.85 },
          body: { y: rel((cut + neckY) / 2 + (bust ? 0 : (box.min.y - cut) / 2)), h: (neckY - Math.max(cut, box.min.y)) * s, w: Math.max(0.3, Math.min(0.95, shoulderW)) }
        }
      };
      M.stats = { ...tex, bones: Object.keys(bones).length, ms: Math.round(performance.now() - t0) };
      M.state = 'ready';
      console.info('[model3d] enemy ready', M.stats, 'height', height.toFixed(3), '→', (height * s).toFixed(3), 'fit', M.template.fit);
      BW.emit('model3d', M);
      return M.template;
    } catch (e) {
      M.state = 'failed'; M.error = String(e && e.message || e);
      console.warn('[model3d] enemy model unavailable, using the sprite fallback →', M.error);
      BW.emit('model3d', M);
      return null;
    }
  };

  // a fresh, independently animated instance (shares geometry + textures).
  // `clip` = world-space THREE.Plane keeping only what is ABOVE the hole's rim, so a rising / retreating / cropped
  // figure never pokes into the wall or into the hole below it.
  M.spawn = function (clip) {
    if (M.state !== 'ready') return null;
    const t = M.template, inst = SU.clone(t.root), wrap = new T.Group(), pivot = new T.Group();
    inst.traverse(o => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(x => x.clone()) : o.material.clone();   // per-hole material → per-hole clip plane
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => { if (clip) x.clippingPlanes = [clip]; });
    });
    inst.position.copy(t.offset).divideScalar(t.scale);     // offset is in world units → into the pre-scale space
    pivot.scale.setScalar(t.scale); pivot.add(inst); wrap.add(pivot);
    wrap.visible = false;
    return { group: wrap, pivot, inst };
  };
})();
