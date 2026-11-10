import { STRUCTURES } from './catalog.js';
import { fortSite, insideFort, makeFort } from './fortifications.js';
import { hash } from './math.js';

export const CITY_HALF_X = 44, CITY_HALF_Z = 40;
const lanes = [-28, -16, 16, 28];

function planSites(world, settlements) {
  const { size, seed } = world.config;
  const { stride, ground, distance, slope } = world;
  const sites = [];
  const step = 4 * Math.ceil(size / 768);
  for (let z = 50; z <= size - 50; z += step) for (let x = 52; x <= size - 52; x += step) {
    if (settlements.some(t => t.cityWall ? insideFort(t.cityWall.bounds, x, z, 54)
      : Math.abs(x - t.x) < 70 && Math.abs(z - t.z) < 66)) continue;
    const site = fortSite(world, x, z, 7, 6);
    if (!site) continue;
    let low = Infinity, high = -Infinity, steep = 0, dry = true;
    for (let dz = -CITY_HALF_Z - 2; dz <= CITY_HALF_Z + 2 && dry; dz += 2) {
      for (let dx = -CITY_HALF_X - 2; dx <= CITY_HALF_X + 2; dx += 2) {
      const i = (z + dz) * stride + x + dx;
      if (distance[i] < 2) { dry = false; break; }
      low = Math.min(low, ground[i]);
      high = Math.max(high, ground[i]);
      if (slope[i] > .28) steep++;
      }
    }
    if (dry && high - low < 12 && steep < 530) {
      sites.push({ ...site, rank: (high - low) * 1.5 + steep * .03 + hash(seed, x, z, 281) });
    }
  }
  return sites.sort((a, b) => a.rank - b.rank);
}

function cityStreets(world, site, palace, gates) {
  const { stride, ground, distance } = world;
  const { x, z } = site;
  const at = (u, v) => (z + v) * stride + x + u;
  const isDry = (u, v) => distance[at(u, v)] >= 2;
  const candidates = new Set();
  const eligible = (u, v) => isDry(u, v) && !insideFort(palace.bounds, x + u, z + v);
  for (let v = -CITY_HALF_Z + 3; v <= CITY_HALF_Z - 3; v++) {
    for (let u = -CITY_HALF_X + 3; u <= CITY_HALF_X - 3; u++) {
    if (!eligible(u, v)) continue;
    const cross = lanes.some(k => Math.abs(k - v) <= 1);
    const lengthwise = lanes.some(k => Math.abs(k - u) <= 1);
    const avenue = Math.abs(u) <= 1 || Math.abs(v) <= 1;
    const plaza = Math.abs(u) <= 11 && Math.abs(v) <= 11;
    if (cross || lengthwise || avenue || plaza) candidates.add(at(u, v));
    }
  }
  const entries = [];
  for (const gate of gates) {
    const u = gate.x - x, v = gate.z - z;
    const first = at(u - gate.dx * 4, v - gate.dz * 4);
    let previous = first;
    for (let d = -4; d <= 4; d++) {
      const px = u + gate.dx * d, pz = v + gate.dz * d;
      const i = at(px, pz);
      if (!isDry(px, pz) || Math.abs(ground[i] - ground[previous]) > .63) return null;
      candidates.add(i);
      previous = i;
    }
    entries.push(previous);
  }
  // Keep only streets connected to the plaza and require access from all four gates.
  const plaza = at(0, Math.ceil(palace.depth / 2) + 2);
  if (!candidates.has(plaza)) return null;
  const roads = new Set([plaza]);
  for (const i of roads) for (const j of [i - 1, i + 1, i - stride, i + stride]) {
    if (candidates.has(j) && Math.abs(ground[i] - ground[j]) <= .63) roads.add(j);
  }
  return roads.size >= 680 && entries.every(i => roads.has(i)) ? roads : null;
}

function outerEnclosure(world, site, color) {
  const { stride, ground, distance } = world;
  const walls = makeFort({ ...site, halfX: CITY_HALF_X, halfZ: CITY_HALF_Z }, 2, color, true);
  for (const z of [walls.bounds.minZ, walls.bounds.maxZ]) for (const dx of [-20, 20]) {
    walls.pieces.push({ kind: 'tower', x: site.x + dx, z, width: 5.6, depth: 5.6, access: [[-1, 0], [1, 0]] });
  }
  for (const x of [walls.bounds.minX, walls.bounds.maxX]) for (const dz of [-18, 18]) {
    walls.pieces.push({ kind: 'tower', x, z: site.z + dz, width: 5.6, depth: 5.6, access: [[0, -1], [0, 1]] });
  }
  for (const piece of walls.pieces) {
    let high = -Infinity;
    for (let z = Math.floor(piece.z - piece.depth / 2); z <= Math.ceil(piece.z + piece.depth / 2); z++) {
      for (let x = Math.floor(piece.x - piece.width / 2); x <= Math.ceil(piece.x + piece.width / 2); x++) {
        const i = z * stride + x;
        if (distance[i] < 2) return null;
        high = Math.max(high, ground[i]);
      }
    }
    piece.walkY = Math.ceil((high + (piece.kind === 'gate' ? 4.3 : 4.75)) * 2) / 2;
  }
  return walls;
}

