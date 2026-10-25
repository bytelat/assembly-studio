import {test,expect} from '@playwright/test';

test('DALFRED original model, nine-step navigation, partial playback and source inspection',async({page})=>{
 test.setTimeout(60000);
 let paid=0;const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/animation/generate',route=>{paid++;return route.abort();});
 await page.goto('/');
 await page.getByRole('link',{name:'DALFRED bar stool',exact:true}).click();
 await expect(page.locator('#viewer-error')).toBeHidden({timeout:30000});
 await expect(page.locator('#viewer canvas')).toHaveCount(1);
 await expect(page.locator('#product-step option')).toHaveCount(9);
 await expect(page.locator('#product-part option')).toHaveCount(34);
 await expect(page.locator('#product-play')).toBeEnabled();
 await expect(page.locator('#viewer')).toBeVisible();
 await expect(page.locator('#product-main-diagram')).toBeHidden();
 const before=await page.locator('#viewer canvas').screenshot();
 await page.locator('#product-scrub').fill('1000');
 const after=await page.locator('#viewer canvas').screenshot({path:'test-results/dalfred-step-1-animated.png'});
 expect(before.equals(after)).toBe(false);
 await page.locator('#product-source').click();
 await expect(page.locator('#viewer')).toBeVisible();
 await expect(page.locator('#product-mode')).toHaveText('ORIGINAL ASSEMBLED MODEL');
 await page.locator('#product-source').click();
 await expect(page.locator('#product-mode')).toHaveText('UNVERIFIED MOTION DRAFT');
 await page.locator('#product-next').click();
 await expect(page.locator('#product-step')).toHaveValue('1');
 await page.locator('#product-step').selectOption('2');
 await expect(page.locator('#product-play')).toBeEnabled();
 await expect(page.locator('#viewer')).toBeVisible();
 await expect(page.locator('#product-main-diagram')).toBeHidden();
 await expect(page.locator('#product-image')).toHaveAttribute('src','/assets/dalfred/step-3.png');
 await page.locator('#product-scrub').fill('1000');
 await page.locator('.workspace').screenshot({path:'test-results/dalfred-footrest.png'});
 await page.locator('#product-part').selectOption('32');
 await expect(page.locator('#product-mode')).toHaveText('SOURCE PART INSPECTION');
 await expect(page.locator('#product-play')).toBeDisabled();
 await page.locator('#product-part').selectOption('');
 await expect(page.locator('#product-play')).toBeEnabled();
 for(const value of ['4','5','6','7','8']){await page.locator('#product-step').selectOption(value);await expect(page.locator('#product-play')).toBeEnabled();}
 await page.locator('#product-step').selectOption('3');
 await expect(page.locator('#product-play')).toBeEnabled();
 await expect(page.locator('#product-main-diagram')).toBeHidden();
 await expect(page.locator('#product-mode')).toHaveText('3D BOLT-CHECK WALKTHROUGH');
 await page.locator('#product-step').selectOption('8');
 await expect(page.locator('#product-play')).toBeEnabled();
 await expect(page.locator('#product-next')).toBeDisabled();
 await page.locator('#product-all').click();
 await expect(page.locator('#product-status')).toContainText('playing all steps');
 await page.locator('#product-pause').click();
 await expect(page.locator('#product-all')).toHaveText('▶ Play all steps');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(paid).toBe(0);expect(errors).toEqual([]);
});

test('steps 7 and 9 show moving 3D and retain the seat group across direct navigation',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/dalfred.html');
 await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
 for(const [value,number] of [['6',7],['8',9]]){
  await page.locator('#product-step').selectOption(value);
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#product-main-diagram')).toBeHidden();
  await expect(page.locator('#product-play')).toBeEnabled();
  await page.locator('#product-scrub').fill('0');
  const before=await page.locator('#viewer canvas').screenshot();
  await page.locator('#product-scrub').fill('1000');
  const after=await page.locator('#viewer canvas').screenshot({path:`test-results/dalfred-step-${number}-animated.png`});
  expect(before.equals(after)).toBe(false);
 }
 await page.locator('#product-previous').click();
 await expect(page.locator('#product-step')).toHaveValue('7');
 await expect(page.locator('#product-play')).toBeEnabled();
});

test('automatic playback from step 4 through 9 never hides or empties the 3D viewport',async({page})=>{
 test.setTimeout(90000);
 await page.route('**/dalfred.html',async route=>{
  const response=await route.fetch();let body=await response.text();
  body=body.replace(/(<script id="product-guide-data" type="application\/json">)([\s\S]*?)(<\/script>)/,(_,open,json,close)=>{
   const guide=JSON.parse(json);for(const step of guide.plan.steps)step.duration_seconds=2;
   return open+JSON.stringify(guide).replaceAll('<','\\u003c')+close;
  });await route.fulfill({response,body});
 });
 await page.goto('/dalfred.html');
 await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
 await page.locator('#product-step').selectOption('3');
 await expect(page.locator('#viewer')).toBeVisible();
 await expect(page.locator('#product-main-diagram')).toBeHidden();
 await page.locator('#product-scrub').fill('600');
 await expect(page.locator('#product-detail')).toContainText('CHECK 3 OF 4');
 await page.locator('#product-scrub').fill('0');
 await page.locator('#viewer').screenshot({path:'test-results/dalfred-step-4-checks.png'});
 await page.locator('#product-all').click();
 for(let index=4;index<=8;index++){
  await expect(page.locator('#product-step')).toHaveValue(String(index),{timeout:15000});
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#product-main-diagram')).toBeHidden();
  const size=await page.locator('#viewer canvas').boundingBox();
  expect(size.width).toBeGreaterThan(300);expect(size.height).toBeGreaterThan(300);
 }
 await expect(page.locator('#product-pause')).toBeDisabled({timeout:7000});
 await page.locator('#viewer').screenshot({path:'test-results/dalfred-continuous-final.png'});
});

