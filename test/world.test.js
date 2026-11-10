import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BIOMES, CHUNK, DEFAULT } from '../src/world/catalog.js';
import { chunkKey, indexTowns } from '../src/world/chunks.js';
import { chunkObjects } from '../src/world/vegetation.js';
import { generate, configuration } from '../src/world/generate.js';
import { buildable } from '../src/world/settlements.js';
import { WorldState } from '../src/world/state.js';
import { gridSample } from '../src/world/math.js';
import { crownOverlaps } from '../src/world/audit.js';

const world = generate();
const index = indexTowns(world);
const fingerprint = w => {
  const digest = createHash('sha256');
  for (const data of [w.ground, w.wet, w.flux, w.downstream, w.biome, w.slope, w.territory]) {
    digest.update(new Uint8Array(data.buffer));
  }
  return digest.update(JSON.stringify([w.towns, w.realms])).digest('hex');
};

test('the same configuration reproduces terrain, climate, rivers, and settlements', () => {
  assert.equal(fingerprint(world), fingerprint(generate(DEFAULT)));
  assert.notEqual(fingerprint(world), fingerprint(generate({ seed: 42 })));
  assert.equal(configuration({ size: 4, rivers: 8, seed: -1 }).size, 128);
  assert.equal(configuration({ size: 4, rivers: 8, seed: -1 }).rivers, 1);
  assert.equal(configuration({ size: 4, rivers: 8, seed: -1 }).seed, 4294967295);
});

test('drainage is acyclic, connected, downhill and conserves the accumulated flow', () => {
  const { order, downstream, filled, flux, river, raw, stride } = world;
  const rank = new Int32Array(order.length);
  order.forEach((i, j) => { rank[i] = j; });
  for (let i = 0; i < downstream.length; i++) {
    const j = downstream[i];
    if (j < 0) {
      assert.equal(j, -1);
      assert.ok(i % stride === 0 || i % stride === stride - 1 || i < stride || i >= raw.length - stride);
    } else {
      assert.ok(rank[j] < rank[i]);
      assert.ok(filled[j] <= filled[i]);
      assert.ok(flux[j] >= flux[i]);
      if (river[i]) assert.ok(world.wet[j] > 0);
    }
  }
  assert.equal(world.metrics.brokenRivers, 0);
  assert.ok(world.metrics.confluences > 0);
  assert.ok(world.metrics.falls > 0);
  assert.ok(world.metrics.lakes > 0);
  assert.ok(world.lake.reduce((a, b) => a + b) >= 80);
});

test('generated village has plausible access, structures, fields, and bridge banks', () => {
  const town = world.towns[0];
  assert.ok(town.buildings.length >= 5);
  assert.ok(town.roads.length > 20);
  assert.ok(town.fields.length > 0);
  assert.ok(town.bridge);
  const { a, b, deck } = town.bridge;
  assert.ok(world.wet[a] <= 0 && world.wet[b] <= 0);
  const step = a % world.stride === b % world.stride ? world.stride : 1;
  assert.ok((b - a) / step >= 4);
  let crossed = false;
  for (let i = a; i <= b; i += step) if (world.wet[i] > 0) {
    crossed = true;
    assert.ok(world.surface[i] < deck);
  }
  assert.ok(crossed);
  const bridgePath = town.bridge.walkway;
  assert.equal(bridgePath.edges.length, bridgePath.nodes.length - 1);
  assert.ok(bridgePath.nodes.slice(1, -1).every(p => p.y >= deck + .095));
  assert.equal(world.metrics.invalidSites, 0);
});

