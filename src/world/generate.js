import { createNoise2D } from 'simplex-noise';
import { BIOMES, CHUNK, DEFAULT, MAX_MAP_SIZE, SETTINGS } from './catalog.js';
import { clamp, hash, mix, random, smooth } from './math.js';
import { drain, DX, DZ } from './drainage.js';
import { settle } from './settlements.js';
import { auditWorld } from './audit.js';
import { assignTerritories } from './fortifications.js';
import { worldLandmarks } from './landmarks.js';

export function configuration(input = {}) {
  const config = { ...DEFAULT };
  if (Number.isSafeInteger(input.seed)) config.seed = input.seed >>> 0;
  if (Number.isFinite(input.size)) {
    config.size = input.size >= MAX_MAP_SIZE ? MAX_MAP_SIZE
      : clamp(CHUNK * Math.round(input.size / CHUNK), CHUNK * 4, MAX_MAP_SIZE);
  }
  for (const key of Object.keys(SETTINGS)) {
    if (Number.isFinite(input[key])) config[key] = clamp(input[key]);
  }
  if (['autumn', 'spring'].includes(input.style)) config.style = input.style;
  if (['crisp', 'balanced', 'atlas'].includes(input.detail)) config.detail = input.detail;
  return config;
}

function geography(config, stride) {
  const { seed, size } = config;
  const count = stride ** 2;
  const raw = new Float32Array(count), rain = new Float32Array(count), heat = new Float32Array(count);
  const noise = createNoise2D(random(seed));
  const lakeX = .43 + .12 * hash(seed, 4, 4), lakeZ = .38 + .12 * hash(seed, 4, 5);
  const mountainAngle = mix(-.87, -.28, hash(seed, 8, 1));
  const sea = 0, vertical = .63 + .68 * config.relief;

  for (let z = 0; z < stride; z++) for (let x = 0; x < stride; x++) {
    const u = x / size, v = z / size, i = z * stride + x;
    const warp = noise(u * 2.8 + 9, v * 2.8) * .050;
    const warp2 = noise(u * 2.8, v * 2.8 - 9) * .045;
    const px = u + warp, pz = v + warp2;
    const broad = noise(px * 3.3, pz * 3.3);
    const axis = (px - .34) * Math.sin(mountainAngle) + (pz - .24) * Math.cos(mountainAngle);
    const long = (px - .34) * Math.cos(mountainAngle) - (pz - .24) * Math.sin(mountainAngle);
    const chain = Math.exp(-axis * axis * 67 - long * long * 15);
    const folds = (1 - Math.abs(noise(px * 7 - 5, pz * 7 + 6))) ** 2;
    const ridge = chain * (13 + 29 * folds);
    const detail = noise(px * 9 + 7, pz * 9) * (1.1 + chain * 2.4)
      + noise(u * 22, v * 22) * (.34 + chain * 1.2) + noise(x * .084, z * .084) * (.10 + chain * .25);
    const plateau = smooth(.36, .62, noise(px * 4 + 11, pz * 4 + 6)) * 4.6;
    const edge = Math.min(u, v, 1 - u, 1 - v);
    const coast = Math.min(px, pz, 1 - px, 1 - pz);
    const inland = smooth(-.055, .22, coast) * smooth(0, .075, edge);
    let elevation = (7.6 + broad * 3.7 + detail + ridge + plateau) * inland
      - (1 - inland) * (1.65 + config.water * 8.2) - config.water * 1.35;

    if (config.lakes > 0) {
      // A warped glacial cirque adds an inland depression. Drainage determines
      // its actual shoreline, spill elevation and outlet.
      const radius = Math.hypot((u - lakeX) / 1.22, v - lakeZ)
        + noise(u * 16 + 11, v * 16) * .017;
      const bowl = smooth(.105 + config.lakes * .04, .038, radius);
      const floor = 3.1 + noise(u * 10, v * 10) * .52 - config.lakes * 2.6;
      elevation = mix(elevation, floor, bowl * .99);
      const out = v - lakeZ;
      const meander = lakeX + Math.sin(out * 17) * .036 + out * .24;
      const floodplain = (1 - smooth(.016, .079, Math.abs(u - meander)))
        * smooth(.047, .145, out) * smooth(.025, .14, edge);
      const valley = 5.4 - out * 13 + noise(u * 12 + 5, v * 12) * .42;
      elevation = mix(elevation, Math.min(elevation, valley), floodplain * .96);
    }
    raw[i] = elevation * vertical;
    rain[i] = clamp(.49 + config.climate * .25 + noise(px * 5, pz * 5 + 13) * .31
      + (1 - u) * .13 - smooth(.46, .88, u) * .19 + smooth(3, 20, elevation) * .17, .12, 1);
    heat[i] = clamp(.95 - (1 - v) * .42 - Math.max(0, elevation) * .025
      + noise(u * 4, v * 4 + 15) * .13);
  }
  return { raw, rain, heat, sea };
}

