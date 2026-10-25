import { mkdir, copyFile } from 'node:fs/promises';
const files = ['build/three.module.js', 'build/three.core.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'LICENSE'];
for (const file of files) {
  const destination = `web/vendor/three/${file}`;
  await mkdir(destination.slice(0, destination.lastIndexOf('/')), { recursive: true });
  await copyFile(`node_modules/three/${file}`, destination);
}
console.log('Vendored Three.js runtime and MIT license for offline viewing.');
