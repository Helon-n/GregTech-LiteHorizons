# pinyin-pro 3.29.5

Vendored without changes from the npm package's `dist/esm/` directory.
The MIT license is retained in `LICENSE`. Runtime imports are local; no CDN,
network service or extra installation is needed by the game.

- Upstream: https://github.com/zh-lx/pinyin-pro
- Package: https://registry.npmjs.org/pinyin-pro/-/pinyin-pro-3.29.5.tgz
- Tarball SHA-256: `00e9d2961bb0ba2d247ba5090c242ecbf3793473c9f66f0c69af7248dd4616b4`
- npm integrity: `sha512-Fk5YoRmtdHqJWqAuzYVG/NzvzeCbaG+ZEwbY6Nbps3QAIrvQQEtcm49frcyCM8i2b5najnzPDtYqrHRYTTiuwQ==`

`src/core/search.js` provides the game's query normalization and bounded cache;
vendor modules retain upstream contextual pronunciation for polyphonic words.