function markLakes(raw, filled, stride, sea, frequency) {
  const lake = new Uint8Array(raw.length);
  const visited = new Uint8Array(raw.length);
  let count = 0;
  if (!frequency) return { lake, count };
  for (let i = 0; i < raw.length; i++) {
    if (visited[i] || filled[i] < sea + .12 || filled[i] - raw[i] < .075) continue;
    const group = [i], level = filled[i];
    let deepest = 0;
    visited[i] = 1;
    for (let p = 0; p < group.length; p++) {
      const j = group[p], x = j % stride, z = Math.floor(j / stride);
      deepest = Math.max(deepest, level - raw[j]);
      for (let k = 0; k < 4; k++) {
        const a = x + DX[k], b = z + DZ[k], n = b * stride + a;
        if (a < 0 || a >= stride || b < 0 || b >= stride || visited[n]) continue;
        if (filled[n] === level && level - raw[n] >= .075) {
          group.push(n);
          visited[n] = 1;
        }
      }
    }
    if (group.length < mix(115, 21, frequency) * ((stride - 1) / 256) ** 1.5 || deepest < .47) continue;
    count++;
    for (const j of group) lake[j] = 1;
  }
  return { lake, count };
}

function waterFields(config, raw, drainage, lake, stride, sea) {
  const { downstream, filled, flux, slope } = drainage;
  const surface = new Float32Array(raw.length), wet = new Float32Array(raw.length).fill(-1.4);
  const ground = raw.slice(), river = new Uint8Array(raw.length), falls = [];
  const threshold = mix(220, 27, config.rivers) * (config.size / 256) ** 1.32;
  let edges = 0, confluences = 0;
  const feeders = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] <= sea) {
      wet[i] = Math.max(.03, Math.min(1.4, sea - raw[i]));
      surface[i] = sea;
    } else if (lake[i]) {
      wet[i] = Math.max(.03, Math.min(1.4, filled[i] - raw[i]));
      surface[i] = filled[i];
    }
    if (config.rivers && flux[i] >= threshold && downstream[i] >= 0 && raw[i] > sea && !lake[i]) {
      river[i] = 1;
      feeders[downstream[i]]++;
      edges++;
    }
  }

  function elevation(i) {
    return lake[i] || raw[i] <= sea ? filled[i] : filled[i] - .16;
  }

  for (let i = 0; i < raw.length; i++) {
    if (!river[i]) continue;
    if (feeders[i] > 1) confluences++;
    const j = downstream[i];
    const x = i % stride, z = Math.floor(i / stride);
    const jx = j % stride, jz = Math.floor(j / stride);
    const dx = jx - x, dz = jz - z, len2 = dx * dx + dz * dz;
    const start = elevation(i), end = Math.min(start, elevation(j));
    const width = clamp(.41 + Math.sqrt(flux[i]) * .045, .68, 2.85);
    if (slope[i] > .96 && width > .94) falls.push({ i, j, start, end, width });
    const radius = Math.ceil(width + 1);
    for (let nz = Math.max(0, z - radius); nz <= Math.min(stride - 1, z + radius); nz++) {
      for (let nx = Math.max(0, x - radius); nx <= Math.min(stride - 1, x + radius); nx++) {
        const k = nz * stride + nx;
        if (lake[k] || raw[k] <= sea) continue;
        const t = clamp(((nx - x) * dx + (nz - z) * dz) / len2);
        const distance = Math.hypot(nx - x - dx * t, nz - z - dz * t);
        const influence = width - distance;
        if (influence <= wet[k]) continue;
        const level = mix(start, end, t);
        wet[k] = influence;
        surface[k] = level;
        if (influence >= 0) ground[k] = Math.min(ground[k], level - .18 - Math.min(influence, 1) * .47);
        else if (influence > -1) ground[k] = Math.min(ground[k], mix(level + .18, raw[k], -influence));
      }
    }
  }
  for (let i = 0; i < raw.length; i++) if (wet[i] <= 0) {
    const x = i % stride, z = Math.floor(i / stride);
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], nz = z + DZ[k], j = nz * stride + nx;
      if (nx < 0 || nz < 0 || nx >= stride || nz >= stride) continue;
      if (lake[j] || raw[j] <= sea) wet[i] = Math.max(wet[i], Math.min(-.02, surface[j] - ground[i]));
    }
    surface[i] = ground[i];
  }
  return { wet, surface, ground, river, falls, edges, confluences };
}