test('realms have colored capitals, clear courtyards, and roads through their gates', () => {
  assert.ok(world.realms.length >= 2);
  assert.ok(world.towns.filter(town => town.kind === 'village').length >= 2);
  const colors = new Set(world.realms.map(realm => realm.color));
  assert.equal(colors.size, world.realms.length);
  for (const realm of world.realms) {
    const town = world.towns[realm.capital];
    assert.equal(town.realm, realm.id);
    assert.equal(world.territory[town.z * world.stride + town.x], realm.id);
    assert.ok(town.buildings.length >= 7);
    for (const kind of ['market', 'inn', 'workshop', 'townhouse', 'chapel']) {
      assert.ok(town.buildings.some(b => b.kind === kind));
    }
    const { gate, pieces, bounds, entryDepth } = town.fort;
    const towers = pieces.filter(p => p.kind === 'tower');
    assert.equal(towers.length, 4);
    assert.ok(towers.every(p => p.width === 4.30 && p.depth === 4.30 &&
      p.walkY === towers[0].walkY && p.access.length === 2));
    const path = town.fort.walkway;
    const visited = new Set([path.entry]);
    for (const node of visited) for (const edge of path.edges) {
      if (edge.from === node) visited.add(edge.to);
      if (edge.to === node) visited.add(edge.from);
    }
    assert.ok([0, 1, 2, 3].every(node => visited.has(node)));
    const stairs = pieces.filter(p => p.kind === 'stairs');
    assert.deepEqual(stairs.map(p => p.tower).sort(), [0, 1, 2, 3]);
    assert.equal(new Set(stairs.map(p => p.side)).size, 2);
    assert.equal(path.edges.filter(e => e.kind === 'escada' && visited.has(e.from) && visited.has(e.to)).length, 4);
    for (const stair of stairs) {
      assert.notEqual(stair.side % 2, town.fort.side % 2);
      assert.equal(stair.landing.y, towers[stair.tower].walkY);
      assert.ok(Math.hypot(stair.landing.x - towers[stair.tower].x,
        stair.landing.z - towers[stair.tower].z) < towers[stair.tower].width / 2);
      assert.ok((stair.to.y - stair.from.y) / stair.steps <= .23);
      assert.ok(Math.hypot(stair.to.x - stair.from.x, stair.to.z - stair.from.z) / stair.steps >= .19);
    }
    assert.equal(pieces.filter(p => p.kind === 'gate').length, 1);
    assert.ok(pieces.some(p => p.kind === 'wall'));
    const keep = pieces.find(p => p.kind === 'keep');
    assert.equal(keep.frontX, gate.dx);
    assert.equal(keep.frontZ, gate.dz);
    assert.ok(Math.min(keep.x - keep.width / 2 - bounds.minX, bounds.maxX - keep.x - keep.width / 2,
      keep.z - keep.depth / 2 - bounds.minZ, bounds.maxZ - keep.z - keep.depth / 2) >= 2);
    assert.ok(entryDepth >= 4);
    const well = pieces.find(p => p.kind === 'well');
    if (well) assert.ok(Math.abs(gate.dx ? well.z - gate.z : well.x - gate.x) > 2);
    for (let d = -entryDepth; d <= 6; d++) {
      const i = (gate.z + gate.dz * d) * world.stride + gate.x + gate.dx * d;
      assert.ok(town.roads.includes(i));
      assert.equal(world.wet[i] > 0, false);
    }
    assert.match(new WorldState(world).placement(town.x, town.z), /castelo/);
  }
});

test('chunk ownership is unique and independent of order across the map', () => {
  const all = [], unique = new Set(), species = new Set(), ages = new Set();
  const count = world.config.size / CHUNK;
  for (let cz = count - 1; cz >= 0; cz--) for (let cx = 0; cx < count; cx++) {
    const objects = chunkObjects(world, index, cx, cz);
    assert.deepEqual(objects, chunkObjects(world, index, cx, cz));
    for (const o of objects) {
      assert.equal(chunkKey(o.x, o.z), cx + ',' + cz);
      assert.ok(!unique.has(o.id));
      unique.add(o.id);
      all.push(o);
      assert.equal(o.y, gridSample(world.ground, world.stride, o.x, o.z));
      if (o.kind === 'tree') {
        species.add(o.species);
        ages.add(o.age);
        const i = Math.round(o.z) * world.stride + Math.round(o.x);
        assert.ok(BIOMES[world.biome[i]].trees.includes(o.species));
        assert.ok(world.distance[i] >= 2 && world.slope[i] <= .66);
      }
    }
  }
  assert.ok(species.size >= 4 && ages.size > 30);
  assert.equal(crownOverlaps(all), 0);
  assert.ok(world.counts.filter(count => count > 0).length >= 10);
});

test('harvesting and building are local, cannot double spend, and restore from deltas', () => {
  const state = new WorldState(world);
  const before = fingerprint(world);
  const town = world.towns[0];
  const cx = Math.floor(town.x / CHUNK), cz = Math.floor(town.z / CHUNK);
  const objects = chunkObjects(world, index, cx, cz);
  const tree = objects.find(o => o.kind === 'tree' && o.age >= 28), rock = objects.find(o => o.kind === 'rock');
  assert.ok(tree && rock);
  const empty = state.snapshot();
  assert.equal(state.harvest({ ...tree, age: 840 }), null);
  assert.equal(state.harvest('t:0:0'), null);
  assert.deepEqual(state.snapshot(), empty);
  assert.equal(state.revision, 0);
  assert.equal(state.harvest(tree.id).chunk, chunkKey(tree.x, tree.z));
  assert.equal(state.harvest(tree.id), null);
  assert.ok(state.harvest(rock.id));
  assert.ok(state.construct(town.x, town.z).error);
  let lot;
  for (let dz = -15; dz <= 15 && !lot; dz++) for (let dx = -15; dx <= 15 && !lot; dx++) {
    const x = town.x + dx, z = town.z + dz;
    if (buildable(world, x, z, 1.52) && !state.placement(x, z)) lot = [x, z];
  }
  assert.ok(lot);
  assert.equal(state.construct(...lot).chunk, chunkKey(...lot));
  const snapshot = state.snapshot();
  assert.equal(snapshot.buildings.length, 1);
  assert.match(state.construct(...lot).error, /Libere espaço/);
  const restored = new WorldState(world, snapshot);
  assert.match(restored.construct(...lot).error, /Libere espaço/);
  assert.deepEqual(restored.snapshot(), snapshot);
  assert.equal(fingerprint(world), before);
});

