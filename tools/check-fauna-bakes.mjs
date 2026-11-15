import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createAnimal } from 'procedural-animals';
import { FAUNA_SPECIES } from '../src/world/fauna-catalog.js';

const manifest = JSON.parse(await readFile('public/fauna/manifest.json', 'utf8'));
assert.equal(manifest.models.length, Object.keys(FAUNA_SPECIES).length * 2);
const expected = new Set(Object.keys(FAUNA_SPECIES).flatMap(species => [1769, 1770].map(seed => `${species}:${seed}`)));
for (const model of manifest.models) {
  assert.ok(expected.delete(`${model.species}:${model.seed}`), 'unique species and appearance');
  const compressed = await readFile('public/fauna/' + model.file);
  assert.equal(createHash('sha256').update(compressed).digest('hex'), model.sha256);
  const bytes = gunzipSync(compressed);
  const baked = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const animal = await createAnimal(model.species, { baked, quality: 'low', worker: false, ground: () => 0, water: () => 2 });
  try {
    assert.equal(animal.seed, model.seed);
    assert.equal(animal.stats.vertices, model.vertices);
    animal.move({ speed: .3, heading: 0 });
    animal.update(.1);
    animal.move({ speed: 0 });
    animal.update(.1);
    assert.ok([animal.position.x, animal.position.y, animal.position.z].every(Number.isFinite));
  } finally { animal.dispose(); }
}
assert.equal(expected.size, 0);
console.log(`Validated ${manifest.models.length} baked animals: hashes, seeds, geometry, motion and disposal.`);
