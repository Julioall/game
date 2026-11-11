import { CHUNK, DEFAULT, HYDROLOGY_VERSIONS, LATEST_HYDROLOGY, MAX_MAP_SIZE, SETTINGS } from './catalog.js';
import { clamp } from './math.js';
import { ecology } from './ecology.js';
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
  config.hydrology = HYDROLOGY_VERSIONS.includes(input.hydrology) ? input.hydrology : LATEST_HYDROLOGY;
  return config;
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
    headwaterPonds: fields.headwaters.length, headwaterSteps: fields.headwaterSteps,
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
