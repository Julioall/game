import FlatQueue from 'flatqueue';
import { STRUCTURES } from './catalog.js';
import { DX, DZ } from './terrain/drainage.js';
import { buildable } from './terrain/placement.js';
import { hash, gridSample } from './math.js';
import { fortSite, insideFort, makeFort, realmIdentity, townName } from './fortifications.js';
import { bridgeWalkway, layFortWalkway } from './walkways.js';
import { createMetropolis, nearMetropolis } from './metropolis.js';

export function route(world, from, to, blocked = () => false, budget = 2400) {
  if (from === to) return [from];
  const { stride, wet, ground } = world;
  const goalX = to % stride, goalZ = Math.floor(to / stride);
  const queue = new FlatQueue();
  const costs = new Map([[from, 0]]), parent = new Map();
  queue.push(from, 0);
  while (queue.length && budget-- > 0) {
    const i = queue.pop();
    if (i === to) {
      const path = [i];
      while (path.at(-1) !== from) path.push(parent.get(path.at(-1)));
      return path.reverse();
    }
    const x = i % stride, z = Math.floor(i / stride);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], nz = z + DZ[k], j = nz * stride + nx;
      if (nx < 1 || nz < 1 || nx >= stride - 1 || nz >= stride - 1 || wet[j] > 0 || blocked(nx, nz, j)) continue;
      const grade = Math.abs(ground[j] - ground[i]);
      if (grade > .63) continue;
      const cost = costs.get(i) + 1 + 7 * grade * grade;
      if (cost >= (costs.get(j) ?? Infinity)) continue;
      costs.set(j, cost);
      parent.set(j, i);
      queue.push(j, cost + Math.abs(nx - goalX) + Math.abs(nz - goalZ));
    }
  }
  return [];
}

