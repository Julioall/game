import test from 'node:test';
import assert from 'node:assert/strict';
import { floraBiomeAt, treeFlora } from '../src/world/flora-biomes.js';
import { natureKey, natureGeometry } from '../src/render/nature-models.js';
import models from '../src/render/assets/nature.json' with { type: 'json' };
import { createFloraClimate, floraClimateAt } from '../src/world/flora-climate.js';
import { generate } from '../src/world/generate.js';
import { readOnlyWorld } from '../src/world/read-only.js';

function world(biome, height, distance = 255) {
  const size = 128, stride = size + 1;
  return { config: { size, seed: 1769, relief: .64, style: 'spring' }, stride,
    biome: new Uint8Array(stride ** 2).fill(biome), ground: new Float32Array(stride ** 2).fill(height),
    distance: new Uint8Array(stride ** 2).fill(distance) };
}

test('flora biomes distinguish cold, warm, riparian and dry habitats', () => {
  assert.equal(floraBiomeAt(world(3, 4), 64, 32), 'temperate');
  assert.equal(floraBiomeAt(world(3, 11), 64, 16), 'boreal');
  assert.equal(floraBiomeAt(world(3, 16), 64, 8), 'snowy');
  assert.equal(floraBiomeAt(world(7, 17), 64, 80), 'conifer');
  assert.equal(floraBiomeAt(world(10, 1, 4), 64, 100), 'riparian');
  assert.equal(floraBiomeAt(world(11, 1, 2), 64, 100), 'wetland');
  assert.equal(floraBiomeAt(world(6, 3), 64, 100), 'dry');
  assert.equal(floraBiomeAt(world(6, 3, 10), 64, 100), 'palm');
  assert.equal(floraBiomeAt(world(5, 3, 8), 64, 100), 'palm');
  for (const biome of [0, 1, 9]) assert.equal(floraBiomeAt(world(biome, 1), 64, 100), null);
});

test('palms require warmth and cold trees use snow rather than autumn', () => {
  const record = { species: 'acacia', age: 90, variant: 2, x: 64, z: 100 };
  const palm = treeFlora(world(5, 2, 8), record);
  assert.equal(palm.family, 'PalmTree');
  assert.equal(palm.season, '');
  assert.equal(treeFlora(world(5, 2), { ...record, z: 8 }).family, undefined);
  const cold = world(3, 16); cold.config.style = 'autumn';
  const birch = treeFlora(cold, { ...record, species: 'birch', z: 8, age: 20 });
  assert.equal(birch.season, '_Snow');
});

test('flora is identical through read-only grids and keeps two live variants per 128 m region', () => {
  const w = world(3, 4);
  const readonly = { ...w, ...Object.fromEntries(['biome', 'ground', 'distance'].map(key => [key, { at: i => w[key][i] }])) };
  const variants = new Set();
  for (let variant = 0; variant < 5; variant++) {
    const record = { species: 'oak', age: 20, variant, x: 48, z: 32 };
    const flora = treeFlora(w, record);
    assert.deepEqual(flora, treeFlora(readonly, record));
    variants.add(flora.variant);
  }
  assert.equal(variants.size, 2);
  const seen = new Set();
  for (let seed = 0; seed < 50; seed++) {
    w.config.seed = seed;
    seen.add(treeFlora(w, { species: 'oak', age: 20, variant: 0, x: 48, z: 32 }).variant);
  }
  assert.equal(seen.size, 5);
});

test('all 94 tree assets have valid matching near and distant geometry', () => {
  const species = { CommonTree: 'oak', BirchTree: 'birch', PineTree: 'pine', Willow: 'willow', PalmTree: 'acacia' };
  let count = 0;
  for (const key of Object.keys(models)) {
    const match = /^(CommonTree|BirchTree|PineTree|Willow|PalmTree)(.*)_(\d+)$/.exec(key);
    if (!match) continue;
    const object = { kind: 'tree', species: species[match[1]], variant: 0,
      flora: { family: match[1], season: match[2], variant: Number(match[3]) - 1 } };
    assert.equal(natureKey(object, 'spring'), key);
    const near = natureGeometry(object, 'spring'), far = natureGeometry(object, 'spring', true);
    assert.ok(far.index.count <= near.index.count);
    assert.deepEqual(far.boundingBox, near.boundingBox);
    assert.ok(Array.from(far.index.array).every(i => i < far.attributes.position.count));
    near.dispose(); far.dispose(); count++;
  }
  assert.equal(count, 94);
});

