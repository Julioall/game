import { hash } from './math.js';

// Presentation metadata only: no change to resource IDs or placement channels.
export function groundcoverModel(seed, x, z, biome, kind, variant) {
  if ([1, 5, 6, 7, 8, 9].includes(biome)) return undefined;
  const region = Math.floor(hash(seed, Math.floor(x / 96), Math.floor(z / 96), 872) * 4);
  const pick = hash(seed, Math.floor(x * 10), Math.floor(z * 10), 873);
  let name;
  if (kind === 'grass') {
    const grasses = ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall'];
    name = pick < .12 ? `Clover_${variant % 2 + 1}` : grasses[(region + variant % 2) % grasses.length];
  } else if (kind === 'reed') {
    name = ['Fern_1', 'Plant_1', 'Plant_1_Big', 'Plant_7', 'Plant_7_Big'][(region + variant % 2) % 5];
  } else if (kind === 'shrub') {
    name = 'Bush_Common';
  } else if (kind === 'flower') {
    name = `Clover_${variant % 2 + 1}`;
  }
  return name ? 'Mega_' + name : undefined;
}