function ecology(config, stride, fields, rain, heat, slope = new Float32Array(fields.wet.length),
  queue = new Int32Array(fields.wet.length)) {
  const { wet, ground } = fields;
  const distance = new Uint8Array(wet.length).fill(255);
  const biome = new Uint8Array(wet.length);
  let size = 0;
  for (let i = 0; i < wet.length; i++) if (wet[i] > 0) {
    distance[i] = 0;
    queue[size++] = i;
  }
  for (let p = 0; p < size; p++) {
    const i = queue[p], x = i % stride, z = Math.floor(i / stride);
    if (distance[i] >= 24) continue;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], nz = z + DZ[k], j = nz * stride + nx;
      if (nx < 0 || nz < 0 || nx >= stride || nz >= stride || distance[j] !== 255) continue;
      distance[j] = distance[i] + 1;
      queue[size++] = j;
    }
  }

  const counts = new Uint32Array(BIOMES.length);
  const noise = createNoise2D(random(config.seed ^ 0x59332));
  for (let i = 0; i < ground.length; i++) {
    const x = i % stride, z = Math.floor(i / stride);
    const dx = (ground[i + (x < stride - 1 ? 1 : 0)] - ground[i - (x > 0 ? 1 : 0)]) / 2;
    const dz = (ground[i + (z < stride - 1 ? stride : 0)] - ground[i - (z > 0 ? stride : 0)]) / 2;
    const incline = slope[i] = Math.hypot(dx, dz);
    const moisture = rain[i] + .2 * (1 - smooth(1, 17, distance[i])) + noise(x / 14, z / 14) * .14;
    const elevation = ground[i] / (.63 + .68 * config.relief);
    let b = 2;
    if (wet[i] > 0) b = 0;
    else if (elevation > 27 || (heat[i] < .15 && elevation > 21)) b = 9;
    else if (elevation > 20 && incline < .82) b = 8;
    else if (incline > .83 || elevation > 17) b = 7;
    else if (distance[i] <= 1 && (elevation < 2.8 || moisture < .55)) b = 1;
    else if (distance[i] <= 3 && incline < .2 && elevation < 5 && moisture > .76) b = 11;
    else if (distance[i] <= 5 && moisture > .64) b = 10;
    else if (moisture > .74) b = 4;
    else if (moisture > .57) b = 3;
    else if (moisture < .39 && heat[i] > .49) b = 6;
    else if (moisture < .52 && heat[i] > .51) b = 5;
    biome[i] = b;
    counts[b]++;
  }
  return { distance, slope, biome, counts };
}

export function generate(input = {}, { compact = false, onProgress } = {}) {
  const started = performance.now();
  const config = configuration(input);
  const stride = config.size + 1;
  onProgress?.('Gerando o relevo');
  const { raw, rain, heat, sea } = geography(config, stride);
  onProgress?.('Calculando os rios e os lagos');
  const drainage = drain(raw, rain, stride, sea);
  const { lake, count } = markLakes(raw, drainage.filled, stride, sea, config.lakes);
  const fields = waterFields(config, raw, drainage, lake, stride, sea);
  onProgress?.('Distribuindo os biomas');
  const ecologyFields = compact ? ecology(config, stride, fields, rain, heat, drainage.slope, drainage.order)
    : ecology(config, stride, fields, rain, heat);
  const world = { config, stride, raw, lake, rain, heat, ...drainage, ...fields, ...ecologyFields };
  onProgress?.('Posicionando as vilas e cidades');
  Object.assign(world, settle(world));
  world.territory = assignTerritories(world, world.realms);
  const audit = auditWorld(world);
  if (compact) {
    world.landmarks = worldLandmarks(world);
    for (const field of ['raw', 'filled', 'rain', 'heat', 'order', 'downstream', 'flux', 'falls']) delete world[field];
  }
  world.metrics = {
    generationMs: performance.now() - started, lakes: count, riverEdges: fields.edges,
    confluences: fields.confluences, falls: fields.falls.length,
    realms: world.realms.length, cities: world.towns.filter(t => t.fort || t.cityWall).length,
    villages: world.towns.filter(t => t.kind === 'village').length,
    manors: world.towns.filter(t => t.kind === 'manor').length,
    metropolises: world.towns.filter(t => t.cityWall).length,
    ...audit,
    gridBytes: Object.values(world).reduce((n, v) => n + (ArrayBuffer.isView(v) ? v.byteLength : 0), 0)
  };
  return world;
}
