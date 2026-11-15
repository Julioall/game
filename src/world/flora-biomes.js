import { hash, clamp } from './math.js';
import { floraClimateAt } from './flora-climate.js';

export const FLORA_BIOMES = Object.freeze({
  temperate: { name: 'Bosque temperado', color: '#68844c' },
  boreal: { name: 'Bosque boreal', color: '#718b80' },
  snowy: { name: 'Bosque nevado', color: '#bac9c2' },
  conifer: { name: 'Floresta de coníferas', color: '#446c57' },
  riparian: { name: 'Mata ciliar', color: '#547f53' },
  wetland: { name: 'Bosque alagadiço', color: '#607b54' },
  dry: { name: 'Bosque seco', color: '#a09161' },
  palm: { name: 'Palmeiral quente', color: '#9aab68' }
});

const sample = (field, index) => ArrayBuffer.isView(field) ? field[index] : field?.at(index);

function freshwaterNearby(world, x, z, shore) {
  if (!world.waterKind) return true; // Compatibility with older/generated test worlds.
  const radius = Math.min(8, Math.ceil(shore) + 1);
  const cx = Math.round(x), cz = Math.round(z);
  let distance = Infinity, kind = 0;
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    const px = cx + dx, pz = cz + dz, d2 = dx * dx + dz * dz;
    if (px < 0 || pz < 0 || px > world.config.size || pz > world.config.size || d2 >= distance) continue;
    const value = sample(world.waterKind, pz * world.stride + px);
    if (value) { distance = d2; kind = value; }
  }
  return kind >= 2;
}

export function floraBiomeAt(world, x, z, climate = null) {
  const i = Math.round(z) * world.stride + Math.round(x);
  const biome = sample(world.biome, i);
  if ([0, 1, 9].includes(biome) || biome === undefined) return null;
  climate ??= floraClimateAt(world, x, z);
  const { temperature, moisture, elevation, shore, slope } = climate;
  // Water availability takes precedence over upland forest labels.
  if (biome === 11 && shore <= 5 && slope <= .25 && freshwaterNearby(world, x, z, shore)) return 'wetland';
  if (biome === 10 && shore <= 8 && moisture >= .55 && freshwaterNearby(world, x, z, shore)) return 'riparian';
  if (temperature < .25 || biome === 8 && temperature < .36) return 'snowy';
  if (biome === 7 && temperature < .52) return 'conifer';
  if (temperature < .44) return 'boreal';
  if (temperature > .67 && elevation < 8 && moisture > .42 && shore < 16) return 'palm';
  if ([5, 6].includes(biome) || moisture < .4) return 'dry';
  return 'temperate';
}

const renderSpecies = { CommonTree: 'oak', BirchTree: 'birch', PineTree: 'pine', Willow: 'willow', PalmTree: 'palm' };

export function treeFlora(world, object) {
  const climate = floraClimateAt(world, object.x, object.z);
  const biome = floraBiomeAt(world, object.x, object.z, climate);
  if (!biome) return { biome };
  const px = Math.floor(object.x / 128), pz = Math.floor(object.z / 128);
  const choice = hash(world.config.seed, Math.round(object.x * 10), Math.round(object.z * 10), 812);
  let family;
  if (biome === 'temperate') family = choice < .72 ? 'CommonTree' : 'BirchTree';
  else if (biome === 'boreal' || biome === 'conifer' || biome === 'snowy') {
    const pineShare = .55 + clamp((.44 - climate.temperature) / .2) * .35;
    family = choice < pineShare ? 'PineTree' : 'BirchTree';
  } else if (biome === 'wetland') family = 'Willow';
  else if (biome === 'riparian') family = choice < (climate.temperature < .35 ? .3 : .7) ? 'Willow' : 'BirchTree';
  else if (biome === 'palm') family = choice < .8 ? 'PalmTree' : 'CommonTree';
  if (!family) return { biome, renderSpecies: 'acacia' };
  const snow = biome === 'snowy' || climate.temperature < .25;
  const dead = family !== 'PalmTree' && family !== 'PineTree' && object.age >= 65
    && hash(world.config.seed, Math.floor(object.x / 32), Math.floor(object.z / 32), 810) < .055
    && object.variant === 4;
  const variants = family === 'PalmTree' ? 4 : 5;
  const offset = Math.floor(hash(world.config.seed, px, pz, 811) * variants);
  const variant = dead ? offset : (offset + object.variant % 2) % variants;
  const season = family === 'PalmTree' ? '' : dead ? (snow ? '_Dead_Snow' : '_Dead')
    : snow ? '_Snow' : world.config.style === 'autumn' ? '_Autumn' : '';
  return { biome, family, renderSpecies: renderSpecies[family], variant, season, dead };
}
