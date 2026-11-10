import { worldLandmarks } from './landmarks.js';

function freezeRecord(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeRecord(child);
    Object.freeze(value);
  }
  return value;
}

export const immutableCopy = value => freezeRecord(structuredClone(value));

const gridFields = ['ground', 'wet', 'surface', 'biome', 'slope', 'distance', 'lake', 'river', 'raw', 'territory'];

export function readOnlyWorld(world) {
  const { config, stride, realms, metrics } = world;
  const towns = world.towns.map(({ id, name, kind, realm, x, z, bridge, fort, cityWall, buildings }) => ({
    id, name, kind, realm, x, z, bridge, buildingCount: buildings.length,
    fort: fort && { bounds: fort.bounds, gate: fort.gate, walkway: fort.walkway },
    cityWall: cityWall && { bounds: cityWall.bounds }
  }));
  const metadata = immutableCopy({ config, stride, towns, realms, metrics, landmarks: worldLandmarks(world) });
  const view = { ...metadata };
  for (const name of gridFields) {
    const field = world[name];
    if (field) view[name] = Object.freeze({ at: index => field[index] });
  }
  return Object.freeze(view);
}
