import test from 'node:test';
import assert from 'node:assert/strict';
import plants from '../src/render/assets/megakit-plants.json' with { type: 'json' };
import { groundcoverModel } from '../src/world/groundcover.js';
import { natureGeometry, natureKey } from '../src/render/nature-models.js';
import { instances, modelBank } from '../src/render/vegetation.js';
import { chunkObjects } from '../src/world/vegetation.js';
import { Color, MeshBasicMaterial, Matrix4, Vector3 } from 'three';

test('groundcover uses only green plants while keeping dry and cold habitats unchanged', () => {
  const found = new Set();
  for (let x = 0; x < 1024; x += 17) for (let z = 0; z < 1024; z += 29) {
    for (const kind of ['grass', 'reed', 'shrub', 'flower']) for (let variant = 0; variant < 5; variant++) {
      const model = groundcoverModel(1769, x, z, 4, kind, variant);
      assert.equal(model, groundcoverModel(1769, x, z, 4, kind, variant));
      assert.ok(plants[model]); found.add(model);
    }
  }
  assert.equal(found.size, 12);
  assert.ok([...found].every(model => !/Flower|Mushroom/.test(model)));
  for (const biome of [1, 5, 6, 7, 8, 9])
    assert.equal(groundcoverModel(1769, 20, 50, biome, 'grass', 0), undefined);
  assert.equal(groundcoverModel(1769, 20, 50, 4, 'tree', 0), undefined);
  for (let variant = 0; variant < 5; variant++) for (const biome of [2, 5, 6, 8, 11]) {
    for (const kind of ['shrub', 'flower', 'reed']) {
      const key = natureKey({ kind, variant, biome }, 'spring');
      assert.ok(!/Berries|Flowers|Flower_|Plant_5/.test(key));
    }
  }
});

test('classic grass varies individual placement and models without switching whole cells on and off', () => {
  const stride = 33, length = stride ** 2;
  const world = { config: { size: 32, seed: 1769, vegetation: 1, hydrology: 4, relief: .64, style: 'spring' }, stride,
    ground: new Float32Array(length).fill(3), biome: new Uint8Array(length).fill(4),
    distance: new Uint8Array(length).fill(24), slope: new Float32Array(length) };
  const index = { roads: new Set(), fields: new Map(), districts: new Map(), buildings: new Map(), yards: new Map() };
  const objects = chunkObjects(world, index, 0, 0), grass = objects.filter(o => o.classicGrass);
  assert.ok(grass.length > 0);
  const cells = new Map();
  for (const o of grass) {
    assert.ok(o.grassPlacements.length > 0 && o.grassPlacements.length <= 30 * 6);
    const cell = o.id.split(':').slice(1, 3).join(':');
    if (!cells.has(cell)) cells.set(cell, { count: 0, variants: new Set() });
    cells.get(cell).count += o.grassPlacements.length / 6;
    cells.get(cell).variants.add(o.variant);
    for (let p = 0; p < o.grassPlacements.length; p += 6) {
      assert.ok(o.grassPlacements[p] >= 0 && o.grassPlacements[p] < 32);
      assert.ok(o.grassPlacements[p + 2] >= 0 && o.grassPlacements[p + 2] < 32);
      assert.equal(o.grassPlacements[p + 1], 3);
    }
  }
  assert.ok(cells.size > 32 * 32 * .2 && cells.size < 32 * 32 * .95,
    'cover must preserve vegetation and leave clearings');
  assert.ok(new Set([...cells.values()].map(c => c.count)).size > 5, 'density must vary across cells');
  assert.ok([...cells.values()].filter(c => c.variants.size > 1).length > cells.size * .5,
    'models must mix within cells instead of forming single-model tiles');
  assert.deepEqual(objects.filter(o => ['tree', 'rock'].includes(o.kind)), chunkObjects(world, index, 0, 0, { resourcesOnly: true }));
  const bank = modelBank('spring'), material = new MeshBasicMaterial();
  const meshes = instances(grass.slice(0, 2), bank, { solid: material, wind: material }, false);
  assert.equal(meshes.reduce((n, m) => n + m.count, 0), grass.slice(0, 2).reduce((n, o) => n + o.grassPlacements.length / 6, 0));
  const matrix = new Matrix4(), point = new Vector3();
  for (const mesh of meshes) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
    assert.equal(point.y, 3);
  }
  const farMeshes = instances(grass, bank, { solid: material, wind: material }, true);
  const farCount = farMeshes.reduce((n, mesh) => n + mesh.count, 0);
  assert.ok(farCount > 0, 'ground cover must remain visible in the distant LOD');
  assert.ok(farCount < grass.reduce((n, o) => n + o.grassPlacements.length / 6, 0),
    'distant ground cover must use fewer instances than the close view');
  const shrubs = instances([{ kind: 'shrub', variant: 0, x: 0, y: 0, z: 0, rotation: 0, scale: 1, plantWarmth: .5 }],
    bank, { wind: material, solid: material }, false);
  const color = new Color(); shrubs[0].getColorAt(0, color);
  assert.ok(color.g > .75 && color.g < .9 && color.r > color.g);
  for (const mesh of [...meshes, ...shrubs]) mesh.dispose();
  bank.clear(); material.dispose();
});

test('textured plant geometry preserves atlas UV, valid LOD and shared individual models', () => {
  const bank = modelBank('spring');
  for (const key of Object.keys(plants)) {
    const object = { kind: 'grass', variant: 0, plantModel: key, biome: 4 };
    const near = bank.get(object, false), far = natureGeometry(object, 'spring', true);
    assert.equal(near, bank.get({ ...object, scale: .4, heightScale: 1.3 }, false));
    assert.equal(near.userData.grassTufts, undefined);
    assert.ok(near.userData.megaPlant);
    assert.equal(near.attributes.uv.count, near.attributes.position.count);
    assert.deepEqual(near.attributes.uv.array, far.attributes.uv.array);
    assert.ok(far.index.count <= near.index.count);
    assert.ok(Math.abs(near.boundingBox.min.y) < 1e-5);
    assert.ok(near.boundingSphere.radius > 0 && Number.isFinite(near.boundingSphere.radius));
    for (const value of near.attributes.position.array) assert.ok(Number.isFinite(value));
    for (const index of far.index.array) assert.ok(index < far.attributes.position.count);
    for (let i = 0; i < near.attributes.uv.count; i++) {
      const u = near.attributes.uv.getX(i), v = near.attributes.uv.getY(i);
      assert.ok(u > 0 && u < 1 && v > 0 && v < 1);
    }
    far.dispose();
  }
  bank.clear();
});
