import { test, expect } from '@playwright/test';

test('source model loads offline and the connection preview works', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:8011/') ? route.continue() : route.abort());
  await page.goto('/lack-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden();
  await expect(page.locator('#viewer canvas')).toBeVisible();
  await expect(page.locator('#reference-inventory tr')).toHaveCount(3);
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#auto-advance').uncheck();
  await page.getByRole('button', { name: 'Next step →' }).click();
  await expect(page.locator('#step-title')).toHaveText('Insert connector 1');
  await page.locator('#play').click();
  await expect(page.locator('#play')).toContainText('Pause');
  await expect.poll(() => page.locator('#scrub').inputValue()).not.toBe('0');
  await page.locator('#play').click();
  const paused = await page.locator('#scrub').inputValue();
  await page.waitForTimeout(150);
  expect(await page.locator('#scrub').inputValue()).toBe(paused);
  await page.locator('#scrub').fill('1000');
  await expect(page.locator('#play-state')).toHaveText('Stage animation complete');
  await page.locator('#focus-connection').click();
  await page.locator('.workspace').screenshot({ path: 'test-results/lack-connector-desktop.png' });
  await page.getByRole('button', { name: 'Next step →' }).click();
  await expect(page.locator('#step-title')).toHaveText('Attach leg 1');
  await page.locator('#scrub').fill('1000');
  await page.locator('.workspace').screenshot({ path: 'test-results/lack-leg-desktop.png' });
  await page.locator('#inspect-model').click();
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#inspect-model')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.workspace').screenshot({ path: 'test-results/lack-assembled-desktop.png' });
  await page.locator('#inspect-model').click();
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#complete').click();
  await expect(page.locator('#progress-text')).toHaveText('1 of 10 preview stages completed');
  await page.reload();
  await expect(page.locator('#progress-text')).toHaveText('1 of 10 preview stages completed');
  expect(errors).toEqual([]);
});

test('phone layout has no horizontal overflow and manual screen remains available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lack-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/lack-mobile.png', fullPage: true });
  await page.locator('#manual-tab').click();
  await expect(page.locator('#upload-form')).toBeVisible();
  await expect(page.locator('#api-status')).not.toHaveText('Checking API configuration…');
});

test('WebGL-disabled Chrome shows a manual fallback and reports the specific failure', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (String(type).startsWith('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  const diagnostic = page.waitForRequest(request => request.url().endsWith('/api/viewer-diagnostics') && request.method() === 'POST');
  await page.goto('/lack-lab.html');
  await expect(page.locator('#viewer-error')).toContainText('WebGL 2 context');
  await expect(page.locator('.viewer-fallback')).toBeVisible();
  expect((await diagnostic).postDataJSON().stage).toBe('webgl');
  await page.locator('#next').click();
  await expect(page.locator('#play')).toBeDisabled();
  await page.locator('#manual-tab').click();
  await expect(page.locator('#upload-form')).toBeVisible();
});

test('a forwarded HTML response instead of model bytes is reported accurately', async ({ page }) => {
  await page.route('**/assets/lack/model.glb', route => route.fulfill({ contentType: 'text/html', body: '<html>Sign in</html>' }));
  await page.goto('/lack-lab.html');
  await expect(page.locator('#viewer-error')).toContainText('page instead of a GLB model');
  await expect(page.locator('#viewer canvas')).toHaveCount(0);
  await expect(page.locator('.viewer-fallback')).toBeVisible();
});

test('play advances through all four legs and stops at the final review', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/lack-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden();
  await page.locator('#play').click();
  await expect(page.locator('#step-title')).toHaveText('Insert connector 1');
  await expect(page.locator('#step-title')).toHaveText('Attach leg 1', { timeout: 8000 });
  for (let leg = 2; leg <= 4; leg++) {
    await expect(page.locator('#step-title')).toHaveText(`Insert connector ${leg}`, { timeout: 8000 });
    await expect(page.locator('#step-title')).toHaveText(`Attach leg ${leg}`, { timeout: 8000 });
  }
  await expect(page.locator('#step-title')).toHaveText('Review the assembled model', { timeout: 8000 });
  await expect(page.locator('#next')).toBeDisabled();
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#progress-text')).toHaveText('9 of 10 preview stages completed');
  await page.locator('#complete').click();
  await expect(page.locator('#progress-text')).toHaveText('10 of 10 preview stages completed');
  await page.locator('.workspace').screenshot({ path: 'test-results/lack-four-legs-complete.png' });
});