test('DALFRED retries only a failed model chunk and completes loading',async({page})=>{
 test.setTimeout(60000);
 const requests=[];let failed=false;
 await page.route('**/model-data/dalfred/*',route=>{
  const range=new URL(route.request().url()).pathname.split('/').at(-1);requests.push(range);
  if(range==='65536'&&!failed){failed=true;return route.abort();}
  return route.continue();
 });
 await page.goto('/dalfred.html');
 await expect(page.locator('#product-all')).toBeEnabled({timeout:45000});
 await expect(page.locator('#viewer-error')).toBeHidden();
 expect(failed).toBe(true);
 expect(requests.filter(value=>value==='0')).toHaveLength(1);
 expect(requests.filter(value=>value==='65536')).toHaveLength(2);
 expect(requests).toHaveLength(197);
 await expect(page.locator('#viewer canvas')).toBeVisible();
});

test('step 9 keeps the joining diagram throughout its animation',async({page})=>{
 await page.goto('/dalfred.html');
 await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
 await page.locator('#product-step').selectOption('8');
 await expect(page.locator('#product-image')).toHaveAttribute('src','/assets/dalfred/step-9-join.png');
 await expect(page.locator('#product-phase')).toContainText('join the seat assembly');
 await page.locator('#product-scrub').fill('500');
 await expect(page.locator('#product-image')).toHaveAttribute('src','/assets/dalfred/step-9-join.png');
 await page.locator('#product-scrub').fill('1000');
 await expect(page.locator('#product-image')).toHaveAttribute('src','/assets/dalfred/step-9-join.png');
 await expect(page.locator('#product-phase')).toContainText('join the seat assembly');
 await page.locator('#product-scrub').fill('0');
 await expect(page.locator('#product-image')).toHaveAttribute('src','/assets/dalfred/step-9-join.png');
});


test('all DALFRED diagrams match their step and delayed images do not stop playback',async({page})=>{
 test.setTimeout(60000);
 let release;
 const held = new Promise(resolve => { release = resolve; });
 await page.route('**/assets/dalfred/step-2.png', async route => {
  await held; await route.continue();
 });
 await page.goto('/dalfred.html');
 await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
 await expect(page.locator('#product-image')).toBeVisible();
 await page.locator('#product-next').click();
 await page.locator('#product-all').click();
 await expect(page.locator('#product-image')).toBeHidden();
 await expect(page.locator('#product-phase')).toContainText('loading matching diagram');
 await page.waitForTimeout(1200);
 expect(Number(await page.locator('#product-scrub').inputValue())).toBeGreaterThan(0);
 release();
 await expect(page.locator('#product-image')).toBeVisible();
 await expect.poll(async()=>Number(await page.locator('#product-scrub').inputValue())).toBeGreaterThan(0);
 await page.locator('#product-pause').click();
 for(let index=0;index<9;index++){
  await page.locator('#product-step').selectOption(String(index));
  const path=index===8?'step-9-join.png':`step-${index+1}.png`;
  await expect(page.locator('#product-image')).toHaveAttribute('src',`/assets/dalfred/${path}`);
  await expect(page.locator('#product-image')).toBeVisible();
  expect(await page.locator('#product-image').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 }
});


test('all nine steps play through even when a PDF diagram fails',async({page})=>{
 test.setTimeout(60000);
 await page.route('**/dalfred.html',async route=>{
  const response=await route.fetch();let body=await response.text();
  body=body.replace(/(<script id="product-guide-data" type="application\/json">)([\s\S]*?)(<\/script>)/,(_,open,json,close)=>{
   const guide=JSON.parse(json);for(const step of guide.plan.steps)step.duration_seconds=1.5;
   return open+JSON.stringify(guide).replaceAll('<','\\u003c')+close;
  });await route.fulfill({response,body});
 });
 await page.route('**/assets/dalfred/step-2.png',route=>route.abort());
 await page.goto('/dalfred.html');
 await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
 await page.locator('#product-all').click();
 await expect(page.locator('#product-step')).toHaveValue('1',{timeout:10000});
 await expect(page.locator('#product-phase')).toContainText('diagram unavailable');
 await expect(page.locator('#product-pause')).toBeEnabled();
 for(let index=2;index<9;index++){
  await expect(page.locator('#product-step')).toHaveValue(String(index),{timeout:10000});
 }
 await expect(page.locator('#product-scrub')).toHaveValue('1000',{timeout:10000});
 await expect(page.locator('#product-status')).toContainText('finished');
 await expect(page.locator('#viewer canvas')).toBeVisible();
});