function climateWorld(biome, temperature, rain, distance = 255) {
  const w = world(biome, 4, distance);
  Object.assign(w, createFloraClimate(w.config, w.stride, w.ground,
    new Float32Array(w.stride ** 2).fill(rain), new Float32Array(w.stride ** 2).fill(temperature)));
  return w;
}

test('tree families follow the habitat instead of inherited species slots', () => {
  const temperate = climateWorld(3, .56, .65);
  const cold = climateWorld(3, .32, .65);
  const swamp = climateWorld(11, .56, .9, 2);
  const dry = climateWorld(6, .75, .2);
  const warmFamilies = new Set(), coldFamilies = new Set();
  for (let i = 0; i < 100; i++) {
    const record = { species: 'pine', age: 30, variant: i % 5, x: 10 + i, z: 64 };
    const warm = treeFlora(temperate, record);
    assert.equal(warm.biome, 'temperate');
    assert.ok(['CommonTree', 'BirchTree'].includes(warm.family));
    warmFamilies.add(warm.family);
    const cool = treeFlora(cold, { ...record, species: 'oak' });
    assert.ok(['PineTree', 'BirchTree'].includes(cool.family));
    coldFamilies.add(cool.family);
    assert.equal(treeFlora(swamp, record).family, 'Willow');
    const arid = treeFlora(dry, record);
    assert.equal(arid.renderSpecies, 'acacia');
    assert.equal(natureKey({ ...record, kind: 'tree', flora: arid }, 'spring'), null);
  }
  assert.equal(warmFamilies.size, 2);
  assert.equal(coldFamilies.size, 2);
});

test('high humidity alone and saltwater do not create a willow swamp', () => {
  const distant = climateWorld(3, .55, .95);
  const record = { species: 'willow', age: 30, variant: 0, x: 64, z: 64 };
  assert.notEqual(treeFlora(distant, record).family, 'Willow');
  const coast = climateWorld(11, .55, .95, 2);
  coast.waterKind = new Uint8Array(coast.stride ** 2);
  coast.waterKind[64 * coast.stride + 66] = 1;
  assert.notEqual(treeFlora(coast, record).family, 'Willow');
  coast.waterKind[64 * coast.stride + 66] = 2;
  assert.equal(treeFlora(coast, record).family, 'Willow');
});

test('regional climate survives compact worlds and readonly views within quantization error', () => {
  const full = generate({ size: 128, seed: 1769 });
  const compact = generate({ size: 128, seed: 1769 }, { compact: true });
  assert.equal(compact.heat, undefined);
  const view = readOnlyWorld(compact);
  assert.deepEqual(full.floraThermal, compact.floraThermal);
  assert.deepEqual(full.floraRain, compact.floraRain);
  for (const [x, z] of [[0, 0], [32, 64], [96, 96], [128, 128]]) {
    const climate = floraClimateAt(full, x, z);
    assert.ok(Math.abs(climate.temperature - full.heat[z * full.stride + x]) < .006);
    assert.deepEqual(climate, floraClimateAt(view, x, z));
  }
});

test('regional climate handles a final grid cell shorter than 32 m', () => {
  const size = 50, stride = size + 1;
  const w = { config: { size, relief: .64 }, stride,
    ground: new Float32Array(stride ** 2), distance: new Uint8Array(stride ** 2).fill(255) };
  const heat = new Float32Array(stride ** 2), rain = new Float32Array(stride ** 2).fill(.6);
  for (let z = 0; z <= size; z++) for (let x = 0; x <= size; x++) heat[z * stride + x] = .2 + x / 100;
  Object.assign(w, createFloraClimate(w.config, stride, w.ground, rain, heat));
  assert.ok(Math.abs(floraClimateAt(w, 45, 50).temperature - .65) < .006);
  assert.ok(Math.abs(floraClimateAt(w, 50, 50).temperature - .7) < .006);
});
