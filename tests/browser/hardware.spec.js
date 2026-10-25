import { test, expect } from '@playwright/test';

test('hardware inspector exposes all 16 source pieces and identifies step-11 caps', async ({ page }) => {
  let generationCalls=0;
  await page.route('**/api/animation/generate', route=>{generationCalls++;return route.abort();});
  await page.goto('/eket-lab.html');
  await expect(page.locator('#inspect-part')).toBeEnabled({timeout:30000});
  await expect(page.locator('#inspect-part optgroup').first().locator('option')).toHaveCount(16);
  await expect(page.locator('#hardware-coverage-list tr')).toHaveCount(6);
  await expect(page.locator('#hardware-summary')).toContainText('16 loose pieces');
  await page.getByRole('button',{name:'Open all 11 steps'}).click();
  for (const [node,number] of [['6','139434'],['14','152651'],['16','152650']]) {
    await page.locator('#inspect-part').selectOption(node);
    await expect(page.locator('#viewer-mode')).toContainText('SOURCE PART INSPECTION');
    await expect(page.locator('#hardware-status')).toContainText(`Part ${number}`);
    await expect(page.locator('#plan-play')).toBeDisabled();
  }
  await expect(page.locator('#hardware-status')).toContainText('motion draft in step 11');
  await expect(page.locator('#hardware-manual-link')).toHaveAttribute('href','/assets/eket/manual.pdf#page=19');
  await page.locator('#viewer canvas').screenshot({path:'test-results/eket-hardware-cap.png'});
  await page.getByRole('button',{name:'Return to assembly',exact:true}).click();
  await expect(page.locator('#viewer-mode')).toHaveText('UNREVIEWED DRAFT MOTION');
  await expect(page.locator('#plan-play')).toBeEnabled();
  expect(generationCalls).toBe(0);
});

test('isolating a future fitting changes visibility and camera only, then restores the assembly pose', async ({ page, request }) => {
  const plan=(await (await request.get('/api/animation/fixture?version=2')).json()).plan;
  await page.goto('/eket-steps');
  await page.addScriptTag({type:'importmap',content:JSON.stringify({imports:{three:'/vendor/three/build/three.module.js','three/addons/':'/vendor/three/examples/jsm/'}})});
  const result=await page.evaluate(async plan=>{
    const {createViewer}=await import('/viewer.bundle.js');
    const reference=await (await fetch('/assets/eket/reference.json')).json();
    const host=document.createElement('div');host.style.cssText='width:700px;height:510px';document.body.prepend(host);
    const state={stage:'review',assembled:true,progress:.5,plan,planStep:2,inspectNode:null};
    const viewer=await createViewer(host,{model_url:'/assets/eket/model.glb',reference,connections:[]},()=>state);
    const before=viewer.inspectTransforms();
    state.inspectNode=14;viewer.renderScene();viewer.focusPart(14);
    const isolated=viewer.inspectTransforms(),camera=viewer.inspectCamera();
    state.inspectNode=null;viewer.renderScene();
    return {before,isolated,camera,after:viewer.inspectTransforms()};
  },plan);
  expect(result.isolated.filter(part=>part.visible).map(part=>part.node_index)).toEqual([14]);
  expect(result.isolated.find(part=>part.node_index===14).position[0]).toBeCloseTo(-.098,6);
  const distance=Math.hypot(...result.camera.position.map((value,i)=>value-result.camera.target[i]));
  expect(distance).toBeLessThan(.2);
  expect(result.after).toEqual(result.before);
});

test('step 11 seats washers before covers and restores preceding assembly on backward navigation', async ({ page, request }) => {
  test.setTimeout(60000);
  const plan=(await (await request.get('/api/animation/saved-guide?product_id=eket-70332124')).json()).plan;
  await page.goto('/eket-steps');
  await page.addScriptTag({type:'importmap',content:JSON.stringify({imports:{three:'/vendor/three/build/three.module.js','three/addons/':'/vendor/three/examples/jsm/'}})});
  const result=await page.evaluate(async plan=>{
    const {createViewer}=await import('/viewer.bundle.js');
    const reference=await (await fetch('/assets/eket/reference.json')).json();
    const host=document.createElement('div');host.style.cssText='width:700px;height:510px';document.body.prepend(host);
    const state={stage:'review',assembled:true,progress:1,plan,planStep:9};
    const viewer=await createViewer(host,{model_url:'/assets/eket/model.glb',reference,connections:[]},()=>state);
    const previous=viewer.inspectTransforms();
    state.planStep=10;state.progress=0;viewer.renderScene();viewer.focusPlanStep();
    const start=viewer.inspectTransforms(),camera=viewer.inspectCamera();
    state.progress=.5;viewer.renderScene();const middle=viewer.inspectTransforms();
    state.progress=1;viewer.renderScene();const end=viewer.inspectTransforms();
    state.planStep=9;viewer.renderScene();const backward=viewer.inspectTransforms();
    state.planStep=10;viewer.renderScene();const replay=viewer.inspectTransforms();
    return {previous,start,middle,end,backward,replay,camera};
  },plan);
  const part=(pose,index)=>pose.find(p=>p.node_index===index);
  for (const index of [14,20]) {
    expect(part(result.start,index).position[0]).toBeCloseTo(-.098+.065,6);
    expect(part(result.middle,index).position[0]).toBeCloseTo(-.098,6);
  }
  for (const index of [16,18]) expect(part(result.middle,index).position[0]).toBeCloseTo(-.098+.11,6);
  for (const index of [14,16,18,20]) expect(part(result.end,index).position[0]).toBeCloseTo(-.098,6);
  for (const partBefore of result.previous.filter(p=>p.visible)) expect(part(result.end,partBefore.node_index)).toEqual(partBefore);
  expect(result.backward).toEqual(result.previous);
  expect(result.replay).toEqual(result.end);
  // Source +X maps to world +X in this asset: view internal fittings from the opening.
  expect(result.camera.position[0]).toBeGreaterThan(result.camera.target[0]);
});

