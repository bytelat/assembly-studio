import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('all 11 steps navigate without saved-guide API calls and diagram steps cannot play', async ({ page, request }) => {
  const fixture = await (await request.get('/api/animation/fixture')).json();
  const motion = fixture.plan.steps[0];
  const guide = { ...fixture, origin: 'composed_manual_guide', human_edits: ['Mocked navigation test; no provider call'], plan: { ...fixture.plan,
    steps: Array.from({ length: 11 }, (_, index) => ({ ...motion, printed_step: index + 1, kind: index < 2 ? 'motion' : 'manual_reference',
      title: `Printed step ${index + 1}`, source_pages: [index < 2 ? 8 : 19], tracks: index < 2 ? motion.tracks : [] })) } };
  await page.route('**/eket-lab.html', async route => {
    const response = await route.fetch();
    const payload = JSON.stringify(guide).replaceAll('<', '\\u003c');
    const body = (await response.text()).replace(/(<script id="saved-guide-data" type="application\/json">)[\s\S]*?(<\/script>)/, (_, open, close) => open + payload + close);
    await route.fulfill({ response, body });
  });
  let savedCalls = 0;
  await page.route('**/api/animation/saved-guide*', route => { savedCalls++; return route.abort(); });
  await page.goto('/eket-lab.html');
  await page.getByRole('button', { name: 'Open all 11 steps' }).click();
  await expect(page.locator('#active-step-title')).toHaveText('Printed step 1');
  await expect(page.locator('#guide-step-picker option')).toHaveCount(11);
  await page.locator('#plan-next').click();
  await expect(page.locator('#guide-step-picker')).toHaveValue('1');
  await page.locator('#plan-next').click();
  await expect(page.locator('#plan-play')).toBeDisabled();
  await expect(page.locator('#plan-play')).toHaveText('Diagram only');
  await expect(page.locator('#active-step-source')).toContainText('no animation');
  await expect(page.locator('#active-manual-image')).toHaveAttribute('src', '/assets/eket/manual-page-19.png');
  await page.locator('#guide-step-picker').selectOption('10');
  await expect(page.locator('#active-step-title')).toHaveText('Printed step 11');
  await expect(page.locator('#plan-next')).toBeDisabled();
  await page.locator('#plan-previous').click();
  await expect(page.locator('#active-step-title')).toHaveText('Printed step 10');
  await expect(page.locator('#guide-coverage')).toContainText('11 manual steps · 2 experimental motion drafts · 9 diagram-only steps');
  expect(savedCalls).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('basic EKET controls load when separate app script and stylesheet requests are blocked', async ({ page }) => {
  await page.route('**/eket.js?*', route => route.abort());
  await page.route('**/style.css', route => route.abort());
  await page.route('**/viewer.bundle.js?*', route => route.abort());
  await page.goto('/eket-lab.html');
  await expect(page.getByRole('heading', { name: 'Follow all 11 manual steps' })).toBeVisible();
  await page.getByRole('button', { name: 'Open all 11 steps' }).click();
  await expect(page.locator('#guide-step-picker option')).toHaveCount(11);
  await page.locator('#guide-step-picker').selectOption('10');
  await expect(page.locator('#active-step-source')).toContainText('PDF page 19');
});

test('simple manual navigates all steps with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8011/eket-steps');
  await expect(page.getByRole('heading', { name: 'EKET: step 1 of 11' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Manual steps' }).getByRole('link', { name: '11', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'EKET: step 11 of 11' })).toBeVisible();
  await page.getByRole('link', { name: '← Previous', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'EKET: step 10 of 11' })).toBeVisible();
  await context.close();
});

test('preserved v2 guide plays the reviewed panel and hardware drafts without generation calls', async ({ page }) => {
  test.setTimeout(90000); // Five actual WebGL before/after captures on software rendering.
  test.skip(process.env.ASSEMBLY_LIVE_QA !== '1', 'Requires preserved local provider results');
  let paidCalls = 0;
  await page.route('**/api/animation/generate', route => { paidCalls++; return route.abort(); });
  await page.goto('/eket-lab.html');
  await expect(page.locator('#viewer-error')).toBeHidden({ timeout: 30000 });
  await page.getByRole('button', { name: 'Open all 11 steps' }).click();
  await expect(page.locator('#guide-coverage')).toContainText('8 experimental motion drafts');
  for (const index of [2, 3, 5, 6, 8]) {
    await page.locator('#guide-step-picker').selectOption(String(index));
    await expect(page.locator('#plan-play')).toBeEnabled();
    await page.locator('#plan-scrub').fill('0');
    const before = await page.locator('#viewer canvas').screenshot();
    await page.locator('#plan-scrub').fill('1000');
    const after = await page.locator('#viewer canvas').screenshot();
    expect(before.equals(after), `Printed step ${index+1} should visibly move`).toBe(false);
    await writeFile(`test-results/eket-v2-step-${index+1}.png`, after);
  }
  await expect(page.locator('#active-step-notices')).toContainText('turning action is not animated');
  for (const index of [4,7,9]) {
    await page.locator('#guide-step-picker').selectOption(String(index));
    await expect(page.locator('#plan-play')).toBeDisabled();
  }
  expect(paidCalls).toBe(0);
});
