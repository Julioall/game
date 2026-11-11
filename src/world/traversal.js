import { gridSample } from './math.js';
import { sampleWater } from './terrain/water.js';
import { TRAVERSAL_PROFILE } from './catalog.js';

export const TRAVERSAL_TICK = TRAVERSAL_PROFILE.tick;

export function traversalSurface(world, x, z, profile = TRAVERSAL_PROFILE) {
  const limit = world.stride - 1;
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x > limit || z > limit) return null;
  const water = sampleWater(world, x, z);
  const ground = gridSample(world.ground, world.stride, x, z);
  const depth = water?.depth ?? 0;
  const mode = depth >= profile.swimDepth ? 'swim' : depth >= profile.wadeDepth ? 'wade' : 'walk';
  return { x, z, y: mode === 'swim' ? water.surface : ground, mode, water };
}

export function stepTraversal(world, actor, dx, dz, profile = TRAVERSAL_PROFILE) {
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;
  const magnitude = Math.hypot(dx, dz);
  if (!Number.isFinite(magnitude)) return null;
  const speed = profile[actor.mode + 'Speed'] / Math.max(1, magnitude);
  const drift = actor.mode === 'swim' ? profile.swimDrift : 0;
  const x = actor.x + (dx * speed + drift * (actor.water?.flowX ?? 0)) * profile.tick;
  const z = actor.z + (dz * speed + drift * (actor.water?.flowZ ?? 0)) * profile.tick;
  const distance = Math.hypot(x - actor.x, z - actor.z);
  if (!distance) return null;
  const next = traversalSurface(world, x, z, profile);
  if (!next) return null;
  // Compare water levels when entering or leaving swimming, so a deep bed is not a wall.
  const swimming = next.mode === 'swim' || actor.mode === 'swim';
  const from = (swimming ? actor.water?.surface : undefined) ?? actor.y;
  const to = (swimming ? next.water?.surface : undefined) ?? next.y;
  if (Math.abs(to - from) > distance * (swimming ? profile.waterGrade : profile.groundGrade)) return null;
  return next;
}
