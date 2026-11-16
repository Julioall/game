import { FAUNA_SPECIES } from '../world/fauna-catalog.js';

export function animationPhase(id) {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

export function faunaProfile(record, focus, height, firstPerson = false) {
  const wide = !firstPerson && focus.span >= 66;
  const estimatedPixels = firstPerson ? Infinity
    : height / focus.span * (FAUNA_SPECIES[record.species]?.clearance ?? 1.2) * 1.2;
  // Preserve the library's normal 60 Hz pose update at every viewing distance.
  return { interval: 1 / 60, coverings: !wide || estimatedPixels >= 16 };
}