function cityLots(world, site, roads, palace, realm, id, buildable, route) {
  const { stride, ground } = world;
  const { x, z } = site;
  const buildings = [];
  const put = (kind, px, pz, urban) => {
    const { footprint } = STRUCTURES[kind], radius = footprint / 2;
    if (!buildable(world, px, pz, radius)) return false;
    if (buildings.some(b => Math.hypot(px - b.x, pz - b.z) < (b.footprint + footprint) / 2 + .12)) return false;
    for (let dz = -Math.floor(radius); dz <= radius; dz++) for (let dx = -Math.floor(radius); dx <= radius; dx++) {
      if (roads.has((pz + dz) * stride + px + dx)) return false;
    }
    buildings.push({ id: 'town-' + id + '-' + buildings.length, kind, footprint, x: px, z: pz,
      y: ground[pz * stride + px], banner: realm.color, urban });
    return true;
  };
  for (const [kind, u, v] of [['chapel', 13, 12], ['market', -7, 13], ['market', 7, 13], ['inn', -13, 12]]) {
    put(kind, x + u, z + v, true);
  }
  // Both sides of each transverse street use the same frontage grid.
  for (const v of lanes) for (const side of [-1, 1]) {
    const pz = z + v + side * 3;
    for (const u of [-35, -31, -23, -19, -11, -7, -3, 3, 7, 11, 19, 23, 31, 35]) {
      const px = x + u;
      if (insideFort(palace.bounds, px, pz, 2.7) || !roads.has((z + v) * stride + px)) continue;
      const roll = hash(world.config.seed, px, pz, 124);
      put(roll < .08 ? 'workshop' : roll > .95 ? 'inn' : 'townhouse', px, pz, true);
    }
  }
  for (const u of lanes) for (const side of [-1, 1]) {
    const px = x + u + side * 3;
    for (const v of [-23, -8, -4, 0, 4, 8, 23]) {
      const pz = z + v;
      if (insideFort(palace.bounds, px, pz, 2.7) || !roads.has(pz * stride + x + u)) continue;
      put('townhouse', px, pz, true);
    }
  }
  if (buildings.length < 45) return null;

  for (const side of [-1, 1]) {
    for (let u = 5; u <= 23; u += 4) {
      const px = x + side * u, pz = z + CITY_HALF_Z + 6 + (u % 3);
      const entrance = (pz - 2) * stride + px;
      if (world.distance[entrance] < 2) continue;
      const path = route(world, entrance, (z + CITY_HALF_Z + 4) * stride + x, (gx, gz) =>
        gz < z + CITY_HALF_Z + 3 || gz > z + CITY_HALF_Z + 10 || Math.abs(gx - x) > 24 ||
        buildings.some(b => !b.urban && Math.hypot(gx - b.x, gz - b.z) < b.footprint * .55) ||
        Math.hypot(gx - px, gz - pz) < 1.5, 400);
      if (path.length && put('cottage', px, pz, false)) for (const i of path) roads.add(i);
    }
  }
  return buildings.filter(b => !b.urban).length >= 2 ? buildings : null;
}

export function createMetropolis(world, settlements, realm, id, route, buildable) {
  if (world.config.size < 384) return null;
  for (const site of planSites(world, settlements).slice(0, 64)) {
    const cityWall = outerEnclosure(world, site, realm.color);
    if (!cityWall) continue;
    const { x, z } = site;
    const palace = { kind: 'keep', great: true, x, z, width: 12, depth: 10, frontX: 0, frontZ: 1, banner: realm.color,
      approachY: world.ground[(z + 7) * world.stride + x],
      bounds: { minX: x - 6, maxX: x + 6, minZ: z - 5, maxZ: z + 5 } };
    const roads = cityStreets(world, site, palace, cityWall.gates);
    if (!roads) continue;
    const paved = [...roads].filter(i => insideFort(cityWall.bounds, i % world.stride, Math.floor(i / world.stride)));
    const buildings = cityLots(world, site, roads, palace, realm, id, buildable, route);
    if (!buildings) continue;
    return { id, kind: 'city', x, z, realm: realm.id, palace, cityWall, buildings,
      roads: [...roads].sort((a, b) => a - b), paved, fields: [] };
  }
  return null;
}

export function nearMetropolis(town, x, z) {
  return town.cityWall && insideFort(town.cityWall.bounds, x, z, 26);
}
