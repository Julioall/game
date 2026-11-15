import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { terrainTextureWeights } from '../src/render/terrain-textures.js';

test('terrain texture weights cover every biome and keep roads and fields readable', () => {
  for (let biome = 0; biome < 12; biome++) {
    for (const grade of [0, 1.5]) for (const sand of [0, .4, 1]) {
      const w = terrainTextureWeights(biome, -1, grade, sand, false, false, false, false);
      assert.equal(w.length, 8);
      assert.ok(w.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-6);
    }
  }
  assert.equal(terrainTextureWeights(9, -1, 0, 0, false, false, false, false)[5], 1);
  assert.equal(terrainTextureWeights(4, 1, 0, 0, false, false, false, false)[3], 1);
  assert.equal(terrainTextureWeights(4, -1, 0, 1, false, true, true, true)[7], 1);
  assert.equal(terrainTextureWeights(4, -1, 0, 1, true, false, false, false)[3], 1);
});

test('prepared terrain atlas matches the layer layout and preserves source attribution', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/terrain/manifest.json', import.meta.url)));
  const png = readFileSync(new URL('../public/terrain/terrain-atlas.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 1088);
  assert.equal(png.readUInt32BE(20), 544);
  assert.equal(manifest.textures.length, 8);
  assert.equal(manifest.tile, 256);
  assert.equal(manifest.padding, 8);
  for (const [index, entry] of manifest.textures.entries()) {
    assert.equal(entry.layer, index);
    assert.ok(entry.source.endsWith('.png'));
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
});
