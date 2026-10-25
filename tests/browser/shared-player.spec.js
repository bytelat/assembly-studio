import {test,expect} from '@playwright/test';

for(const [url,name,count] of [['/','LACK side table',10],['/eket.html','EKET cabinet',11],['/dalfred.html','DALFRED bar stool',9]]){
 test(`${name} uses the shared controls for selection, playback, pause, inspection and completion`,async({page})=>{
  test.setTimeout(60000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(`**${url==='/'?'/':url}`,async route=>{
   const response=await route.fetch();const body=(await response.text()).replace(/(<script id="product-guide-data" type="application\/json">)([\s\S]*?)(<\/script>)/,(_,open,json,close)=>{
    const guide=JSON.parse(json);for(const step of guide.plan.steps)step.duration_seconds=1;
    return open+JSON.stringify(guide).replaceAll('<','\\u003c')+close;
   });await route.fulfill({response,body});
  });
  await page.goto(url);
  await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
  await expect(page.locator('#assembly-name')).toHaveText(name);
  await expect(page.locator('#product-step option')).toHaveCount(count);
  await expect(page.locator('.assembly-controls button')).toHaveText(['▶ Play step','▶ Play all steps','Ⅱ Pause','Assembled model','Reset view']);
  await expect(page.locator('#product-previous')).toBeDisabled();
  await page.locator('#product-next').click();
  await expect(page.locator('#product-step')).toHaveValue('1');
  await page.locator('#product-play').click();
  await expect.poll(()=>page.locator('#product-scrub').inputValue()).not.toBe('0');
  await page.locator('#product-pause').click();
  const paused=await page.locator('#product-scrub').inputValue();await page.waitForTimeout(150);
  await expect(page.locator('#product-scrub')).toHaveValue(paused);
  await page.locator('#product-source').click();
  await expect(page.locator('#product-mode')).toHaveText('ORIGINAL ASSEMBLED MODEL');
  await page.locator('#product-source').click();
  const node=await page.locator('#product-part option').nth(1).getAttribute('value');
  await page.locator('#product-part').selectOption(node);
  await expect(page.locator('#product-mode')).toHaveText('SOURCE PART INSPECTION');
  await expect(page.locator('#product-play')).toBeDisabled();
  await page.locator('#product-part').selectOption('');
  await expect(page.locator('#product-play')).toBeEnabled();
  await page.locator('#product-step').selectOption(String(count-2));
  await page.locator('#product-all').click();
  await expect(page.locator('#product-step')).toHaveValue(String(count-1),{timeout:15000});
  await expect(page.locator('#product-pause')).toBeDisabled({timeout:15000});
  await expect(page.locator('#product-next')).toBeDisabled();
  await expect(page.locator('#viewer canvas')).toBeVisible();
  await page.locator('.workspace').screenshot({path:`test-results/shared-${name.split(' ')[0].toLowerCase()}.png`});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 });
}

test('completed model chunks survive a failed load and are reused after reload',async({page})=>{
 test.setTimeout(60000);
 let allow=false;const requests=[];
 await page.route('**/model-data/lack/*',route=>{
  const range=new URL(route.request().url()).pathname.split('/').at(-1);requests.push(range);
  if(!allow&&range==='65536')return route.abort();
  return route.continue();
 });
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Retry loading',exact:true})).toBeVisible({timeout:30000});
 expect(requests.filter(value=>value==='0')).toHaveLength(1);
 allow=true;
 await page.getByRole('button',{name:'Retry loading',exact:true}).click();
 await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
 expect(requests.filter(value=>value==='0')).toHaveLength(1);
 expect(requests.filter(value=>value==='65536')).toHaveLength(3);
 await expect(page.locator('#viewer canvas')).toBeVisible();
});

test('floating close-up stays upper left without moving controls on desktop or mobile',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/eket.html');
 await expect(page.locator('#product-all')).toBeEnabled({timeout:30000});
 await page.locator('#product-step').selectOption('10');
 const host=page.locator('#viewer'),panel=page.getByRole('region',{name:'Part close-up'});
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.locator('#product-live-detail').check();
  await expect(panel).toBeVisible();
  const hostBox=await host.boundingBox(),box=await panel.boundingBox();
  expect(box.x-hostBox.x).toBeLessThanOrEqual(12);
  expect(box.y-hostBox.y).toBeLessThanOrEqual(12);
  expect(box.x).toBeGreaterThan(hostBox.x);
  expect(box.y).toBeGreaterThan(hostBox.y);
  expect(box.width).toBeLessThan(hostBox.width/2);
  const controls=await page.locator('#product-play').evaluate(el=>el.getBoundingClientRect().top+scrollY);
  await host.screenshot({path:`test-results/eket-closeup-floating-${viewport.width}.png`});
  await page.locator('#product-live-detail').uncheck();
  await expect(panel).toBeHidden();
  expect((await host.boundingBox()).height).toBe(hostBox.height);
  expect(await page.locator('#product-play').evaluate(el=>el.getBoundingClientRect().top+scrollY)).toBe(controls);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
