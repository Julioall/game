import { hash } from './math.js';

export const TOWER_DIAMETER = 4.30;
export const WALL_WIDTH = 1.55;
const WALL_JOIN = 1.82;

export function fortSite(world, x, z, halfX, halfZ) {
  const { stride, ground, distance, slope } = world;
  let low = Infinity, high = -Infinity, grade = 0;
  for (let dz = -halfZ - 1; dz <= halfZ + 1; dz++) {
    for (let dx = -halfX - 1; dx <= halfX + 1; dx++) {
      const i = (z + dz) * stride + x + dx;
      if (distance[i] < 2 || slope[i] > .72) return null;
      low = Math.min(low, ground[i]);
      high = Math.max(high, ground[i]);
      grade += slope[i];
    }
  }
  if (high - low > 3.3) return null;
  for (const a of [-halfX, halfX]) for (const b of [-halfZ, halfZ]) {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.hypot(dx, dz) <= TOWER_DIAMETER / 2 &&
        distance[(z + b + dz) * stride + x + a + dx] < 2) return null;
    }
  }
  const beyond = world.ground[(z - halfZ - 6) * stride + x] + world.ground[(z + halfZ + 6) * stride + x] +
    world.ground[z * stride + x - halfX - 6] + world.ground[z * stride + x + halfX + 6];
  const prominence = ground[z * stride + x] - beyond * .25;
  return { x, z, halfX, halfZ, rank: grade / ((halfX * 2 + 3) * (halfZ * 2 + 3)) * 23
    - prominence * .85 - Math.min(high, 15) * .18 + hash(world.config.seed, x, z, 162) * 2 };
}

export function makeFort(site, side, banner, cityWall = false) {
  const { x, z, halfX, halfZ } = site;
  const bounds = { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
  const corners = [[bounds.minX, bounds.minZ], [bounds.maxX, bounds.minZ],
    [bounds.maxX, bounds.maxZ], [bounds.minX, bounds.maxZ]];
  const pieces = [];
  const diameter = cityWall ? 5.6 : TOWER_DIAMETER;
  const thickness = cityWall ? 2.4 : WALL_WIDTH;
  const join = cityWall ? 2.33 : WALL_JOIN;
  for (const [corner, [tx, tz]] of corners.entries()) {
    const adjacent = [corners[(corner + 1) % 4], corners[(corner + 3) % 4]];
    const access = adjacent.map(([x, z]) => [Math.sign(x - tx), Math.sign(z - tz)]);
    pieces.push({ kind: 'tower', x: tx, z: tz, width: diameter, depth: diameter, access, banner });
  }
  const gateScale = cityWall ? 1.35 : 1;
  const gateWidth = 4 * gateScale;
  let gate;
  const gates = [];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
    const alongX = az === bz, length = Math.abs(bx - ax) + Math.abs(bz - az);
    const dx = (bx - ax) / length, dz = (bz - az) / length;
    const at = t => [ax + dx * t, az + dz * t];
    const wall = (from, to) => {
      const count = Math.ceil((to - from) / (cityWall ? 4 : 3));
      for (let n = 0; n < count; n++) {
        const span = (to - from) / count, [x, z] = at(from + (n + .5) * span);
        pieces.push({ kind: 'wall', x, z, length: span, alongX, outX: dz, outZ: -dx,
          thickness, width: alongX ? span : thickness, depth: alongX ? thickness : span });
      }
    };
    if (!cityWall && k !== side) {
      wall(join, length - join);
      continue;
    }
    const [gx, gz] = at(length / 2);
    const opening = { x: gx, z: gz, dx: dz, dz: -dx };
    if (k === side) gate = opening;
    gates.push(opening);
    pieces.push({ kind: 'gate', x: gx, z: gz, alongX, outX: dz, outZ: -dx, banner, gateScale,
      width: alongX ? 4.3 * gateScale : 1.9 * gateScale, depth: alongX ? 1.9 * gateScale : 4.3 * gateScale });
    wall(join, (length - gateWidth) / 2);
    wall((length + gateWidth) / 2, length - join);
  }
  if (cityWall) return { bounds, gate, gates, pieces };
  const compact = halfX < 7;
  const radius = gate.dx ? halfX : halfZ;
  const setback = radius * .18;
  const broad = compact ? 3.5 : 5.15, deep = compact ? 2.8 : 4.2;
  const keep = { kind: 'keep', x: x - gate.dx * setback, z: z - gate.dz * setback,
    width: gate.dx ? deep : broad, depth: gate.dx ? broad : deep, banner, frontX: gate.dx, frontZ: gate.dz };
  pieces.push(keep);
  if (halfX >= 8) {
    const side = (gate.dx ? halfZ : halfX) * .53, fore = radius * .30;
    pieces.push({ kind: 'well', x: x + gate.dz * side + gate.dx * fore,
      z: z - gate.dx * side + gate.dz * fore, width: 1.75, depth: 1.75 });
  }
  const entryDepth = radius - Math.ceil(deep / 2 - setback + .3);
  return { x, z, bounds, gate, side, entryDepth, pieces };
}

