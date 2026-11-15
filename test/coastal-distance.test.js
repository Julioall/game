import test from 'node:test';
import assert from 'node:assert/strict';
import { seaShoreDistance } from '../src/render/coast.js';
import { waterGeometry, outerOceanGeometry } from '../src/render/water-geometry.js';
import { COASTAL_FRONTS } from '../src/render/coastal-waves.js';

test('coastal fronts have distinct travel speeds as well as widths and periods', () => {
  const speeds = COASTAL_FRONTS.map(front => front.reach / front.period);
  assert.ok(Math.max(...speeds) / Math.min(...speeds) > 1.7);
  assert.equal(new Set(COASTAL_FRONTS.map(front => front.width)).size, 3);
  assert.equal(new Set(COASTAL_FRONTS.map(front => front.period)).size, 3);
});

function world(size = 64) {
  const stride = size + 1, n = stride ** 2;
  return { stride, config: { size }, ground: new Float32Array(n).fill(-2),
    wet: new Float32Array(n).fill(1), surface: new Float32Array(n), waterKind: new Uint8Array(n).fill(1) };
}

test('offshore distance follows a curved island instead of a global diagonal', () => {
  const w = world();
  for (let z = 0; z < 65; z++) for (let x = 0; x < 65; x++) {
    if (Math.hypot(x-32,z-32) > 12) continue;
    const i = z * 65 + x; w.ground[i] = .2; w.wet[i] = -1; w.waterKind[i] = 0;
  }
  const ground = w.ground.slice(), wet = w.wet.slice();
  const distance = seaShoreDistance(w);
  const ring = [[55,32],[32,55],[9,32],[32,9],[48,48],[16,48],[48,16],[16,16]];
  const samples = ring.map(([x,z]) => distance.sample(x,z));
  assert.ok(samples.every(d => d >= 10 && d <= 14));
  assert.ok(Math.max(...samples) - Math.min(...samples) < 3);
  assert.ok(distance.sample(62,32) > distance.sample(55,32));
  assert.equal(distance.sample(32,32), 0);
  assert.ok(distance.bytes < w.ground.byteLength / 3);
  assert.deepEqual(w.ground, ground);
  assert.deepEqual(w.wet, wet);
});

test('open sea with no coast has no artificial shoreline and borders interpolate continuously', () => {
  const w = world();
  assert.equal(seaShoreDistance(w).sample(32,32), 128);
  for (let z = 0; z < 65; z++) for (let x = 0; x <= 4; x++) {
    const i = z * 65 + x; w.wet[i] = -1; w.ground[i] = .2; w.waterKind[i] = 0;
  }
  w.coastDistance = seaShoreDistance(w);
  assert.equal(w.coastDistance.sample(24,32), 20);
  assert.ok(Math.abs(w.coastDistance.sample(24.5,32) - 20.5) < 1e-6);
  assert.equal(w.coastDistance.sample(-1,32), 128);
  const a = waterGeometry(w,0,0), b = waterGeometry(w,1,0);
  const edge = g => {
    const { position, shoreDistance } = g.attributes, values = new Set();
    for (let i = 0; i < position.count; i++) if (position.getX(i) === 32) {
      values.add(position.getZ(i) + ':' + shoreDistance.getX(i));
    }
    return [...values].sort();
  };
  assert.deepEqual(edge(a), edge(b));
  const outer = outerOceanGeometry(64);
  assert.ok(Array.from(outer.attributes.shoreDistance.array).every(v => v === 128));
  a.dispose(); b.dispose(); outer.dispose();
});
