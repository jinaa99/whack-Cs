# Breach & Whack — asset drop-in folder

The game runs with **no external assets** (everything is drawn procedurally).
To use your own transparent PNG/WebP art, drop files here and list them in `assets.js`
(the manifest at the project root). Nothing is requested unless it is listed, so a
missing file can never cause a 404.

```
assets/weapons/<type>/<weapon>.webp          weapon (facing LEFT, muzzle on the left)
assets/weapons/<type>/<weapon>-<skin>.webp   skin variant
assets/weapons/<type>/<weapon>-fire.webp     optional firing frame
assets/weapons/<type>/<weapon>-reload.webp   optional reload frame
assets/hands/hands-back.webp   /  hands-front.webp     layered behind / in front of the weapon
assets/hands/hands-weapon.webp                          or a combined hands+weapon image
assets/agents/<agent>.webp     transparent character (any aspect, feet cropped)
```
Recommended sizes: weapons ~1024×512, agents ~512×560. Keep the muzzle/grip in the
same place across a weapon's frames so the recoil/muzzle-flash anchors stay correct.

## 3D models (GLB)

`assets.js → models.enemy` points at a `.glb`. It is loaded with the official `GLTFLoader`
(vendor/jsm, wired to the global THREE through an import map), down-scaled, T-pose arms lowered,
measured and cloned once per target hole. Needs http(s): `python3 -m http.server` in the project
folder. If loading fails the game keeps the procedural sprite enemies. Hostages always use the sprite.
Options: `fit` (`'stand'` | `'bust'`), `height`, `textureSize`, `armDrop`, `headHit`, `facing`.