test('EKET is selectable and loads its original cabinet model', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/lack-lab.html');
  await page.getByRole('link', { name: 'EKET cabinet →' }).click();
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('#viewer canvas')).toBeVisible();
  await expect(page.locator('#component-count')).toHaveText('5 panels · 16 hardware components');
  await expect(page.getByRole('heading', { name: 'EKET small cabinet' })).toBeVisible();
  await page.locator('.workspace').screenshot({ path: 'test-results/eket-cabinet.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: 'Open original manual ↗' })).toHaveAttribute('href', '/assets/eket/manual.pdf');
  await page.getByRole('link', { name: 'LACK side table' }).click();
  await expect(page.locator('#step-title')).toHaveText('Identify the parts');
  expect(errors).toEqual([]);
});

test('EKET reports a failed download and offers retry', async ({ page }) => {
  await page.route('**/assets/eket/model.glb', route => route.abort('connectionreset'));
  const diagnostic = page.waitForRequest(request => request.url().endsWith('/api/viewer-diagnostics') && request.method() === 'POST');
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toContainText('model download failed');
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
  expect((await diagnostic).postDataJSON().stage).toBe('download');
  await expect(page.getByRole('link', { name: 'Open original manual ↗' })).toBeVisible();
});

test('generic player previews explicit fixture JSON with pause, scrub, and rotation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 20000 });
  await page.locator('#load-fixture').click();
  await expect(page.locator('#draft-origin')).toContainText('HAND-AUTHORED PLAYER FIXTURE');
  await expect(page.locator('#plan-play')).toBeDisabled();
  await page.locator('#preview-plan').click();
  await expect(page.locator('#plan-play')).toBeEnabled();
  const before = await page.locator('#viewer').screenshot();
  await page.locator('#plan-play').click();
  await expect.poll(() => page.locator('#plan-scrub').inputValue()).not.toBe('0');
  await page.locator('#plan-play').click();
  const paused = await page.locator('#plan-scrub').inputValue();
  await page.waitForTimeout(150);
  expect(await page.locator('#plan-scrub').inputValue()).toBe(paused);
  await page.locator('#plan-scrub').fill('1000');
  await expect(page.locator('#player-status')).toContainText('playback finished');
  const after = await page.locator('#viewer').screenshot();
  expect(before.equals(after)).toBe(false);
  const bounds = await page.locator('#viewer').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2, { steps: 10 }); await page.mouse.up();
  expect(after.equals(await page.locator('#viewer').screenshot())).toBe(false);
  await page.locator('#plan-assembled').click();
  await expect(page.locator('#plan-play')).toBeDisabled();
  await page.locator('#generation-page').fill('9'); await page.locator('#generation-page').dispatchEvent('change');
  await expect(page.locator('#selected-page-number')).toHaveText('9');
  expect(errors).toEqual([]);
});

test('generation is explicitly previewed and editing changes provenance', async ({ page, request }) => {
  const fixture = await (await request.get('/api/animation/fixture')).json();
  const mocked = { ...fixture, origin: 'deepseek', model: 'mocked-provider-test-only', human_edits: [], reason: 'Mocked response: no live AI call' };
  await page.route('**/api/health*', route => route.fulfill({ json: { deepseek_configured: true, model: 'mocked-provider-test-only' } }));
  await page.route('**/api/animation/generate', route => {
    expect(route.request().postDataJSON().source_page).toBe(9);
    return route.fulfill({ json: mocked });
  });
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 20000 });
  await page.locator('#generation-page').fill('9');
  await page.locator('#generate-plan').click();
  await expect(page.locator('#draft-origin')).toContainText('AI-GENERATED DRAFT');
  await expect(page.locator('#plan-play')).toBeDisabled();
  await page.locator('#preview-plan').click();
  await expect(page.locator('#active-plan-origin')).toContainText('AI-GENERATED DRAFT');
  await page.getByText('Inspect or edit the reusable motion JSON', { exact: true }).click();
  const edited = mocked.plan;
  edited.steps[0].title = 'User-edited mechanical test';
  await page.locator('#plan-json').fill(JSON.stringify(edited));
  await page.locator('#validate-plan').click();
  await expect(page.locator('#active-plan-origin')).toContainText('IMPORTED JSON');
  await expect(page.locator('#active-step-title')).toHaveText('User-edited mechanical test');
});

test('saved live AI candidate plays without another provider request', async ({ page }) => {
  test.skip(!process.env.ASSEMBLY_LIVE_QA, 'Optional check against locally preserved real-provider output');
  let generationCalls = 0;
  await page.route('**/api/animation/generate', route => { generationCalls++; return route.abort(); });
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 20000 });
  await page.locator('#load-saved-plan').click();
  await expect(page.locator('#draft-origin')).toContainText('AI-GENERATED DRAFT');
  await page.locator('#preview-plan').click();
  await expect(page.locator('#active-plan-origin')).toContainText('AI-GENERATED DRAFT');
  await page.locator('.workspace').screenshot({ path: 'test-results/real-ai-step-start.png' });
  const initial = await page.locator('#viewer').screenshot();
  await page.locator('#plan-play').click();
  await expect.poll(() => page.locator('#plan-scrub').inputValue()).not.toBe('0');
  await page.locator('#plan-play').click();
  await page.locator('#plan-scrub').fill('1000');
  await expect(page.locator('#player-status')).toContainText('playback finished');
  expect(initial.equals(await page.locator('#viewer').screenshot())).toBe(false);
  await page.locator('.workspace').screenshot({ path: 'test-results/real-ai-step-end.png' });
  expect(generationCalls).toBe(0);
});

