# vendor/

- `three.min.js` — Three.js r149 (MIT), classic UMD build.
- `gltf-loader.bundle.js` — the official `GLTFLoader` + `SkeletonUtils` from three@0.149.0/examples/jsm, bundled by
  esbuild into a classic script (they read the global `THREE`). Rebuild: create an entry that imports both, then
  `esbuild entry.js --bundle --format=iife --minify --alias:three=<shim that re-exports window.THREE>`.
  It is a classic script on purpose so it also works from file://.
