import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameMetrics } from '../src/render/frame-metrics.js';

test('frame window reports mean FPS and real p95, not render CPU as frame time', () => {
  const stats = new FrameMetrics(100);
  for (let i = 0; i < 95; i++) stats.record(.016, 4);
  for (let i = 0; i < 5; i++) stats.record(.08, 7, 10, 10000000);
  const v = stats.snapshot();
  assert.equal(v.frameSamples, 100);
  assert.ok(v.fpsAverage > 40 && v.fpsAverage < 60);
  assert.ok(v.frameP95Ms >= 16 && v.frameP95Ms <= 81);
  assert.ok(v.frameWorstMs >= 79);
  assert.equal(v.longFrames, 5);
  assert.equal(v.jsHeapBytes, 10000000);
  assert.equal(v.gpuSamples, 5);
});

test('old samples are evicted with constant memory', () => {
  const stats = new FrameMetrics(4);
  for (let i = 0; i < 16; i++) stats.record(i < 4 ? .3 : .016, 2);
  assert.equal(stats.snapshot().frameSamples, 4);
  assert.ok(stats.snapshot().frameP95Ms < 17);
  assert.equal(stats.frames.length, 4);
  assert.equal(stats.snapshot().longFrames, 4); // Lifetime cumulative stalls.
});

test('no valid frame data is clearly null, not a fake FPS', () => {
  const stats = new FrameMetrics();
  stats.record(0, 3);
  stats.record(NaN, 3);
  assert.equal(stats.snapshot().fpsAverage, null);
  assert.equal(stats.snapshot().frameP95Ms, null);
});
