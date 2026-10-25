import * as THREE from 'three';
import { downloadModel } from './model-download.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assemblyPartState } from './assembly-motion.js';
import { nodeMotion, assemblyMotion } from './motion-player.js';

function failure(stage, message, cause) {
  return Object.assign(new Error(message, { cause }), { stage });
}

export async function createViewer(host, demo, state, onStatus = () => {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#eaece4');
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 30);
  const detailCamera = new THREE.PerspectiveCamera(38, 1, .001, 30);
  onStatus('Starting browser 3D rendering…');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    // Some remote desktops and low-power adapters cannot provide an antialiased context.
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    } catch (error) {
      throw failure('webgl', 'Chrome could not create a WebGL 2 context. Check graphics acceleration in Chrome settings, restart Chrome, and reload. The original manual remains available below.', error);
    }
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = .22;
  controls.maxDistance = 3;
  controls.minPolarAngle = .05;
  controls.maxPolarAngle = Math.PI - .05;
  const resetCamera = () => {
    controls.minDistance = .22; controls.maxDistance = 3;
    camera.position.fromArray(demo.camera?.position ?? [1.1, 1.0, 1.15]);
    controls.target.fromArray(demo.camera?.target ?? [0, .26, 0]);
    controls.update();
  };
  resetCamera();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9578, 1.2));
  const light = new THREE.DirectionalLight(0xfff5e2, 1.8);
  light.position.set(2, 4, 2);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.left = light.shadow.camera.bottom = -1;
  light.shadow.camera.right = light.shadow.camera.top = 1;
  scene.add(light);
  const inspectionMaterial = new THREE.MeshStandardMaterial({ color: '#bec6ca', roughness: .65, metalness: 0, side: THREE.DoubleSide });
  const inspectionLight = new THREE.DirectionalLight(0xffffff, 2);
  inspectionLight.position.set(-2, 2, 2); inspectionLight.visible = false;
  scene.add(inspectionLight);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#eaece4', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.003;
  floor.receiveShadow = true;
  scene.add(floor);

  let gltf;
  try {
    onStatus(`Downloading the source model (${demo.model_size_label ?? '3.2 MB'})…`);
    let buffer;
    try {
      if (demo.chunk_url) {
        buffer = await downloadModel(demo, onStatus);
      } else if (demo.chunk_bytes && demo.model_bytes) {
        const bytes = new Uint8Array(demo.model_bytes);
        const deadline = performance.now() + 300000;
        let cache;
        try { cache = await globalThis.caches?.open('assembly-model-chunks-v1'); } catch { /* Private browsing may disallow caching. */ }
        for (let start = 0; start < bytes.length; start += demo.chunk_bytes) {
          const end = Math.min(bytes.length-1, start+demo.chunk_bytes-1);
          const key = new URL(demo.model_url, location.href);
          key.searchParams.set('part', `${start}-${end}`);
          let saved;
          try { saved = await cache?.match(key.href); } catch { /* Network remains available. */ }
          if (saved) {
            const chunk = new Uint8Array(await saved.arrayBuffer());
            if (chunk.length === end-start+1) {
              bytes.set(chunk, start);
              onStatus(`Restoring downloaded model: ${((end+1)/1000000).toFixed(1)} MB / ${demo.model_size_label}…`);
              continue;
            }
          }
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const remaining = deadline-performance.now();
              if (remaining <= 0) throw new Error('The model download exceeded five minutes');
              onStatus(`${attempt ? 'Retrying' : 'Downloading'} source model: ${(start/1000000).toFixed(1)} MB / ${demo.model_size_label}…`);
              // A unique URL prevents a forwarding proxy reusing a stalled range.
              const address = new URL(key.href);
              address.searchParams.set('_request', `${Date.now()}-${attempt}`);
              const response = await fetch(address, { cache: 'no-store', headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(Math.max(1, Math.floor(Math.min(30000, remaining)))) });
              if (response.status !== 206 || response.headers.get('Content-Range') !== `bytes ${start}-${end}/${bytes.length}`) {
                await response.body?.cancel();
                throw new Error('The forwarded address returned an incomplete model range');
              }
              const chunk = new Uint8Array(end-start+1);
              let received = 0;
              if (response.body) {
                const reader = response.body.getReader();
                while (true) {
                  const next = await reader.read();
                  if (next.done) break;
                  if (received + next.value.length > chunk.length) { await reader.cancel(); throw new Error('The model chunk is larger than requested'); }
                  chunk.set(next.value, received); received += next.value.length;
                  onStatus(`Downloading source model: ${((start+received)/1000000).toFixed(2)} MB / ${demo.model_size_label}…`);
                }
              } else {
                const value = new Uint8Array(await response.arrayBuffer());
                received = value.length;
                if (received === chunk.length) chunk.set(value);
              }
              if (received !== chunk.length) throw new Error('The model chunk was truncated');
              bytes.set(chunk, start);
              // CacheStorage cannot save HTTP 206 responses; store validated bytes.
              try { await cache?.put(key.href, new Response(chunk, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch { /* Quota errors must not prevent playback. */ }
              break;
            } catch (error) {
              if (attempt === 1 || performance.now() >= deadline) throw error;
            }
          }
        }
        buffer = bytes.buffer;
      } else {
      const response = await fetch(demo.model_url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (response.body) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > 64 * 1024 * 1024) {
            await reader.cancel();
            throw new Error('The model exceeds the 64 MB preview limit');
          }
          chunks.push(value);
          onStatus(`Downloading source model: ${(received / 1000000).toFixed(1)} MB / ${demo.model_size_label ?? '3.2 MB'}…`);
        }
        const bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        buffer = bytes.buffer;
      } else {
        buffer = await response.arrayBuffer();
      }
      }
      const signature = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4)));
      if (signature !== 'glTF') throw new Error('The forwarded address returned a page instead of a GLB model');
    } catch (error) {
      const detail = ['TimeoutError', 'AbortError'].includes(error.name) ? (demo.chunk_bytes ? 'A model chunk timed out after retry' : 'The remote download did not finish within two minutes') : error.message;
      throw failure('download', `The model download failed: ${detail}. Refresh the forwarded address and try again.`, error);
    }
    onStatus('Decoding source geometry and materials…');
    let timeout;
    try {
      gltf = await Promise.race([
        new GLTFLoader().parseAsync(buffer, ''),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Model decoding timed out after 30 seconds')), 30000); }),
      ]);
    } catch (error) {
      throw failure('decode', `Chrome could not decode the model: ${error.message}. Try reloading the page.`, error);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
  const pivot = new THREE.Group();
  pivot.add(gltf.scene);
  scene.add(pivot);
  gltf.scene.updateMatrixWorld(true);
  const sourceBounds = new THREE.Box3().setFromObject(gltf.scene);
  const modelSpan = sourceBounds.getSize(new THREE.Vector3());
  const center = sourceBounds.getCenter(new THREE.Vector3());
  gltf.scene.position.sub(center);
  pivot.rotation.z = Math.PI;
  pivot.updateMatrixWorld(true);
  pivot.position.y -= new THREE.Box3().setFromObject(pivot).min.y;
  const parts = await Promise.all(demo.reference.parts.map(async part => {
    const object = await gltf.parser.getDependency('node', part.node_index);
    const materials = [];
    const meshes = [];
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = true;
      const clone = material => {
        const m = material.clone();
        materials.push({ material: m, emissive: m.emissive?.clone(), intensity: m.emissiveIntensity });
        return m;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
      meshes.push({ mesh, material: mesh.material });
    });
    return { ...part, object, position: object.position.clone(), quaternion: object.quaternion.clone(), materials, meshes };
  }));
  const axis = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const assemblySpin = new THREE.Quaternion();
  const assemblyPivot = new THREE.Vector3();

  const renderScene = () => {
    const snapshot = state();
    const { stage, progress, assembled, corner, planStep = 0, inspectNode = null } = snapshot;
    const plan = inspectNode === null ? snapshot.plan : null;
    scene.overrideMaterial = inspectNode !== null ? inspectionMaterial : null;
    inspectionLight.visible = inspectNode !== null || Boolean(plan && parts.some(part => part.category === 'hardware' && plan.steps[planStep]?.visible_node_ids.includes(part.node_index)));
    // Inspect the finished source model upright; demonstrate the connection upside down.
    pivot.rotation.z = plan || assembled || stage === 'review' ? 0 : Math.PI;
    if (plan && snapshot.presentationRotationDeg) {
      pivot.rotation.set(...snapshot.presentationRotationDeg.map(THREE.MathUtils.degToRad), 'XYZ');
    } else {
      pivot.rotation.x = pivot.rotation.y = 0;
    }
    floor.visible = !plan && inspectNode === null; // Presentation floor must not hide underside assembly actions.
    const groupPose = plan ? assemblyMotion(plan, planStep, progress) : null;
    if (groupPose) {
      assemblyPivot.fromArray(plan.assembly_pivot_m || [0, 0, 0]);
      euler.set(...groupPose.rotationDeg.map(THREE.MathUtils.degToRad), 'XYZ');
      assemblySpin.setFromEuler(euler);
    }
    for (const part of parts) {
      // Match the neutral source-part inspector, including after a track finishes.
      // Restore original materials when leaving animation; geometry stays untouched.
      for (const entry of part.meshes) entry.mesh.material = plan && (part.category === 'hardware' || snapshot.neutralParts) ? inspectionMaterial : entry.material;
      const partCorner = demo.connections.findIndex(connection => [connection.connector_node, connection.leg_node].includes(part.node_index));
      const pose = inspectNode !== null ? { visible: part.node_index === inspectNode, highlight: false, offsetY: 0, angleY: 0 } : plan ? nodeMotion(plan, planStep, part.node_index, progress) : assemblyPartState(part.category, partCorner, corner, stage, progress, assembled);
      part.object.visible = pose.visible;
      part.object.position.copy(part.position);
      if (plan) {
        part.object.position.x += pose.offset[0];
        part.object.position.y += pose.offset[1];
        part.object.position.z += pose.offset[2];
        euler.set(...pose.rotationDeg.map(THREE.MathUtils.degToRad), 'XYZ');
        spin.setFromEuler(euler);
      } else {
        part.object.position.y += pose.offsetY;
        spin.setFromAxisAngle(axis, pose.angleY);
      }
      part.object.quaternion.copy(part.quaternion).premultiply(spin);
      if (groupPose) {
        part.object.position.sub(assemblyPivot).applyQuaternion(assemblySpin).add(assemblyPivot);
        part.object.position.x += groupPose.offset[0];
        part.object.position.y += groupPose.offset[1];
        part.object.position.z += groupPose.offset[2];
        part.object.quaternion.premultiply(assemblySpin);
      }
      const highlight = pose.highlight;
      for (const entry of part.materials) {
        if (!entry.emissive) continue;
        entry.material.emissive.copy(highlight ? new THREE.Color('#d5a54d') : entry.emissive);
        entry.material.emissiveIntensity = highlight ? .45 : entry.intensity;
      }
    }
    pivot.updateMatrixWorld(true);
  };
  function frameAssembly() {
    renderScene();
    const bounds = new THREE.Box3();
    for (const part of parts) if (part.object.visible) bounds.union(new THREE.Box3().setFromObject(part.object));
    if (bounds.isEmpty()) return;
    const target = bounds.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(1, .4, 1).normalize();
    const distance = Math.max(.6, bounds.getSize(new THREE.Vector3()).length() * 1.7);
    controls.minDistance = .035; controls.maxDistance = Math.max(3, distance * 1.5);
    controls.target.copy(target); camera.position.copy(target).addScaledVector(direction, distance);
    controls.update();
  }
  function focusPlanStep(closeupNodes = null) {
    const { plan, planStep = 0 } = state();
    const step = plan?.steps[planStep];
    if (!step) return;
    if (!step.tracks.length) {
      if (step.assembly_keyframes?.length) resetCamera();
      return;
    }
    controls.minDistance = .22;
    renderScene();
    const moving = new Set(closeupNodes || step.tracks.map(track => track.node_index));
    const bounds = new THREE.Box3();
    for (const part of parts) if (moving.has(part.node_index)) bounds.union(new THREE.Box3().setFromObject(part.object));
    if (bounds.isEmpty()) return;
    const movingCenter = bounds.getCenter(new THREE.Vector3());
    const framingBounds = bounds.clone();
    if (!closeupNodes) for (const part of parts) if (part.object.visible) framingBounds.union(new THREE.Box3().setFromObject(part.object));
    const target = framingBounds.getCenter(new THREE.Vector3());
    const bodyCenter = pivot.getWorldPosition(new THREE.Vector3());
    const delta = movingCenter.clone().sub(bodyCenter);
    const ratios = delta.toArray().map((v, i) => Math.abs(v) / Math.max(modelSpan.getComponent(i), .01));
    const axisIndex = ratios.indexOf(Math.max(...ratios));
    const direction = new THREE.Vector3(.2, .35, .25);
    direction.setComponent(axisIndex, Math.sign(delta.getComponent(axisIndex)) || 1);
    // An internal fitting can sit at the back yet approach from the open front.
    // Choose its approach side in world space rather than the closest outside face.
    const approach = new THREE.Vector3();
    for (const track of step.tracks) {
      const part = parts.find(part => part.node_index === track.node_index);
      if (!part || part.category !== 'hardware' || !moving.has(part.node_index)) continue;
      const start = track.keyframes?.length ? track.keyframes[0].offset_m : track.from_offset_m;
      const end = track.keyframes?.length ? track.keyframes.at(-1).offset_m : track.to_offset_m;
      const travel = new THREE.Vector3().fromArray(start).sub(new THREE.Vector3().fromArray(end));
      const groupPose = assemblyMotion(plan, planStep, state().progress);
      travel.applyEuler(new THREE.Euler(...groupPose.rotationDeg.map(THREE.MathUtils.degToRad), 'XYZ'));
      if (travel.lengthSq() > 1e-10) approach.add(travel.transformDirection(part.object.parent.matrixWorld));
    }
    if (approach.lengthSq() > 1e-10) direction.copy(approach.normalize()).add(new THREE.Vector3(0, .18, .12));
    controls.minDistance = closeupNodes ? .035 : .22;
    const distance = Math.max(closeupNodes ? .12 : .55, framingBounds.getSize(new THREE.Vector3()).length() * 1.7);
    controls.maxDistance = Math.max(3, distance * 1.5);
    controls.target.copy(target);
    camera.position.copy(target).add(direction.normalize().multiplyScalar(distance));
    controls.update();
  }
  function focusPart(nodeIndex) {
    const part = parts.find(part => part.node_index === nodeIndex);
    if (!part) return;
    renderScene();
    const bounds = new THREE.Box3().setFromObject(part.object);
    const point = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length();
    const distance = Math.max(.04, size * 1.8);
    controls.minDistance = Math.max(.005, size * .12);
    controls.maxDistance = Math.max(.5, distance * 4);
    controls.target.copy(point);
    camera.position.copy(point).add(new THREE.Vector3(-1, .4, .5).normalize().multiplyScalar(distance));
    controls.update();
  }
  function focusConnection() {
    const selected = demo.connections[state().corner ?? 0];
    const part = parts.find(p => p.node_index === selected.connector_node);
    renderScene();
    const point = part.object.getWorldPosition(new THREE.Vector3());
    controls.target.copy(point);
    camera.position.copy(point).add(new THREE.Vector3(.33, .33, .4));
    controls.update();
  }
  let detailBand = 0, renderedWidth = 0, renderedHeight = 0;
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    detailBand = demo.detail_layout === 'below' && host.classList.contains('has-part-detail') ? parseFloat(getComputedStyle(host).getPropertyValue('--assembly-detail-height')) || 240 : 0;
    renderedWidth = width; renderedHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height-detailBand);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  window.addEventListener('resize', resize);
  resize();
  host.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(event.key)) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') offset.applyAxisAngle(axis, event.key === 'ArrowLeft' ? .12 : -.12);
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') offset.y = Math.max(.05, offset.y + (event.key === 'ArrowUp' ? .12 : -.12));
    if (event.key === '+' && offset.length() > .25) offset.multiplyScalar(.9);
    if (event.key === '-' && offset.length() < 2.7) offset.multiplyScalar(1.1);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  });
  renderScene();
  renderer.setAnimationLoop(() => {
    renderScene();
    controls.update();
    if (renderedWidth !== host.clientWidth || renderedHeight !== host.clientHeight) resize();
    renderer.setViewport(0, detailBand, host.clientWidth, host.clientHeight-detailBand);
    renderer.render(scene, camera);
    const snapshot = state();
    const detailPart = snapshot.inspectNode == null && snapshot.plan && parts.find(part => part.node_index === snapshot.detailNode && part.object.visible);
    if (detailPart) {
      // Render the SAME moving meshes a second time, keeping the cabinet context.
      // No duplicate model, replacement part, scale change, or isolated source pose.
      const bounds = new THREE.Box3().setFromObject(detailPart.object);
      const target = bounds.getCenter(new THREE.Vector3());
      const track = snapshot.plan.steps[snapshot.planStep || 0].tracks.find(track => track.node_index === detailPart.node_index);
      const start = track?.keyframes?.[0]?.offset_m || track?.from_offset_m || [0, 0, 0];
      const end = track?.keyframes?.at(-1)?.offset_m || track?.to_offset_m || [0, 0, 0];
      const direction = snapshot.detailDirection ? new THREE.Vector3().fromArray(snapshot.detailDirection) : new THREE.Vector3().fromArray(start).sub(new THREE.Vector3().fromArray(end));
      const group = assemblyMotion(snapshot.plan, snapshot.planStep || 0, snapshot.progress);
      direction.applyEuler(new THREE.Euler(...group.rotationDeg.map(THREE.MathUtils.degToRad), 'XYZ'));
      if (direction.lengthSq() < 1e-10) direction.set(1, 0, 0);
      direction.transformDirection(detailPart.object.parent.matrixWorld).add(new THREE.Vector3(0, .16, .12)).normalize();
      detailCamera.position.copy(target).addScaledVector(direction, Math.max(.075, bounds.getSize(new THREE.Vector3()).length() * 2.5));
      detailCamera.up.copy(camera.up);
      detailCamera.lookAt(target);
      const panel = demo.detail_layout === 'floating' ? host.querySelector('#product-detail-region') : null;
      const width = panel ? panel.clientWidth : detailBand ? host.clientWidth : Math.round(host.clientWidth * .44);
      const height = panel ? panel.clientHeight-30 : detailBand ? detailBand-32 : Math.round(host.clientHeight * .43);
      const left = panel ? panel.offsetLeft+panel.clientLeft : detailBand ? 0 : host.clientWidth-width-10;
      const bottom = panel ? host.clientHeight-panel.offsetTop-panel.clientTop-panel.clientHeight : detailBand ? 0 : 10;
      detailCamera.aspect = width / height; detailCamera.updateProjectionMatrix();
      renderer.setScissorTest(true);
      renderer.setScissor(left, bottom, width, height);
      renderer.setViewport(left, bottom, width, height);
      renderer.clearDepth();
      renderer.render(scene, detailCamera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, host.clientWidth, host.clientHeight);
    }
  });
  const inspectTransforms = () => parts.map(part => ({ node_index: part.node_index, visible: part.object.visible,
    position: part.object.position.toArray(), quaternion: part.object.quaternion.toArray() }));
  return { resetCamera, frameAssembly, renderScene, focusConnection, focusPlanStep, focusPart, inspectTransforms, inspectCamera: () => ({ position: camera.position.toArray(), target: controls.target.toArray() }) };
}
