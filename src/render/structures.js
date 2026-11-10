import * as T from 'three';
import { gridSample } from '../world/math.js';
import { dwelling, market } from './dwellings.js';
import { chapel, keepModel, fortPiece } from './fortifications.js';
import { buildBridge } from './bridges.js';
import { combine } from './mesh-parts.js';

function house(parts, building, world) {
  const { x, z, kind } = building;
  if (kind === 'market') {
    market(parts, building, world);
  } else if (kind === 'chapel') {
    chapel(parts, building, world);
  } else if (kind === 'manor') {
    const at = (px, pz) => gridSample(world.ground, world.stride, px, pz);
    const corners = [-2.25, 2.25].flatMap(dx => [-1.8, 1.8].map(dz => at(x + dx, z + dz)));
    keepModel(parts, { x, z, width: 4.5, depth: 3.6, frontX: 0, frontZ: 1, banner: '#8b6b4b' },
      Math.min(...corners) - .18, Math.max(building.y, ...corners));
  } else {
    dwelling(parts, building, world);
  }
}

export function structuresMesh(buildings, bridges, forts, world, material) {
  const parts = [];
  for (const building of buildings) house(parts, building, world);
  for (const bridge of bridges) buildBridge(parts, bridge, world);
  for (const piece of forts) fortPiece(parts, piece, world);
  if (!parts.length) return null;
  for (const part of parts) {
    if (!part.hasAttribute('craft')) part.setAttribute('craft', new T.Float32BufferAttribute(part.attributes.position.count * 3, 3));
  }
  return new T.Mesh(combine(parts), material);
}
