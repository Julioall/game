import { STRUCTURES } from './catalog.js';
import { gridSample, hash } from './math.js';

export function dwellingPlan(building, world) {
  const { x, z, footprint, kind, urban } = building;
  const seed = world.config.seed;
  const roll = hash(seed, x, z, 532);
  const variation = hash(seed, x, z, 533);
  const thatch = !urban;
  const floors = kind === 'townhouse' && !urban ? 1 : STRUCTURES[kind].floors;
  const eaves = thatch ? .19 : .13;
  const width = footprint * (.77 + roll * .09), depth = footprint * (.66 + variation * .10);
  const story = 1.12 + variation * .17;
  const at = (px, pz) => gridSample(world.ground, world.stride, px, pz);
  const corners = [-1, 1].flatMap(dx => [-1, 1].map(dz => at(x + dx * width / 2, z + dz * depth / 2)));
  const base = Math.max(building.y, ...corners) + .07, bottom = Math.min(...corners) - .13;
  const offset = kind === 'workshop' ? 0 : -width * .18;
  const entrance = { offset, x: x + offset, y: base, z: z + depth / 2,
    width: Math.min(width * .39, kind === 'workshop' ? .82 : .56) };
  return { floors, eaves, width, depth, story, base, bottom, roll, variation, entrance };
}