test('step 11 is playable in the guide and discloses omitted wall fixing', async ({page})=>{
  test.setTimeout(60000);
  await page.goto('/eket-lab.html');
  await expect(page.locator('#inspect-part')).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'Open all 11 steps'}).click();
  await page.locator('#guide-step-picker').selectOption('10');
  await expect(page.locator('#plan-play')).toBeEnabled();
  await expect(page.locator('#active-step-notices')).toContainText('not AI-generated');
  await expect(page.locator('#active-step-notices')).toContainText('missing wall screws');
  await page.locator('#plan-scrub').fill('0');
  const before=await page.locator('#viewer canvas').screenshot();
  await page.locator('#plan-scrub').fill('500');
  await page.locator('#viewer canvas').screenshot({path:'test-results/eket-step-11-washers.png'});
  await page.locator('#plan-scrub').fill('1000');
  const after=await page.locator('#viewer canvas').screenshot({path:'test-results/eket-step-11-caps.png'});
  expect(before.equals(after)).toBe(false);
});

test('hardware instructions follow playback and part buttons replay in assembly close-up', async ({page})=>{
  test.setTimeout(60000);
  await page.goto('/eket-lab.html');
  await expect(page.locator('#inspect-part')).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'Open all 11 steps'}).click();
  await expect(page.locator('#hardware-playback')).toBeHidden();
  await page.locator('#guide-step-picker').selectOption('10');
  await expect(page.locator('#hardware-playback')).toBeVisible();
  await expect(page.locator('#hardware-action-list button')).toHaveCount(4);
  await expect(page.locator('#hardware-action-title')).toContainText('Washer 152651 · 1 of 2');
  await page.locator('#plan-scrub').fill('350');
  await expect(page.locator('#hardware-action-title')).toContainText('Washer 152651 · 2 of 2');
  await page.locator('#plan-scrub').fill('550');
  await expect(page.locator('#hardware-action-title')).toHaveText('Wall fastening — not shown');
  await expect(page.locator('#hardware-action-detail')).toContainText('does not demonstrate fastening');
  await expect(page.locator('#hardware-closeup')).toBeDisabled();
  await page.getByRole('button',{name:'Cover 152650 · 2 of 2',exact:true}).click();
  await expect(page.locator('#plan-scrub')).toHaveValue('830');
  await expect(page.locator('#hardware-action-title')).toContainText('Cover 152650 · 2 of 2');
  await expect(page.locator('#hardware-action-detail')).toContainText('only after the cabinet is secured');
  await expect(page.locator('#viewer-mode')).toHaveText('UNREVIEWED DRAFT MOTION');
  await expect(page.locator('#plan-play')).toBeEnabled();
  await page.locator('#viewer canvas').screenshot({path:'test-results/eket-cover-assembly-closeup.png'});
  await page.getByRole('button',{name:'Show whole cabinet',exact:true}).click();
  for (const [step,count,part] of [['5',8,'139434'],['6',2,'141413'],['8',2,'141414']]) {
    await page.locator('#guide-step-picker').selectOption(step);
    await expect(page.locator('#hardware-action-list button')).toHaveCount(count);
    await expect(page.locator('#hardware-action-title')).toContainText(part);
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#hardware-playback')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('live hardware close-up uses moving source geometry while whole assembly stays visible',async({page})=>{
  test.setTimeout(60000);
  let modelDownloads=0;
  page.on('request',request=>{if(new URL(request.url()).pathname==='/assets/eket/model.glb')modelDownloads++;});
  await page.goto('/eket-lab.html');
  await expect(page.locator('#inspect-part')).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'Open all 11 steps'}).click();
  await expect(page.locator('#hardware-detail-label')).toBeHidden();
  await page.locator('#guide-step-picker').selectOption('10');
  await expect(page.locator('#hardware-detail-label')).toContainText('Washer 152651 · 1 of 2');
  await page.locator('#plan-scrub').fill('350');
  await expect(page.locator('#hardware-detail-label')).toContainText('Washer 152651 · 2 of 2');
  await page.locator('#plan-scrub').fill('550');
  await expect(page.locator('#hardware-detail-label')).toBeHidden();
  await page.locator('#plan-scrub').fill('700');
  await expect(page.locator('#hardware-detail-label')).toContainText('Cover 152650 · 1 of 2');
  await expect(page.locator('#viewer canvas')).toHaveCount(1);
  await expect(page.locator('#viewer-mode')).toHaveText('UNREVIEWED DRAFT MOTION');
  await page.locator('#viewer').screenshot({path:'test-results/eket-live-hardware-detail.png'});
  await page.locator('#hardware-live-closeup').uncheck();
  await expect(page.locator('#hardware-detail-label')).toBeHidden();
  await page.locator('#hardware-live-closeup').check();
  await expect(page.locator('#hardware-detail-label')).toBeVisible();
  await page.locator('#guide-step-picker').selectOption('5');
  await page.locator('#hardware-action-list button').last().click();
  await expect(page.locator('#hardware-detail-label')).toContainText('139435 · 4 of 4');
  await page.locator('#guide-step-picker').selectOption('4');
  await expect(page.locator('#hardware-detail-label')).toBeHidden();
  expect(modelDownloads).toBe(1);
});
