import test from 'node:test';
import assert from 'node:assert/strict';
import { closeRiverPockets } from '../src/world/terrain/river-pockets.js';

function field(holes) {
  const stride = 11, n = stride * stride;
  const wet = new Float32Array(n).fill(-1);
  const surface = new Float32Array(n).fill(1);
  const ground = new Float32Array(n).fill(1.08);
  const waterKind = new Uint8Array(n);
  const index = (x, z) => z * stride + x;
  for (let z = 2; z <= 8; z++) for (let x = 2; x <= 8; x++) {
    const i = index(x, z);
    wet[i] = .4; ground[i] = .72; waterKind[i] = 3;
  }
  for (const [x, z] of holes) {
    const i = index(x, z);
    wet[i] = -.4; ground[i] = 1.04; waterKind[i] = 0;
  }
  return { stride, wet, surface, ground, waterKind, index };
}

test('isolated dry raster pixel inside a river is submerged without touching the bank', () => {
  const w = field([[5, 5]]);
  const outside = w.index(1, 5), i = w.index(5, 5);
  assert.equal(closeRiverPockets(w), 1);
  assert.ok(w.wet[i] > 0);
  assert.ok(w.ground[i] < w.surface[i]);
  assert.ok(w.wet[outside] < 0);
});

test('two-cell river pinhole is healed but a four-cell island is preserved', () => {
  const small = field([[5, 5], [5, 6]]);
  assert.equal(closeRiverPockets(small), 2);
  const island = field([[5, 5], [5, 6], [6, 5], [6, 6]]);
  assert.equal(closeRiverPockets(island), 0);
  assert.equal(island.wet[island.index(5, 5)], -.4);
});

test('open shore, cliffs, foreign water and blocked cold terrain are untouched', () => {
  const shore = field([[2, 5]]);
  assert.equal(closeRiverPockets(shore), 0);
  const cliff = field([[5, 5]]);
  cliff.ground[cliff.index(5, 5)] = 2;
  assert.equal(closeRiverPockets(cliff), 0);
  const lakeEdge = field([[5, 5]]);
  lakeEdge.waterKind[lakeEdge.index(6, 5)] = 2;
  assert.equal(closeRiverPockets(lakeEdge), 0);
  const blocked = field([[5, 5]]);
  const cold = new Uint8Array(blocked.wet.length);
  cold[blocked.index(5, 5)] = 1;
  assert.equal(closeRiverPockets(blocked, { blocked: cold }), 0);
});
