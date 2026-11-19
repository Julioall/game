import test from 'node:test';
import assert from 'node:assert/strict';
import { PixelArtPass } from '../src/render/pixel-art.js';
import { PIXEL_ART_MODES, pixelArtProfile, pixelArtResolution, overviewFogFar } from '../src/render/pixel-style.js';
import { GRASS_DENSITY, keepGrass } from '../src/world/vegetation.js';

test('pixel-art presentation offers native, pixel and strong modes', () => {
  assert.deepEqual(Object.keys(PIXEL_ART_MODES), ['off', 'pixel', 'retro']);
  assert.deepEqual(pixelArtResolution(1200, 800, 'off'), { width: 1200, height: 800, scale: 1 });
  assert.deepEqual(pixelArtResolution(1200, 800, 'pixel'), { width: 600, height: 400, scale: .5 });
  assert.deepEqual(pixelArtResolution(1200, 800, 'retro'), { width: 400, height: 267, scale: 1 / 3 });
  assert.deepEqual(pixelArtResolution(0, 0, 'pixel'), { width: 1, height: 1, scale: .5 });
  assert.deepEqual(pixelArtProfile('wrong'), pixelArtProfile('pixel'));
});

test('the postprocess reconfigures its existing shader without recreating resources', () => {
  const pass = new PixelArtPass();
  const material = pass.material, target = pass.target;
  assert.equal(material.uniforms.paletteLevels.value.x, 15);
  pass.setStyle('retro');
  assert.equal(pass.material, material);
  assert.equal(pass.target, target);
  assert.equal(material.uniforms.paletteLevels.value.x, 9);
  assert.equal(material.uniforms.edgeStrength.value, .52);
  pass.setStyle('pixel');
  assert.equal(material.uniforms.paletteLevels.value.y, 17);
  pass.dispose();
});

test('linear overhead fog is 70 percent weaker at the previous fog far depth', () => {
  const far = overviewFogFar(250, 403, .3);
  assert.equal(far, 760);
  assert.ok(Math.abs((403 - 250) / (far - 250) - .3) < 1e-12);
  assert.throws(() => overviewFogFar(250, 403, 0), RangeError);
});

test('grass thinning is deterministic, independent of the chunk and close to 30 percent', () => {
  assert.equal(GRASS_DENSITY, .3);
  let kept = 0;
  for (let x = 0; x < 100; x++) for (let z = 0; z < 100; z++) {
    const first = keepGrass(1769, x, z, 3041);
    assert.equal(keepGrass(1769, x, z, 3041), first);
    if (first) kept++;
  }
  assert.ok(kept > 2700 && kept < 3300, 'about 70% of grass is removed');
});
