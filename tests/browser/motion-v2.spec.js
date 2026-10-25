import { test, expect } from '@playwright/test';

test('v2 renderer preserves partial poses and rotates a rigid group without changing distances', async ({ page, request }) => {
  const fixture = await (await request.get('/api/animation/fixture?version=2')).json();
  await page.goto('/eket-steps');
  await page.addScriptTag({ type: 'importmap', content: JSON.stringify({ imports: { three: '/vendor/three/build/three.module.js', 'three/addons/': '/vendor/three/examples/jsm/' } }) });
  const result = await page.evaluate(async plan => {
    const { createViewer } = await import('/viewer.js');
    const reference = await (await fetch('/assets/eket/reference.json')).json();
    const host = document.createElement('div'); host.style.cssText = 'width:800px;height:510px'; document.body.prepend(host);
    const state = { stage: 'review', assembled: true, progress: 1, plan, planStep: 0 };
    const viewer = await createViewer(host, { model_url: '/assets/eket/model.glb', reference, connections: [] }, () => state);
    const snap = (step, progress) => { state.planStep = step; state.progress = progress; viewer.renderScene(); return viewer.inspectTransforms(); };
    viewer.focusPlanStep(); const camera = viewer.inspectCamera();
    return { camera, partial: snap(0,1), retained: snap(1,0), assembled: snap(1,1), rotated: snap(2,1), held: snap(3,0), backward: snap(2,0) };
  }, fixture.plan);
  expect(result.camera.position[0]).toBeLessThan(result.camera.target[0]);
  const part = (snapshot, id) => snapshot.find(node => node.node_index === id);
  expect(part(result.partial,4).position).toEqual(part(result.retained,4).position);
  expect(part(result.partial,4).position).not.toEqual(part(result.assembled,4).position);
  expect(result.rotated).toEqual(result.held);
  expect(result.backward).toEqual(result.assembled);
  const difference = snapshot => part(snapshot,2).position.map((v,i) => v-part(snapshot,3).position[i]);
  const a = difference(result.assembled), b = difference(result.rotated);
  expect(Math.hypot(...a)).toBeCloseTo(Math.hypot(...b), 8);
  expect(b[0]).toBeCloseTo(-a[1],8);
  expect(b[1]).toBeCloseTo(a[0],8);
  expect(b[2]).toBeCloseTo(a[2],8);
});

test('cabinet viewer loads through one bundle without source-module downloads', async ({ page }) => {
  const moduleRequests = [];
  page.on('request', request => {
    if (/\/(vendor\/three|viewer\.js|motion-player\.js|assembly-motion\.js)/.test(new URL(request.url()).pathname)) moduleRequests.push(request.url());
  });
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 30000 });
  await expect(page.locator('#viewer canvas')).toBeVisible();
  expect(moduleRequests).toEqual([]);
});
