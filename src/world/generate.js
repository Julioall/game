import { createNoise2D } from 'simplex-noise';
import { BIOMES, CHUNK, DEFAULT, MAX_MAP_SIZE, SETTINGS } from './catalog.js';
import { clamp, random, smooth } from './math.js';
import { DX, DZ } from './terrain/drainage.js';
import { geography } from './terrain/relief.js';
import { hydrology } from './terrain/hydrology.js';
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
  const relief = geography(config, stride);
  const { raw, rain, heat } = relief;
  onProgress?.('Calculando os rios e os lagos');
  const { drainage, lake, count, fields } = hydrology(config, stride, relief);
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
