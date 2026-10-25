// Uses the installed webpack 5 toolchain; no runtime CDN or network downloads.
const webpack = require('webpack');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
webpack({
  mode: 'production', target: ['web', 'es2022'],
  entry: path.join(root, 'web/viewer.js'),
  output: { path: path.join(root, 'web/generated'), filename: 'viewer.bundle.js', library: { type: 'module' } },
  experiments: { outputModule: true },
  resolve: { alias: { 'three$': path.join(root, 'web/vendor/three/build/three.module.js'), 'three/addons': path.join(root, 'web/vendor/three/examples/jsm') } },
  performance: { hints: false }, devtool: false,
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({all:false,errors:true})); process.exitCode=1; return; }
  const file = path.join(root, 'web/generated/viewer.bundle.js');
  const data = fs.readFileSync(file); const zipped = zlib.gzipSync(data, {level:9});
  fs.writeFileSync(file + '.gz', zipped);
  console.log(`Viewer bundle: ${data.length} bytes; fixed-length gzip: ${zipped.length} bytes.`);
});
