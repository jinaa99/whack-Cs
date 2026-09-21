/* ==========================================================
   BREACH & WHACK — ASSET MANIFEST
   Add your own transparent PNG/WebP files here. Anything left
   empty falls back to the procedural placeholder, and nothing
   is fetched unless it is listed, so there are no broken links.
   See assets/README.md for the file layout.
   ========================================================== */
window.BW = window.BW || {};
window.BW.ASSETS = {
  // weapons: { weaponId: { default: 'assets/weapons/rifle/viper47.webp', nightops: '…', fire: '…', reload: '…' } }
  weapons: {},
  // hands: { back: 'assets/hands/hands-back.webp', front: 'assets/hands/hands-front.webp', combined: '…' }
  hands: {},
  // agents: { recon: 'assets/agents/recon.webp' }   (enemy look for that agent)
  agents: {},
  // hostage: 'assets/agents/hostage.webp'
  hostage: null,
  // 3D models (GLB). Loaded once at start-up; if loading fails the procedural sprite is used instead.
  models: {
    // The enemy character. Textures are embedded in the GLB (models/agent/textures/ is an unused duplicate).
    // enemy.glb = the original Professionalmiami.glb with textures re-sized (38 MB → 15 MB). The original stays in models/agent/source/.
    // `script` is the same file as base64 so the model also loads when index.html is opened directly (file://).
    enemy: {
      url: 'models/agent/enemy.glb',
      script: 'models/agent/enemy.glb.js',
      fit: 'stand',          // 'stand' = whole figure, feet on the cavity floor · 'bust' = larger, cropped at the waist
      height: 1.24,          // 'stand': world height of the figure (target opening is 1.3 tall)
      bustHeight: 1.22,      // 'bust' : visible height above the rim
      bustCut: 1.12,         // 'bust' : model height (m) that sits on the rim (≈ pelvis)
      textureSize: 1024,     // colour maps are down-scaled to this (normal / ORM maps to half) → ~40 MB GPU instead of ~500 MB
      armDrop: 1.3,          // radians: the T-pose arms are lowered by this much (0 = leave the T-pose)
      headHit: 1.35,         // head hit-box vs. the visible head (1 = exact)
      facing: 0.28           // max random yaw (radians) so enemies don't all stare straight ahead
    }
  }
};