function crossings(world) {
  const { stride, wet, ground, distance, flux, river, lake, slope, config } = world;
  const candidates = [];
  const middle = (stride - 1) / 2;
  for (let i = 0; i < river.length; i++) {
    if (!river[i] || lake[i] || slope[i] > .24) continue;
    if (config.hydrology >= 2 && world.surface[i] - ground[i] < .25) continue;
    const x = i % stride, z = Math.floor(i / stride);
    if (Math.min(x, z, stride - 1 - x, stride - 1 - z) < 20) continue;
    for (const step of [1, stride]) {
      let a = i, b = i;
      while (i - a < step * 7 && distance[a] < 2 && !lake[a]) a -= step;
      while (b - i < step * 7 && distance[b] < 2 && !lake[b]) b += step;
      const span = (b - a) / step;
      if (distance[a] !== 2 || distance[b] !== 2 || span < 4 || span > 11) continue;
      if (Math.abs(ground[a] - ground[b]) > .85 || ground[i] < .65) continue;
      let maxWater = -Infinity, crossed = 0, flat = 0;
      for (let p = a + step; p < b; p += step) if (wet[p] > 0) {
        maxWater = Math.max(maxWater, world.surface[p]);
        crossed++;
      }
      if (crossed < 2 || maxWater > Math.min(ground[a], ground[b]) + .58) continue;
      for (let dz = -10; dz <= 10; dz += 2) for (let dx = -10; dx <= 10; dx += 2) {
        const j = i + dz * stride + dx;
        if (distance[j] >= 2 && world.slope[j] < .22 && ground[j] > 1) flat++;
      }
      const score = flat * .42 - Math.hypot(x - middle, z - middle) * .13 + Math.log2(flux[i]) * 1.3
        - span * .55 + hash(config.seed, x, z, step) * 2.5;
      candidates.push({ i, a, b, deck: Math.max(ground[a], ground[b], maxWater + .30) + .18, score });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function createTown(world, i, bridge, number) {
  const { stride, config, ground } = world;
  const x = i % stride, z = Math.floor(i / stride);
  const town = { id: number, kind: 'village', name: townName(config.seed, number), x, z, bridge,
    buildings: [], roads: new Set(), fields: [] };
  const plots = [];
  for (let dz = -20; dz <= 20; dz += 2) for (let dx = -20; dx <= 20; dx += 2) {
    const px = x + dx, pz = z + dz;
    if (Math.hypot(dx, dz) < 4 || !buildable(world, px, pz, 2.1)) continue;
    plots.push({ x: px, z: pz, rank: Math.hypot(dx, dz) + world.slope[pz * stride + px] * 20
      + hash(config.seed, px, pz, 78) * 6 });
  }
  plots.sort((a, b) => a.rank - b.rank);
  for (const p of plots) {
    const kind = ['hall', 'cottage', 'workshop', 'cottage', 'inn'][town.buildings.length] ?? 'cottage';
    const footprint = STRUCTURES[kind].footprint;
    if (town.buildings.some(b => Math.hypot(p.x - b.x, p.z - b.z) < 5.6)) continue;
    const access = p.z * stride + p.x + 2;
    const ends = bridge ? [bridge.a, bridge.b].sort((a, b) =>
      Math.hypot(a % stride - p.x, Math.floor(a / stride) - p.z) -
      Math.hypot(b % stride - p.x, Math.floor(b / stride) - p.z)) : [i];
    const path = route(world, access, ends[0]);
    if (!path.length) continue;
    for (const step of path) town.roads.add(step);
    town.buildings.push({ kind, x: p.x, z: p.z, footprint, id: 'town-' + number + '-' + town.buildings.length,
      y: gridSample(ground, stride, p.x, p.z) });
    if (town.buildings.length >= 7 + Math.round(config.settlements * 6)) break;
  }
  if (bridge) {
    town.roads.add(bridge.a);
    town.roads.add(bridge.b);
  }
  for (const p of plots) {
    if (p.rank < 11 || town.buildings.some(b => Math.hypot(p.x - b.x, p.z - b.z) < 5.5) ||
      town.fields.some(f => Math.hypot(p.x - f.x, p.z - f.z) < 7) ||
      [...town.roads].some(r => Math.abs(p.x - r % stride) <= 3 && Math.abs(p.z - Math.floor(r / stride)) <= 3)) continue;
    town.fields.push({ x: p.x, z: p.z });
    if (town.fields.length === 3) break;
  }
  town.roads = [...town.roads].sort((a, b) => a - b);
  return town;
}

function placeVillages(world, towns, desired) {
  const { stride, config, distance, slope, ground } = world;
  const count = () => towns.filter(t => t.kind === 'village').length;
  const tooClose = (x, z) => towns.some(t => nearMetropolis(t, x, z) ||
    Math.hypot(t.x - x, t.z - z) < (t.fort ? 43 : 58));
  if (count() >= desired) return;
  for (const bridge of crossings(world)) {
    const { i } = bridge, x = i % stride, z = Math.floor(i / stride);
    if (tooClose(x, z)) continue;
    const town = createTown(world, i, bridge, towns.length);
    if (town.buildings.length >= 4) towns.push(town);
    if (count() >= desired) return;
  }
  if (count() < desired) {
    const candidates = [];
    const step = 3 * Math.ceil(config.size / 768);
    for (let z = 21; z < stride - 21; z += step) for (let x = 21; x < stride - 21; x += step) {
      const i = z * stride + x;
      if (ground[i] < 1 || !buildable(world, x, z, 3)) continue;
      const score = -Math.abs(distance[i] - 5) - slope[i] * 15 - Math.hypot(x - stride / 2, z - stride / 2) * .12;
      candidates.push({ i, x, z, score });
    }
    for (const { i, x, z } of candidates.sort((a, b) => b.score - a.score)) {
      if (tooClose(x, z)) continue;
      const town = createTown(world, i, null, towns.length);
      if (town.buildings.length < 4) continue;
      towns.push(town);
      if (count() >= desired) break;
    }
  }
}

function gateApproaches(world, site, color) {
  const { stride, ground, distance } = world;
  const approaches = [];
  // Prefer south and east on ties so the opening is visible from the camera.
  for (const [order, side] of [2, 1, 3, 0].entries()) {
    const fort = makeFort(site, side, color);
    const { x, z, dx, dz } = fort.gate;
    const road = [];
    for (let step = -fort.entryDepth; step <= 6; step++) {
      const i = (z + dz * step) * stride + x + dx * step;
      if (distance[i] < 2 || (road.length && Math.abs(ground[i] - ground[road.at(-1)]) > .63)) break;
      road.push(i);
    }
    if (road.length !== fort.entryDepth + 7) continue;
    approaches.push({ fort, road, ax: x + dx * 6, az: z + dz * 6, order });
  }
  return approaches;
}

function urbanPlots(world, site, approach) {
  const { config, stride, slope } = world;
  const { fort, ax, az } = approach;
  const plots = [];
  const radius = site.halfX >= 7 ? 24 : 18;
  for (let dz = -radius; dz <= radius; dz += 2) for (let dx = -radius; dx <= radius; dx += 2) {
    const x = site.x + dx, z = site.z + dz;
    if (insideFort(fort.bounds, x, z, 3.5) || !buildable(world, x, z, 2.1)) continue;
    const distance = Math.hypot(x - ax, z - az);
    if (distance > radius + 3) continue;
    const rank = distance + slope[z * stride + x] * 12 + hash(config.seed, x, z, 153) * 4;
    plots.push({ x, z, rank });
  }
  return plots.sort((a, b) => a.rank - b.rank);
}

function plotOccupancy(occupied, stride, building) {
  const { x, z, footprint } = building;
  const radius = footprint * .52;
  for (let dz = Math.ceil(-radius); dz <= radius; dz++) {
    for (let dx = Math.ceil(-radius); dx <= radius; dx++) occupied.add((z + dz) * stride + x + dx);
  }
}

function createCity(world, site, realm, number) {
  const { config, stride, ground, wet } = world;
  const target = site.halfX >= 7 ? 14 + Math.round(config.settlements * 9) : 9 + Math.round(config.settlements * 6);
  const approaches = gateApproaches(world, site, realm.color).map(a => ({ ...a, plots: urbanPlots(world, site, a) }));
  approaches.sort((a, b) => b.plots.length - a.plots.length + (a.order - b.order) * 3);
  for (const { fort, road, plots, ax, az } of approaches) {
    const buildings = [], roads = new Set(road), occupied = new Set();
    const end = road.at(-1), civic = ['market', 'inn', 'workshop', 'townhouse', 'market', 'chapel', 'workshop'];
    const blocked = (x, z, i) => occupied.has(i) || insideFort(fort.bounds, x, z, 1);
    for (const { x, z } of plots) {
      const kind = civic[buildings.length] ?? (buildings.length % 3 ? 'townhouse' : 'cottage');
      const { footprint } = STRUCTURES[kind];
      if (buildings.some(b => Math.hypot(b.x - x, b.z - z) < (b.footprint + footprint) * .64 + .7)) continue;
      const building = { kind, x, z, footprint, id: 'town-' + number + '-' + buildings.length,
        y: gridSample(ground, stride, x, z), banner: realm.color };
      const lot = new Set();
      plotOccupancy(lot, stride, building);
      if ([...lot].some(i => roads.has(i))) continue;
      const reach = Math.ceil(footprint * .52);
      const entrances = [[x, z + reach], [x + reach, z], [x - reach, z], [x, z - reach]]
        .sort(([a, b], [c, d]) => Math.hypot(a - ax, b - az) - Math.hypot(c - ax, d - az));
      let path = [];
      for (const [px, pz] of entrances) {
        const start = pz * stride + px;
        if (blocked(px, pz, start) || wet[start] > 0) continue;
        path = route(world, start, end, (x, z, i) => blocked(x, z, i) || lot.has(i), 640);
        if (path.length) break;
      }
      if (!path.length) continue;
      buildings.push(building);
      for (const i of lot) occupied.add(i);
      for (const i of path) roads.add(i);
      if (buildings.length >= target) break;
    }
    if (buildings.length < (site.halfX >= 7 ? 10 : 7)) continue;
    if (!layFortWalkway(world, fort, route)) continue;
    return { id: number, kind: 'city', name: townName(config.seed, number), realm: realm.id, x: site.x, z: site.z,
      fort, buildings, roads: [...roads].sort((a, b) => a - b), fields: [], approach: end };
  }
  return null;
}

function placeCities(world, towns, realms) {
  const { config, stride, distance, slope } = world;
  const desired = Math.min(6, Math.max(1, Math.round(config.size / 138 + config.settlements * 1.4)));
  const maximumCities = config.size >= 704 ? 2 : 1;
  for (let n = 0; n < maximumCities; n++) {
    const realm = realmIdentity(config.seed, realms.length);
    const metropolis = createMetropolis(world, towns, realm, towns.length, route, buildable);
    if (!metropolis) break;
    metropolis.name = townName(config.seed, metropolis.id);
    realm.capital = metropolis.id;
    realm.rank = 'reino';
    realms.push(realm);
    towns.push(metropolis);
  }
  const seats = towns.filter(t => t.cityWall);
  let forts = seats.length;
  if (forts >= desired) return;
  for (const [halfX, halfZ] of [[10, 9], [8, 7], [7, 6], [6, 5], [5, 4], [4, 3]]) {
    const margin = halfX + 8, candidates = [];
    const step = (halfX <= 5 ? 2 : 3) * Math.ceil(config.size / 768);
    for (let z = margin; z <= config.size - margin; z += step) for (let x = margin; x <= config.size - margin; x += step) {
      const i = z * stride + x;
      if (distance[i] < halfX + 1 || slope[i] > .48 ||
        towns.some(t => nearMetropolis(t, x, z) || Math.hypot(t.x - x, t.z - z) < (t.fort ? 54 : 43))) continue;
      const site = fortSite(world, x, z, halfX, halfZ);
      if (site) candidates.push(site);
    }
    const rejected = [];
    for (const site of candidates.sort((a, b) => a.rank - b.rank)) {
      if (towns.some(t => nearMetropolis(t, site.x, site.z) || Math.hypot(t.x - site.x, t.z - site.z) < (t.fort ? 54 : 43)) ||
        rejected.some(p => Math.hypot(p.x - site.x, p.z - site.z) < (halfX <= 6 ? 4 : 9))) continue;
      const nearest = seats.length ? seats.reduce((best, t) =>
        Math.hypot(t.x - site.x, t.z - site.z) < Math.hypot(best.x - site.x, best.z - site.z) ? t : best) : null;
      const realm = nearest ? realms.find(r => r.id === nearest.realm) : realmIdentity(config.seed, realms.length);
      const city = createCity(world, site, realm, towns.length);
      if (!city) {
        rejected.push(site);
        continue;
      }
      if (!nearest) {
        realm.capital = city.id;
        realm.rank = 'dominio';
        realms.push(realm);
      }
      towns.push(city);
      if (++forts >= desired) return;
    }
  }
}

function placeManors(world, towns) {
  const { config, stride, ground, distance, slope } = world;
  const limit = 1 + Math.floor(config.size / 245);
  const candidates = [];
  const tooClose = (x, z) => towns.some(t => nearMetropolis(t, x, z) || Math.hypot(t.x - x, t.z - z) < 29);
  const step = 6 * Math.ceil(config.size / 768);
  for (let z = 12; z < config.size - 12; z += step) for (let x = 12; x < config.size - 12; x += step) {
    const i = z * stride + x;
    if (distance[i] < 5 || slope[i] > .25 || tooClose(x, z) || !buildable(world, x, z, 2.4)) continue;
    const edge = ground[i + 7] + ground[i - 7] + ground[i + 7 * stride] + ground[i - 7 * stride];
    const rank = (ground[i] - edge / 4) * 1.6 + hash(config.seed, x, z, 166) - slope[i];
    candidates.push({ x, z, rank });
  }
  let count = 0;
  for (const { x, z } of candidates.sort((a, b) => b.rank - a.rank)) {
    if (tooClose(x, z)) continue;
    const id = towns.length;
    const building = (kind, x, z, n) => ({ kind, x, z, footprint: STRUCTURES[kind].footprint,
      y: ground[z * stride + x], id: 'town-' + id + '-' + n });
    const buildings = [building('manor', x, z, 0)];
    const roads = new Set();
    for (const [dx, dz] of [[-6, 5], [5, 5], [7, -2]]) {
      const px = x + dx, pz = z + dz;
      const entry = (pz + 2) * stride + px, door = (z + 3) * stride + x;
      if (!buildable(world, px, pz, 1.5) || world.wet[entry] > 0 || world.wet[door] > 0) continue;
      const path = route(world, entry, door, (gx, gz) => Math.hypot(px - gx, pz - gz) < 1.5 ||
        buildings.some(b => Math.hypot(b.x - gx, b.z - gz) < b.footprint * .59), 390);
      if (!path.length) continue;
      buildings.push(building('cottage', px, pz, buildings.length));
      for (const i of path) roads.add(i);
    }
    towns.push({ id, x, z, kind: 'manor', name: 'Solar de ' + townName(config.seed, id), buildings,
      roads: [...roads], fields: [] });
    if (++count >= limit) return;
  }
}

function assignVillages(towns, realms) {
  for (const town of towns) {
    if (town.realm || !realms.length) continue;
    const seats = realms.map(realm => towns[realm.capital]);
    const nearest = seats.reduce((best, city) =>
      Math.hypot(city.x - town.x, city.z - town.z) < Math.hypot(best.x - town.x, best.z - town.z) ? city : best);
    town.realm = nearest.realm;
  }
}

export function settle(world) {
  if (!world.config.settlements) return { towns: [], realms: [] };
  const towns = [], realms = [];
  placeVillages(world, towns, 1);
  placeCities(world, towns, realms);
  placeVillages(world, towns, 1 + Math.round(world.config.settlements * world.config.size / 100));
  placeManors(world, towns);
  if (!realms.length && towns.length) {
    const realm = realmIdentity(world.config.seed, 0);
    realm.capital = towns[0].id;
    realm.rank = 'dominio';
    towns[0].realm = realm.id;
    realms.push(realm);
  }
  assignVillages(towns, realms);
  for (const town of towns) {
    if (town.bridge) town.bridge.walkway = bridgeWalkway(world, town.bridge);
  }
  return { towns, realms };
}
