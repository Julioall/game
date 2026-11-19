import test from 'node:test';
import assert from 'node:assert/strict';
import { PixelArtPass } from '../src/render/pixel-art.js';
import { PIXEL_ART_MODES, pixelArtProfile, pixelArtResolution, overviewFogFar,
  PALETTE_NAME, WORLD_PALETTE, harmonizedPaletteLut, PALETTE_LUT_STEPS } from '../src/render/pixel-style.js';
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
  assert.equal(material.uniforms.paletteLut.value, pass.paletteLut);
  assert.equal(pass.paletteLut.image.width, 256);
  assert.equal(pass.paletteLut.image.height, 16);
  pass.setStyle('retro');
  assert.equal(pass.material, material);
  assert.equal(pass.target, target);
  assert.equal(material.uniforms.paletteLut.value, pass.paletteLut);
  assert.equal(material.uniforms.ditherStrength.value, .035);
  assert.equal(material.uniforms.edgeStrength.value, .36);
  pass.setStyle('pixel');
  assert.equal(material.uniforms.ditherStrength.value, .018);
  assert.ok(material.fragmentShader.includes('texture2D(paletteLut,paletteUV)'));
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

test('Vale de Âmbar uses 32 unique harmonized color swatches and stable tone ramps', () => {
  assert.equal(PALETTE_NAME, 'Vale de Âmbar');
  assert.equal(WORLD_PALETTE.length, 32);
  assert.equal(new Set(WORLD_PALETTE).size, WORLD_PALETTE.length);
  assert.ok(WORLD_PALETTE.every(hex => /^#[0-9a-f]{6}$/i.test(hex)));
  const luminance = hex => {
    const components = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    return .2126*components[0] + .7152*components[1] + .0722*components[2];
  };
  for (const [first, last] of [[0, 8], [8, 14], [14, 20], [20, 26], [26, 32]]) {
    for (let i = first + 1; i < last; i++)
      assert.ok(luminance(WORLD_PALETTE[i]) > luminance(WORLD_PALETTE[i - 1]),
        'color ramp should increase in brightness');
  }
});

test('the precomputed palette LUT contains only palette colors and remains cached', () => {
  const data = harmonizedPaletteLut();
  assert.equal(PALETTE_LUT_STEPS, 16);
  assert.equal(data.length, 256 * 16 * 4);
  assert.equal(harmonizedPaletteLut(), data, 'the palette LUT must not regenerate during gameplay');
  const allowed = new Set(WORLD_PALETTE.map(color => color.toLowerCase()));
  for (let i = 0; i < data.length; i += 4) {
    const hex = '#' + [...data.subarray(i, i + 3)].map(n => n.toString(16).padStart(2, '0')).join('');
    assert.ok(allowed.has(hex), 'unexpected color outside the harmonious palette');
    assert.equal(data[i + 3], 255);
  }
});
