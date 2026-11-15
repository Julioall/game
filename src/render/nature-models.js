import * as T from 'three';
import models from './assets/nature.json' with { type: 'json' };
import plants from './assets/megakit-plants.json' with { type: 'json' };
import { SPECIES } from '../world/catalog.js';

const families = { oak: 'CommonTree', birch: 'BirchTree', pine: 'PineTree', willow: 'Willow' };
const groundCover = ['Grass', 'Grass_2', 'Grass_Short'];

function woodDecoration(kind, object) {
  const suffix = object.biome === 8 || object.biome === 9 ? '_Snow'
    : object.biome === 10 || object.biome === 11 ? '_Moss' : '';
  return kind === 'stump' ? `TreeStump${suffix}` : `WoodLog${suffix}`;
}

function decode(text, Type) {
  const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
  return new Type(bytes.buffer);
}

export function natureKey(object, style) {
  if (object.plantModel && plants[object.plantModel]) return object.plantModel;
  const variant = object.variant ?? 0;
  if (object.kind === 'rock') {
    const family = object.rockStyle === 'snow' ? 'Rock_Snow'
      : object.rockStyle === 'moss' ? 'Rock_Moss' : 'Rock';
    return `${family}_${variant % 7 + 1}`;
  }
  if (object.kind === 'tree' && object.flora?.renderSpecies === 'acacia') return null;
  if (object.kind === 'tree' && object.flora?.family)
    return `${object.flora.family}${object.flora.season}_${object.flora.variant + 1}`;
  if (object.kind === 'shrub') {
    if (object.biome === 8 || object.biome === 9) return `Bush_Snow_${variant % 2 + 1}`;
    if (object.biome === 5 || object.biome === 6) return `Cactus_${variant % 5 + 1}`;
    return `Bush_${variant % 2 + 1}`;
  }
  if (object.kind === 'flower')
    return object.biome === 5 || object.biome === 6 ? `Cactus_${variant % 5 + 1}` : 'Grass_Short';
  if (object.kind === 'grass') return groundCover[variant % groundCover.length];
  if (object.kind === 'reed') return `Plant_${variant % 4 + 1}`;
  if (object.kind === 'crop') return ['Wheat', 'Corn_1', 'Corn_2'][variant % 3];
  if (object.kind === 'stump' || object.kind === 'log') return woodDecoration(object.kind, object);
  if (object.kind === 'lilypad') return 'Lilypad';
  const family = object.kind === 'tree' && families[object.species];
  if (!family) return null;
  return `${family}${style === 'autumn' ? '_Autumn' : ''}_${variant % 2 + 1}`;
}

export function natureGeometry(object, style, distant = false) {
  const key = natureKey(object, style);
  if (!key) return null;
  const data = plants[key] ?? models[key], g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(Float32Array.from(decode(data.position, Int16Array), x => x / data.positionScale), 3));
  g.setAttribute('normal', new T.Int16BufferAttribute(decode(data.normal, Int16Array), 3, true));
  const count = g.attributes.position.count;
  g.setAttribute('color', new T.Uint8BufferAttribute(data.color ? decode(data.color, Uint8Array) : new Uint8Array(count * 3).fill(255), 3, true));
  g.setAttribute('natureSurface', new T.Uint8BufferAttribute(data.surface ? decode(data.surface, Uint8Array) : new Uint8Array(count), 1));
  if (plants[key] && key.includes('Bush_')) g.attributes.natureSurface.array.fill(6);
  if (data.uv) g.setAttribute('uv', new T.Uint16BufferAttribute(decode(data.uv, Uint16Array), 2, true));
  g.setIndex(new T.Uint16BufferAttribute(decode(distant ? data.distantIndex : data.index, Uint16Array), 1));
  g.computeBoundingBox();
  const bounds = g.boundingBox, size = bounds.getSize(new T.Vector3());
  // Keep the trunk origin, bring the base to ground, and bound canopy growth
  // by the existing species envelope rather than changing world placement.
  const tree = object.kind === 'tree';
  const species = tree ? SPECIES[object.flora?.renderSpecies ?? object.species] : null;
  const sizes = {
    rock: [.85, .85], shrub: [.68, .9], flower: [.34, .62], grass: [.3, .52],
    reed: [.28, 1.05], crop: [.44, .88], stump: [.48, .58], log: [.76, .4], lilypad: [.62, .1]
  };
  let [radius, height] = tree ? [species.radius, species.height] : (sizes[object.kind] ?? [.85, .85]);
  if (plants[key]) {
    if (key.includes('Clover')) { radius = .21; height = .16; }
    if (key.includes('Grass_')) { radius = .22; height = key.endsWith('Tall') ? .65 : .28; }
    if (key.includes('Fern')) { radius = .42; height = .55; }
    if (key.includes('Plant_')) { radius = key.endsWith('Big') ? .45 : .25; height = key.endsWith('Big') ? .8 : .4; }
    if (key.includes('Mushroom')) { radius = .14; height = .22; }
  }
  const extent = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z));
  g.translate(0, -bounds.min.y, 0);
  const horizontal = radius / extent;
  g.scale(horizontal, height / size.y, horizontal);
  if (tree) {
    const position = g.attributes.position;
    const surface = g.attributes.natureSurface;
    for (let i = 0; i < position.count; i++) {
      const tag = surface.getX(i);
      if (tag !== 2 && tag !== 4) continue;
      const weight = 1 - T.MathUtils.smoothstep(position.getY(i), height * .28, height * .65);
      const thickness = 1 + weight * .6;
      position.setX(i, T.MathUtils.clamp(position.getX(i) * thickness, -radius, radius));
      position.setZ(i, T.MathUtils.clamp(position.getZ(i) * thickness, -radius, radius));
    }
    g.computeVertexNormals();
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.userData.natureKey = key;
  g.userData.distant = distant;
  g.userData.megaPlant = Boolean(plants[key]);
  return g;
}
