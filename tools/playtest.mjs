import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism, cpus, platform } from 'node:os';
import { chromium } from 'playwright-core';

const url = process.env.KINGDOM_URL ?? 'http://127.0.0.1:5917';
const runServer = !process.env.KINGDOM_URL;
const server = runServer && spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5917', '--strictPort'],
  { stdio: 'inherit', windowsHide: true });
const output = 'playtest-output';
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const settle = page => page.waitForFunction(() => {
  const s = window.kingdomQA?.stats();
  return s && s.active > 0 && s.active === s.desired && document.querySelector('#loading').hidden;
}, undefined, { timeout: 30000 });

function watch(page) {
  const errors = [];
  const record = error => {
    if (!errors.includes(error)) console.error(error);
    errors.push(error);
  };
  page.on('pageerror', error => record(error.message));
  page.on('console', msg => { if (msg.type() === 'error') record(msg.text()); });
  return errors;
}

async function sample(page) {
  await page.evaluate(() => window.kingdomQA.resetFrames());
  await page.waitForTimeout(2500);
  return page.evaluate(() => window.kingdomQA.stats());
}

async function harvest(page, kind, inventoryId) {
  const before = Number(await page.locator('#' + inventoryId).innerText());
  const candidates = await page.evaluate(kind => window.kingdomQA.targets(kind)
    .filter(({ screen }) => screen.x > innerWidth * .24 && screen.x < innerWidth * .78 &&
      screen.y > innerHeight * .16 && screen.y < innerHeight * .77)
    .sort((a, b) => (b.age ?? b.scale) - (a.age ?? a.scale)), kind);
  assert.ok(candidates.length > 0, 'No visible ' + kind);
  for (const { screen } of candidates.slice(0, 25)) {
    await page.mouse.click(screen.x, screen.y);
    const button = page.locator('#harvest');
    if (!await button.isVisible()) continue;
    const label = await button.innerText();
    if (kind === 'tree' ? !label.includes('madeira') : !label.includes('pedra')) continue;
    await button.click();
    assert.ok(Number(await page.locator('#' + inventoryId).innerText()) > before);
    return;
  }
  assert.fail('Could not harvest a visible ' + kind);
}