test('extreme configuration disables optional features and supports the stress extent', () => {
  const dry = generate({ seed: 57, size: 128, vegetation: 0, rivers: 0, lakes: 0, settlements: 0 });
  assert.equal(dry.towns.length, 0);
  assert.equal(dry.realms.length, 0);
  assert.ok(dry.territory.every(owner => owner === 0));
  assert.equal(dry.metrics.lakes, 0);
  assert.equal(dry.metrics.riverEdges, 0);
  assert.ok(chunkObjects(dry, indexTowns(dry), 2, 2).every(o => o.kind === 'rock'));
  const large = generate({ size: 768, vegetation: 1, rivers: .78, seed: 9057 });
  assert.equal(large.stride, 769);
  assert.equal(large.metrics.brokenRivers, 0);
  assert.equal(large.metrics.invalidSites, 0);
  assert.ok(large.towns.filter(t => t.fort?.walkway.edges.filter(e => e.kind === 'escada').length === 4).length >= 3);
  const capitals = large.towns.filter(t => t.cityWall);
  assert.ok(capitals.length >= 1);
  assert.ok(large.towns.some(t => t.kind === 'manor' && !t.fort && !t.cityWall));
  assert.ok(large.towns.filter(t => !t.cityWall).every(t => t.buildings.every(b => !b.urban)));
  for (const town of capitals) {
    const { minX, maxX, minZ, maxZ } = town.cityWall.bounds;
    assert.equal(maxX - minX, 88);
    assert.equal(maxZ - minZ, 80);
    assert.equal(town.cityWall.pieces.filter(p => p.kind === 'tower').length, 12);
    assert.equal(town.cityWall.pieces.filter(p => p.kind === 'gate').length, 4);
    assert.ok(town.palace.great && town.palace.width === 12 && town.palace.depth === 10 && !town.fort);
    assert.equal(large.realms.find(r => r.id === town.realm).capital, town.id);
    const homes = town.buildings.filter(b => b.urban);
    assert.ok(homes.length >= 45);
    assert.ok(town.buildings.some(b => !b.urban && b.kind === 'cottage' && b.z > maxZ));
    assert.ok(homes.every(b => b.x > minX && b.x < maxX && b.z > minZ && b.z < maxZ));
    const rows = new Map();
    for (const home of homes) rows.set(home.z, (rows.get(home.z) ?? 0) + 1);
    assert.ok([...rows.values()].some(count => count >= 5));
    const roads = new Set(town.roads);
    const plaza = (town.z + 7) * large.stride + town.x;
    assert.ok(roads.has(plaza));
    const connected = new Set([plaza]);
    for (const i of connected) for (const j of [i - 1, i + 1, i - large.stride, i + large.stride]) {
      if (roads.has(j) && Math.abs(large.ground[i] - large.ground[j]) <= .63) connected.add(j);
    }
    assert.equal(new Set(town.cityWall.gates.map(g => [g.dx, g.dz].join(','))).size, 4);
    for (const gate of town.cityWall.gates) {
      for (let d = -4; d <= 4; d++) {
        const i = (gate.z + gate.dz * d) * large.stride + gate.x + gate.dx * d;
        assert.ok(connected.has(i));
      }
    }
  }
});

test('the maximum extent is exact and the compact transfer preserves the playable grid', () => {
  assert.equal(configuration({ size: 5000 }).size, 5000);
  assert.equal(configuration({ size: 6000 }).size, 5000);
  const config = { size: 128, seed: 3877961353, settlements: 0 };
  const full = generate(config);
  const compact = generate(config, { compact: true });
  for (const key of ['ground', 'surface', 'wet', 'slope', 'distance', 'biome', 'river', 'lake', 'territory']) {
    assert.deepEqual(compact[key], full[key]);
  }
  assert.equal(compact.raw, undefined);
  assert.ok(compact.landmarks.peak);
  assert.ok(compact.metrics.gridBytes < full.metrics.gridBytes);
});
