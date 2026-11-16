import { FAUNA_SPECIES } from '../world/fauna-catalog.js';

// Full coats/breeds are currently most noticeable in herds and small farm animals.
// Keep the old prepared two-seed path for the other species.
const DIVERSE_SPECIES = new Set(['cow', 'fox', 'chicken']);

function hashText(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++)
    value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}

function mixSeed(value) {
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

/** Deterministic per-actor model options, independent of creation order and camera. */
export function faunaAppearanceOptions(record) {
  if (!DIVERSE_SPECIES.has(record.species))
    return { seed: 1769 + ((record.seed >>> 0) % 2) };

  const variants = FAUNA_SPECIES[record.species].variants;
  const individual = mixSeed((record.seed >>> 0) ^ hashText(String(record.id)) ^ hashText(record.species));
  return {
    // A small reusable morph pool prevents one unique, expensive mesh per actor.
    seed: 1769 + (mixSeed(individual ^ 0x85ebca77) % 2),
    variant: variants[mixSeed(individual ^ 0x9e3779b1) % variants.length]
  };
}