try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch { /* wait for Vite */ }
    if (i === 59) throw new Error('Playtest server unavailable at ' + url);
    await sleep(300);
  }
  await mkdir(output, { recursive: true });
  const args = ['--enable-unsafe-swiftshader', '--enable-precise-memory-info'];
  browser = await chromium.launch({ channel: process.env.KINGDOM_BROWSER ?? 'chrome', args });
  const viewport = { width: 1440, height: 900 };
  const page = await browser.newPage({ viewport });
  const errors = watch(page);
  const startVillage = performance.now();
  await page.goto(url + '/?qa=1&size=1024');
  await settle(page);
  const villageReadyMs = performance.now() - startVillage;
  const hardware = await page.evaluate(() => {
    const gl = document.querySelector('#world').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      cssViewport: [innerWidth, innerHeight], internalCanvas: [gl.drawingBufferWidth, gl.drawingBufferHeight] };
  });
  console.log('Village loaded; measuring and exercising controls.');
  const measurements = { village: await sample(page) };
  assert.equal(measurements.village.brokenRivers, 0);
  assert.equal(measurements.village.invalidSites, 0);
  await page.screenshot({ path: output + '/vila.png' });
  const firstPersonStart=await page.evaluate(()=>window.kingdomQA.focus());
  await page.locator('#first-person').click();
  await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
  const firstPersonMoved=await page.evaluate(()=>window.kingdomQA.focus());
  assert.ok(Math.hypot(firstPersonMoved.x-firstPersonStart.x,firstPersonMoved.z-firstPersonStart.z)>.1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#first-person').getAttribute('aria-pressed'),'false');
  await page.evaluate(({x,z,span})=>window.kingdomQA.go(x,z,span),firstPersonStart);
  await settle(page);
  const home = await page.evaluate(() => window.kingdomQA.focus());
  await page.mouse.move(840, 450);
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(span => window.kingdomQA.focus().span < span, home.span);
  const zoomed = await page.evaluate(() => window.kingdomQA.focus());
  assert.ok(zoomed.x > home.x && zoomed.z < home.z, 'Zoom follows the cursor to the right');
  await page.keyboard.down('d');
  await page.waitForTimeout(390);
  await page.keyboard.up('d');
  assert.notEqual((await page.evaluate(() => window.kingdomQA.focus())).x, home.x);
  const beforeDrag = await page.evaluate(() => window.kingdomQA.focus());
  await page.mouse.move(730, 440);
  await page.mouse.down();
  await page.mouse.move(730, 525, { steps: 7 });
  await page.mouse.up();
  const afterDown = await page.evaluate(() => window.kingdomQA.focus());
  assert.ok(afterDown.x < beforeDrag.x && afterDown.z < beforeDrag.z, 'Drag down pulls the terrain down');
  await page.mouse.move(730, 525);
  await page.mouse.down();
  await page.mouse.move(815, 525, { steps: 7 });
  await page.mouse.up();
  const afterRight = await page.evaluate(() => window.kingdomQA.focus());
  assert.ok(afterRight.x < afterDown.x && afterRight.z > afterDown.z, 'Drag right pulls the terrain right');
  await page.locator('#home').click();
  await settle(page);

  const capitals = await page.evaluate(() => window.kingdomQA.settlements().filter(t => t.kind === 'city'));
  assert.ok(capitals.length >= 2);
  for (const capital of capitals) {
    await page.locator('#destination').selectOption(String(capital.id));
    await settle(page);
    await page.waitForFunction(name => document.querySelector('#region').textContent.includes(name), capital.name);
    assert.equal((await page.evaluate(() => window.kingdomQA.focus())).x, capital.x);
    await page.screenshot({ path: output + '/capital-' + capital.id + '.png' });
  }
  const fortifiedCapital = capitals.find(capital => capital.gate);
  assert.ok(fortifiedCapital, 'Expected a fortified city in the generated realm');
  assert.equal(await page.evaluate(id => window.kingdomQA.walkway(id).edges.filter(edge => edge.kind === 'escada').length, fortifiedCapital.id), 4);
  await page.locator('#diagnose').click();
  await page.locator('#walkways').click();
  assert.equal(await page.locator('#walkways').getAttribute('aria-pressed'), 'true');
  await page.locator('#walkways').click();
  await page.locator('#diagnose').click();
  await page.locator('#home').click();
  await settle(page);

  await harvest(page, 'tree', 'wood');
  if (Number(await page.locator('#wood').innerText()) < 3) await harvest(page, 'tree', 'wood');
  await harvest(page, 'rock', 'stone');
  await page.locator('#build').click();
  const lots = await page.evaluate(() => window.kingdomQA.lots().filter(({ screen }) =>
    screen.x > innerWidth * .23 && screen.x < innerWidth * .78 && screen.y > innerHeight * .22 && screen.y < innerHeight * .75));
  for (const { screen } of lots.slice(0, 25)) {
    await page.mouse.click(screen.x, screen.y);
    if (await page.locator('#build').getAttribute('aria-pressed') === 'false') break;
  }
  const saved = await page.evaluate(() => window.kingdomQA.state());
  assert.equal(saved.buildings.length, 1);
  assert.ok(saved.removed.length >= 2);
  const afterBuilding = await page.evaluate(() => window.kingdomQA.stats());
  assert.equal(afterBuilding.generationMs, measurements.village.generationMs);
  assert.equal(afterBuilding.revision, saved.removed.length + saved.buildings.length);
  await settle(page);
  await page.screenshot({ path: output + '/interacao.png' });
  await page.reload();
  await settle(page);
  assert.deepEqual(await page.evaluate(() => window.kingdomQA.state()), saved);
  console.log('Harvest, cabin placement and reload verified.');

  await page.locator('#lake').click();
  await settle(page);
  await page.waitForFunction(() => {
    const qa = window.kingdomQA, { x, z } = qa.focus();
    const water = qa.waterAt(x, z);
    if (water?.kind !== 'lake') return false;
    const screen = qa.project(x, water.surface, z);
    return Math.abs(screen.x - innerWidth / 2) < 1 && Math.abs(screen.y - innerHeight / 2) < innerHeight / 5;
  });
  const lakePoint = await page.evaluate(() => {
    const qa = window.kingdomQA, { x, z } = qa.focus();
    return qa.project(x, qa.waterAt(x, z).surface, z);
  });
  await page.mouse.click(lakePoint.x, lakePoint.y);
  assert.equal(await page.locator('#inspect strong').innerText({ timeout: 3000 }), 'Lago');
  assert.match(await page.locator('#inspect small').innerText(), /^Profundidade [\d,]+ m$/);
  await page.screenshot({ path: output + '/lago.png' });
  const route = await page.evaluate(() => {
    const qa = window.kingdomQA, focus = qa.focus(), size = qa.world().size;
    const directions = [
      { x: -Math.SQRT1_2, z: -Math.SQRT1_2, key: 'w' },
      { x: Math.SQRT1_2, z: -Math.SQRT1_2, key: 'd' },
      { x: Math.SQRT1_2, z: Math.SQRT1_2, key: 's' },
      { x: -Math.SQRT1_2, z: Math.SQRT1_2, key: 'a' }
    ];
    for (let radius = 0; radius <= 120; radius += 2) {
      for (let oz = -radius; oz <= radius; oz += 2) for (let ox = -radius; ox <= radius; ox += 2) {
        if (radius && Math.abs(ox) < radius && Math.abs(oz) < radius) continue;
        const x = focus.x + ox, z = focus.z + oz;
        if (x < 4 || z < 4 || x >= size - 4 || z >= size - 4 || qa.waterAt(x, z)) continue;
        for (const direction of directions) {
          let wade = false;
          for (let distance = 1; distance <= 36; distance++) {
            const water = qa.waterAt(x + direction.x * distance, z + direction.z * distance);
            const mode = water?.depth >= 1 ? 'swim' : water?.depth >= .15 ? 'wade' : 'walk';
            if (mode === 'wade') wade = true;
            if (wade && mode === 'swim' && water.kind === 'lake') {
              return { x, z, key: direction.key };
            }
            if (wade && mode === 'walk') break;
          }
        }
      }
    }
    return null;
  });
  assert.ok(route, 'Could not find a walk-to-wade-to-swim route by the lake');
  await page.evaluate(({ x, z }) => window.kingdomQA.go(x, z, 22), route);
  await settle(page);
  await page.locator('#traverse').click();
  const bank = await page.evaluate(({ x, z }) => window.kingdomQA.project(x, window.kingdomQA.groundAt(x, z), z), route);
  await page.mouse.click(bank.x, bank.y);
  const travelMode = mode => page.waitForFunction(mode => window.kingdomQA.traveler()?.mode === mode, mode, { timeout: 7000 });
  await travelMode('walk');
  await page.keyboard.down(route.key);
  await travelMode('wade');
  await travelMode('swim');
  await page.keyboard.up(route.key);
  assert.equal(await page.locator('#travel-mode').innerText(), 'Nadando');
  await page.screenshot({ path: output + '/travessia.png' });
  const returnPoint = await page.evaluate(({ x, z }) => window.kingdomQA.project(x, window.kingdomQA.groundAt(x, z), z), route);
  await page.mouse.click(returnPoint.x, returnPoint.y);
  await travelMode('wade');
  await travelMode('walk');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.kingdomQA.traveler()), null);
  assert.deepEqual(await page.evaluate(() => window.kingdomQA.state()), saved);
  await page.locator('#peak').click();
  await settle(page);
  await page.screenshot({ path: output + '/pico.png' });

  await page.locator('#settings').click();
  await page.locator('[name=seed]').fill('9057');
  await page.locator('[name=size]').selectOption('1024');
  await page.locator('[name=vegetation]').press('End');
  await page.locator('[name=rivers]').evaluate(input => {
    input.value = '.78';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const startStress = performance.now();
  await page.locator('button[type=submit]').click();
  await page.waitForFunction(() => window.kingdomQA?.world()?.seed === 9057);
  await settle(page);
  const stressReadyMs = performance.now() - startStress;
  console.log('Stress seed loaded; moving across chunk boundaries.');
  for (const p of [[380, 330], [320, 390], [530, 420], [580, 580], [180, 180], [430, 480]]) {
    await page.evaluate(([x, z]) => window.kingdomQA.go(x, z, 104), p);
    await settle(page);
  }
  await page.locator('#diagnose').click();
  await page.locator('#layer').selectOption('water');
  measurements.stressWide = await sample(page);
  await page.screenshot({ path: output + '/estresse.png' });

  await page.locator('#home').click();
  await settle(page);
  await page.evaluate(() => window.kingdomQA.resetFrames());
  await page.mouse.move(740, 440);
  await page.mouse.down();
  await page.mouse.move(540, 558, { steps: 20 });
  await page.mouse.up();
  await page.keyboard.down('d');
  await page.waitForTimeout(2100);
  await page.keyboard.up('d');
  measurements.stressPan = await page.evaluate(() => window.kingdomQA.stats());
  assert.ok(measurements.stressPan.cached <= 80);
  assert.deepEqual(errors, []);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mobileErrors = watch(mobile);
  await mobile.goto(url + '/?qa=1&seed=42');
  await settle(mobile);
  await mobile.locator('#zoom-in').tap();
  await mobile.locator('#lake').tap();
  await settle(mobile);
  await mobile.screenshot({ path: output + '/mobile.png' });
  assert.deepEqual(mobileErrors, []);
  const report = {
    timestamp: new Date().toISOString(), browser: browser.version(), platform: platform(), headless: true,
    cpu: cpus()[0]?.model, logicalCpus: availableParallelism(), ...hardware,
    villageReadyMs, stressReadyMs, measurements
  };
  await writeFile(output + '/benchmark.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  console.log('Playtest passed: camera, resources, construction, save/reload, regeneration, stress, mobile.');
} finally {
  await browser?.close();
  server?.kill?.();
}
