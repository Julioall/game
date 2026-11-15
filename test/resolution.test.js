import test from 'node:test';
import assert from 'node:assert/strict';
import { renderResolution } from '../src/render/resolution.js';

test('approaching the map adds detail without reducing distant quality', () => {
  for (const detail of ['crisp', 'balanced', 'atlas']) {
    const near = renderResolution(detail, 20, 1440, 900);
    const middle = renderResolution(detail, 32, 1440, 900);
    const far = renderResolution(detail, 112, 1440, 900);
    assert.ok(near.width > middle.width && middle.width > far.width);
    assert.ok(near.width <= 2880 && near.height <= 1800);
    assert.deepEqual(renderResolution(detail, 43, 1440, 900), far);
    assert.deepEqual(renderResolution(detail, 112, 1440, 900, true), near);
  }
  assert.deepEqual(renderResolution('balanced', 86, 1440, 900), { width: 2160, height: 1350, scale: 2 / 3 });
  assert.equal(renderResolution('atlas', 86, 1440, 900).width, 1440);
  assert.equal(renderResolution('balanced', 43, 1440, 900).width, 2160);
  assert.equal(renderResolution('balanced', 20, 1440, 900).width, 2880);
});
