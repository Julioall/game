import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, BoxGeometry, MeshBasicMaterial } from 'three';
import { VegetationBatches } from '../src/render/vegetation-batches.js';
import { GpuDensityBudget, GpuTimer } from '../src/render/gpu-timer.js';
import { animationPhase, faunaProfile } from '../src/render/fauna-budget.js';
import { renderResolution } from '../src/render/resolution.js';

test('vegetation merges adjacent chunks and updates visibility and harvested resources', () => {
  const scene = new Scene(), geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const bank = { get: () => geometry };
  const batches = new VegetationBatches(scene, bank, { solid: material, wind: material });
  const object = i => ({ id: 'rock:' + i, kind: 'rock', x: i * 32, y: 3, z: 0, scale: 1, rotation: 0, variant: 0 });
  for (const [i, key] of ['0,0', '1,0', '0,1', '1,1'].entries()) batches.setChunk(key, [object(i)], false, true);
  batches.flush();
  assert.equal(scene.children.length, 1);
  assert.equal(batches.diagnostics().vegetationDraws, 1);
  assert.equal(scene.children[0].children[0].count, 4);
  batches.setVisible('1,0', false);
  batches.setChunk('0,0', [], false, true);
  batches.flush();
  assert.equal(scene.children[0].children[0].count, 2);
  batches.removeChunk('0,1');
  batches.removeChunk('1,1');
  batches.flush();
  assert.equal(scene.children.length, 0);
  batches.dispose();
  geometry.dispose(); material.dispose();
});

test('vegetation only rebuilds changed cells and preserves shared geometry ownership', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  const batches = new VegetationBatches(scene, { get: () => geometry }, { wind: material });
  const object = { kind: 'tree', species: 'oak', variant: 0, x: 0, y: 0, z: 0, rotation: 0, scale: 1 };
  batches.setChunk('0,0', [object], false, true);
  batches.setChunk('2,0', [object], false, true);
  batches.flush();
  const rebuilds = batches.rebuilds;
  batches.setVisible('0,0', true);
  batches.flush();
  assert.equal(batches.rebuilds, rebuilds);
  batches.dispose();
  assert.equal(disposed, 0);
  geometry.dispose(); material.dispose();
});

test('animation phases spread work while every animal keeps native 60 Hz movement', () => {
  const phases = Array.from({ length: 32 }, (_, i) => animationPhase('fauna:' + i));
  assert.ok(new Set(phases.map(x => Math.floor(x * 8))).size >= 4);
  const focus = { x: 0, z: 0, span: 112 };
  assert.equal(faunaProfile({ species: 'rat', x: 55, z: 0 }, focus, 900).interval, 1 / 60);
  assert.equal(faunaProfile({ species: 'rat', x: 1, z: 0 }, focus, 900).interval, 1 / 60);
  assert.equal(faunaProfile({ species: 'pig', x: 55, z: 0 }, focus, 900).interval, 1 / 60);
  assert.equal(faunaProfile({ species: 'rat', x: 55, z: 0 }, focus, 900, true).interval, 1 / 60);
  assert.equal(faunaProfile({ species: 'pig', x: 1, z: 0 }, focus, 900).coverings, false);
  assert.equal(faunaProfile({ species: 'pig', x: 1, z: 0 }, { ...focus, span: 30 }, 900).coverings, true);
});

test('supersampling only drops on sustained measured GPU pressure and recovers', () => {
  const budget = new GpuDensityBudget();
  for (let i = 1; i <= 90; i++) budget.observe(null, 4, i, true);
  assert.equal(budget.cap, 1.5);
  for (let i = 91; i <= 180; i++) budget.observe(5, 10, i, true);
  assert.equal(budget.cap, 1.5, 'CPU-bound frames do not lower resolution');
  for (let i = 181; i <= 270; i++) budget.observe(10, 3, i, true);
  assert.ok(Math.abs(budget.cap - 1.25) < 1e-8);
  assert.equal(renderResolution('balanced', 112, 1200, 800, false, budget.cap).width, 1500);
  assert.equal(renderResolution('balanced', 20, 1200, 800, false, budget.cap).width, 2400);
  for (let i = 271; i <= 360; i++) budget.observe(3, 3, i, true);
  assert.equal(budget.cap, 1.5);
});

test('GPU timing polls without blocking and discards disjoint measurements', () => {
  let available = false, disjoint = false, results = 0, deleted = 0;
  const gl = { QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2,
    getExtension: () => ({ GPU_DISJOINT_EXT: 3, TIME_ELAPSED_EXT: 4 }),
    getParameter: () => disjoint,
    createQuery: () => ({}), beginQuery() {}, endQuery() {}, deleteQuery() { deleted++; },
    getQueryParameter: (_, name) => name === 1 ? available : (results++, 2500000) };
  const timer = new GpuTimer(gl);
  for (let i = 0; i < 8; i++) { timer.begin(); timer.end(); }
  assert.equal(results, 0, 'never requests a result before availability');
  available = true;
  for (let i = 0; i < 4; i++) { timer.begin(); timer.end(); }
  assert.equal(timer.average(), 2.5);
  assert.equal(timer.serial, 2);
  disjoint = true;
  for (let i = 0; i < 4; i++) { timer.begin(); timer.end(); }
  assert.equal(timer.average(), null);
  assert.equal(timer.pending.length, 0);
  assert.equal(deleted, 3);
  timer.dispose();
});

test('GPU timing remains unavailable without the timer extension', () => {
  const timer = new GpuTimer({ getExtension: () => null });
  timer.begin(); timer.end(); timer.dispose();
  assert.equal(timer.average(), null);
});