export function insideFort(bounds, x, z, margin = 0) {
  return x >= bounds.minX - margin && x <= bounds.maxX + margin &&
    z >= bounds.minZ - margin && z <= bounds.maxZ + margin;
}

export function insideFortFootprint(bounds, x, z, margin) {
  if (insideFort(bounds, x, z, margin)) return true;
  const dx = Math.min(Math.abs(x - bounds.minX), Math.abs(x - bounds.maxX));
  const dz = Math.min(Math.abs(z - bounds.minZ), Math.abs(z - bounds.maxZ));
  return Math.hypot(dx, dz) < TOWER_DIAMETER / 2 + margin;
}

const HOUSES = [
  ['Vale do Salgueiro', '#be7552'], ['Marca da Garça', '#528f9c'],
  ['Coroa de Freixo', '#b99d54'], ['Serra do Veado', '#8c75a3'],
  ['Terras do Cedro', '#72965e'], ['Coroa do Pinhal', '#a46474']
];
const TOWN_NAMES = ['Pedra Clara', 'Ponte Velha', 'Porta do Vale', 'Monte Alvo', 'Freixial', 'Pedra Alta',
  'Vale Longo', 'Ninho da Garça', 'Vila do Amieiro', 'Alto da Ribeira', 'Fonte Fria', 'Vale Dourado',
  'Pinhal Novo', 'Pedra Rubra', 'Foz do Freixo', 'Campo do Lobo', 'Ponte do Carvalho', 'Vila do Prado'];

export function realmIdentity(seed, index) {
  const [name, color] = HOUSES[(index + Math.floor(hash(seed, 31, 14) * HOUSES.length)) % HOUSES.length];
  return { id: index + 1, name, color, capital: null };
}

export function townName(seed, index) {
  return TOWN_NAMES[(index + Math.floor(hash(seed, 31, 15) * TOWN_NAMES.length)) % TOWN_NAMES.length]
    + (index >= TOWN_NAMES.length ? ' ' + (Math.floor(index / TOWN_NAMES.length) + 1) : '');
}

export function assignTerritories(world, realms) {
  const owner = new Uint8Array(world.ground.length);
  const seats = realms.map(realm => [realm.id, world.towns.find(t => t.id === realm.capital)]).filter(([, t]) => t);
  const { stride, wet } = world;
  for (let i = 0; i < owner.length; i++) {
    if (wet[i] > 0) continue;
    const x = i % stride, z = Math.floor(i / stride);
    let nearest = Infinity;
    for (const [id, seat] of seats) {
      const distance = (seat.x - x) ** 2 + (seat.z - z) ** 2;
      if (distance >= nearest) continue;
      nearest = distance;
      owner[i] = id;
    }
  }
  return owner;
}