async function withoutBundledMetadata(page) {
  await page.route('**/eket-lab.html', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/<script id="eket-reference-data" type="application\/json">[\s\S]*?<\/script>/, '');
    await route.fulfill({ response, body });
  });
}

test('an empty metadata response is retried and the model still loads', async ({ page }) => {
  await withoutBundledMetadata(page);
  let requests = 0;
  await page.route('**/assets/eket/reference.json*', route => {
    requests++;
    return requests === 1 ? route.fulfill({ contentType: 'application/json', body: '' }) : route.continue();
  });
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('#viewer canvas')).toBeVisible();
  expect(requests).toBe(2);
});

test('persistent truncated metadata becomes an error instead of an endless loading message', async ({ page }) => {
  await withoutBundledMetadata(page);
  await page.route('**/assets/eket/reference.json*', route => route.fulfill({ contentType: 'application/json', body: '{"product":' }));
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toContainText('Incomplete or invalid JSON from /assets/eket/reference.json');
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
});

test('empty generation replies are never automatically retried', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/health*', route => route.fulfill({ json: { deepseek_configured: true, model: 'mocked-provider-test-only' } }));
  await page.route('**/api/animation/generate', route => { requests++; return route.fulfill({ contentType: 'application/json', body: '' }); });
  await page.goto('/eket-lab.html');
  await expect(page.locator('#generate-plan')).toBeEnabled();
  await page.locator('#generate-plan').click();
  await expect(page.locator('#generation-status')).toContainText('Empty response from /api/animation/generate');
  expect(requests).toBe(1);
});

test('preserved diagnostic sequence retains assembled nodes across navigation', async ({ page }) => {
  test.skip(process.env.ASSEMBLY_LIVE_QA !== '1', 'Requires preserved local candidates');
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 30000 });
  await page.locator('#load-saved-sequence').click();
  await expect(page.locator('#draft-origin')).toContainText('COMPOSED');
  await page.locator('#preview-plan').click();
  await expect(page.locator('#player-status')).toContainText('Step 1 of 2');
  await page.locator('#plan-next').click();
  await expect(page.locator('#player-status')).toContainText('Step 2 of 2');
  await expect(page.locator('#plan-next')).toBeDisabled();
  await page.locator('#plan-previous').click();
  await expect(page.locator('#player-status')).toContainText('Step 1 of 2');
});

test('a missing EKET entry script gives a retry instead of permanent loading', async ({ page }) => {
  await page.route('**/eket-lab.html', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/<script type="module" id="eket-entry">[\s\S]*?<\/script>/, '');
    await route.fulfill({ response, body });
  });
  await page.clock.install();
  await page.goto('/eket-lab.html');
  await page.clock.fastForward(26000);
  await expect(page.locator('#viewer-error')).toContainText('viewer script did not load');
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
});

test('LACK loads with entry, metadata and separate 3D module requests blocked', async ({page})=>{
  let bundleRequests=0;
  await page.route('**/*',route=>{
    const path=new URL(route.request().url()).pathname;
    if (path==='/viewer.bundle.js') bundleRequests++;
    if (['/app.js','/style.css','/api/demo','/viewer.js'].includes(path)||path.startsWith('/vendor/')) return route.abort();
    return route.continue();
  });
  await page.goto('/lack-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({timeout:30000});
  await expect(page.locator('#viewer canvas')).toBeVisible();
  await expect(page.locator('#reference-inventory tr')).toHaveCount(3);
  await expect(page.locator('#play')).toBeEnabled();
  await page.locator('#next').click();
  await expect(page.locator('#step-title')).toHaveText('Insert connector 1');
  await page.locator('#scrub').fill('1000');
  await expect(page.locator('#play-state')).toHaveText('Stage animation complete');
  expect(bundleRequests).toBe(1);
});

test('LACK bundle failure offers retry and original manual', async ({page})=>{
  await page.route('**/viewer.bundle.js*',route=>route.abort());
  await page.goto('/lack-lab.html');
  await expect(page.getByRole('button',{name:'Retry loading',exact:true})).toBeVisible();
  await expect(page.locator('.viewer-fallback')).toBeVisible();
  await expect(page.locator('#viewer-error a')).toHaveAttribute('href','/assets/lack/manual.pdf');
  await expect(page.locator('#play')).toBeDisabled();
});
