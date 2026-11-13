import { createAnimal, listSpecies } from 'procedural-animals';
import { FAUNA_SPECIES } from '../src/world/fauna-catalog.js';
import { mkdir, writeFile } from 'node:fs/promises';
const report = [];
for (const species of Object.keys(FAUNA_SPECIES)) {
  let animal;
  try {
    animal = await createAnimal(species, {
      quality: 'crowd',
      seed: 1769,
      worker: false,
      ground: () => 0,
      water: () => 2
    });
    animal.move({ speed: 0.3, heading: 0 });
    animal.update(0.1);
    animal.move({ speed: 0 });
    animal.update(0.1);
    const actions = [...animal.actions],
      gaits = [...animal.gaits];
    const action = actions.includes('eat') ? 'eat' : actions.includes('burst') ? 'burst' : null;
    if (action) {
      void animal.play(action);
      animal.update(0.1);
      animal.stopAction();
      animal.update(0.1);
    }
    report.push({
      species,
      plan: animal.species.plan,
      actions,
      gaits,
      attachments: Object.keys(animal.attachments),
      vertices: animal.stats.vertices,
      ok: true
    });
    console.log(species + ': ' + actions.join(', '));
  } catch (error) {
    report.push({ species, ok: false, error: String(error) });
    process.exitCode = 1;
  } finally {
    animal?.dispose();
  }
}
const missing = listSpecies().filter((s) => !FAUNA_SPECIES[typeof s === 'string' ? s : s.id]);
await mkdir('playtest-output', { recursive: true });
await writeFile(
  'playtest-output/fauna-library-audit.json',
  JSON.stringify({ revision: 'c95ae49346aa8e140a924376cec6cf0073d99512', missing, report }, null, 2)
);
if (missing.length) process.exitCode = 1;
console.log(JSON.stringify({ tested: report.length, failed: report.filter((r) => !r.ok).length, missing }));
