import * as T from 'three';
import { SPECIES } from '../world/catalog.js';
import { hash, random } from '../world/math.js';
import { stone, part, stick, combine } from './mesh-parts.js';
import { natureGeometry, natureKey } from './nature-models.js';

const ball = new T.IcosahedronGeometry(1, 1);
const cone = new T.CylinderGeometry(.06, 1, 1, 8);
const transform = new T.Object3D();
const plantTint = new T.Color();
const shrubTint = new T.Color().setRGB(.9, .82, .72);
export const grassView = { value: new T.Vector3(0, 0, 20) };
const bladeTint = new T.Color();
const distantClassicGrassRate = .5;
const distantPlantRates = { grass: .6, flower: .45, reed: .68, crop: .78 };
const distantPlantStreams = { grass: 1, flower: 2, reed: 3, crop: 4 };
export function treeVisualScale(object) {
  const variation = hash(0, Math.floor(object.x * 32), Math.floor(object.z * 32), 2101);
  const maturity = T.MathUtils.smoothstep(object.age ?? 50, 15, 110);
  return .85 + maturity * .85 + variation * .4 + (variation > .9 ? .4 : 0);
}

function keepDistantPlant(kind, x, z, classicGrass = false) {
  const rate = classicGrass ? distantClassicGrassRate : distantPlantRates[kind];
  if (rate === undefined || rate >= 1) return true;
  return hash(0, Math.floor(x * 256), Math.floor(z * 256), 1700 + (classicGrass ? 5 : distantPlantStreams[kind])) < rate;
}

function treeModel(species, variant, style, distant) {
  const { height, radius, colors } = SPECIES[species];
  const rng = random(159 + variant * 197 + species.charCodeAt(0) * 367);
  const pick = () => {
    const c = new T.Color(colors[Math.floor(rng() * colors.length)]);
    if (style === 'spring') c.offsetHSL(.055, .02, .015);
    else if (variant === 4 && species === 'oak') c.offsetHSL(-.068, .075, -.015);
    return c;
  };
  const parts = [], bend = rng() * .42 - .21;
  const bark = species === 'birch' ? '#b5ad88' : '#68503d';
  const h = height * (.88 + rng() * .22);
  const r = radius * (.88 + rng() * .20);
  const diameter = (species === 'birch' ? .145 : .215) * (.75 + rng() * .5);
  stick(parts, bark, [0, -.14, 0], [bend, h * .72, .06], diameter);
  if (species === 'pine') {
    const tiers = distant ? 3 : 4 + variant % 2;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1);
      const wide = r * (1.05 - t * .75), tall = h * (.43 - t * .10);
      part(parts, cone, pick(), bend * t, h * (.38 + t * .46), .05 * k,
        wide, tall, wide * (.85 + rng() * .26), rng() * Math.PI, .03, .28);
    }
  } else {
    const flat = species === 'acacia' ? .45 : species === 'willow' ? .63 : species === 'birch' ? 1.05 : .83;
    const total = distant ? 3 : 6 + variant % 3;
    for (let k = 0; k < total; k++) {
      const a = k * 2.39996 + variant * .38;
      const arm = k === 0 ? 0 : (.31 + rng() * .30) * r;
      const x = Math.cos(a) * arm + bend, z = Math.sin(a) * arm;
      const y = h * (k === 0 ? .84 : .55 + rng() * .25);
      if (k > 0 && !distant) stick(parts, bark, [bend * .4, h * (.30 + rng() * .21), 0], [x, y, z], diameter * .43);
      const volume = r * (k === 0 ? .76 : .42 + rng() * .27);
      part(parts, distant ? stone : ball, pick(), x, y, z, volume, volume * flat * (1 + rng() * .35),
        volume * (.85 + rng() * .23), a, .03, .26);
      if (species === 'willow' && k > 0 && !distant) {
        part(parts, stone, pick(), x * 1.44, y - .58, z * 1.43, volume * .42, volume * 1.05, volume * .46, a, .16, .27);
      }
    }
  }
  return combine(parts);
}

function smallModel(kind, variant) {
  const parts = [], rng = random(113 + 733 * variant);
  if (kind === 'rock') {
    const colors = ['#797a70', '#88887c', '#929187', '#726d63'];
    for (let i = 0; i < 3; i++) {
      const r = i === 0 ? .64 : .19 + rng() * .25;
      part(parts, stone, colors[(variant + i) % colors.length], (i - .9) * .28, r * .38, rng() * .25 - .125,
        r, r * (.65 + rng() * .48), r * .92, rng() * 3, rng() * .3, .34);
    }
  } else if (kind === 'shrub') {
    for (let i = 0; i < 4; i++) part(parts, stone, ['#798748', '#627e43', '#87954f'][i % 3],
      Math.cos(i * 2.4) * .25, .19 + rng() * .25, Math.sin(i * 2.4) * .25,
      .26, .25, .24, rng(), .17, .2);
  } else {
    const reed = kind === 'reed', flower = kind === 'flower', crop = kind === 'crop';
    for (let i = 0; i < (reed ? 5 : 4); i++) {
      const x = (rng() - .5) * .5, z = (rng() - .5) * .38;
      const y = (reed ? .74 : .45) * (.6 + rng() * .65);
      const paint = crop ? (i % 2 ? '#c6a558' : '#a4803f') : (i % 2 ? '#a8ab56' : '#798c48');
      part(parts, cone, paint, x, y * .47, z, reed ? .043 : .064, y, .035, i, (rng() - .5) * .7, .13);
      if (reed && i % 2) part(parts, stone, '#8e6441', x, y, z, .066, .12, .067);
      if (flower && i % 2) part(parts, stone, variant % 2 ? '#eee2b2' : '#d6a353', x, y * .93, z, .092, .065, .092);
    }
  }
  return combine(parts);
}

export function modelBank(style, distantLOD = true) {
  const cache = new Map();
  return {
    get(object, distant) {
      const type = object.kind === 'tree' ? (object.flora?.renderSpecies ?? object.species) : object.kind;
      const variant = distant ? object.variant % 2 : object.variant;
      const imported = natureKey(object, style);
      const simplified = distantLOD && (distant || object.classicGrass === true);
      const key = imported ? imported + ':' + Boolean(simplified)
        : type + ':' + variant + ':' + (object.kind === 'tree' && distant);
      if (!cache.has(key)) {
        const g = imported ? natureGeometry(object, style, simplified) : object.kind === 'tree'
          ? treeModel(type, variant, style, distant) : smallModel(type, variant);
        cache.set(key, g);
      }
      return cache.get(key);
    },
    clear() {
      for (const g of cache.values()) g.dispose();
      cache.clear();
    }
  };
}

export function instances(objects, bank, materials, distant) {
  const batches = new Map();
  for (const o of objects) {
    if (distant && !o.grassPlacements && !keepDistantPlant(o.kind, o.x, o.z)) continue;
    if (distant && o.grassPlacements) {
      let visible = false;
      for (let p = 0; p < o.grassPlacements.length; p += 6) {
        if (keepDistantPlant(o.kind, o.grassPlacements[p], o.grassPlacements[p + 2], true)) {
          visible = true;
          break;
        }
      }
      if (!visible) continue;
    }
    const geometry = bank.get(o, distant);
    if (!batches.has(geometry)) batches.set(geometry, []);
    batches.get(geometry).push(o);
  }
  return [...batches].map(([geometry, entries]) => {
    const waving = !['rock', 'log', 'stump', 'lilypad'].includes(entries[0].kind);
    const material = geometry.userData.megaPlant ? materials.groundcover : waving ? materials.wind : materials.solid;
    const count = entries.reduce((n, o) => {
      if (!o.grassPlacements) return n + 1;
      if (!distant) return n + o.grassPlacements.length / 6;
      let retained = 0;
      for (let p = 0; p < o.grassPlacements.length; p += 6)
        if (keepDistantPlant(o.kind, o.grassPlacements[p], o.grassPlacements[p + 2], true)) retained++;
      return n + retained;
    }, 0);
    const mesh = new T.InstancedMesh(geometry, material, count);
    // Instancing retains every visible blade. There is no per-frame hash,
    // zoom fade or vertex collapse here; distant representations can be
    // prepared separately and swapped only while outside the camera.
    let instance = 0;
    for (const o of entries) {
      const fit = o.kind === 'tree' && o.flora?.renderSpecies
        ? Math.min(1, SPECIES[o.species].radius / SPECIES[o.flora.renderSpecies].radius) : 1;
      plantTint.setRGB(1, 1, 1);
      if (o.plantWarmth !== undefined) {
        const heat = T.MathUtils.smoothstep(o.plantWarmth, .62, .88);
        plantTint.setRGB(1, 1 - heat * .08, 1 - heat * .62);
        if (o.kind === 'shrub') plantTint.multiply(shrubTint);
      }
      const positions = o.grassPlacements;
      for (let p = 0; p < (positions?.length ?? 6); p += 6) {
        if (distant && positions && !keepDistantPlant(o.kind, positions[p], positions[p + 2], true)) continue;
        const scale = positions ? positions[p + 3] : o.scale * (o.kind === 'tree' ? treeVisualScale(o) : 1);
        const height = positions ? positions[p + 4] : o.heightScale ?? 1;
        transform.position.set(positions ? positions[p] : o.x, positions ? positions[p + 1] : o.y, positions ? positions[p + 2] : o.z);
        transform.rotation.set(0, positions ? positions[p + 5] : o.rotation, 0);
        transform.scale.set(scale * (.91 + (o.variant % 3) * .07) * fit, scale * height, scale * fit);
        transform.updateMatrix();
        mesh.setMatrixAt(instance, transform.matrix);
        if (o.plantWarmth !== undefined) {
          const tint = bladeTint.copy(plantTint);
          const variation = hash(0, Math.floor(transform.position.x / 7), Math.floor(transform.position.z / 7), 1820);
          tint.multiplyScalar(.9 + variation * .12);
          mesh.setColorAt(instance, tint);
        }
        instance++;
      }
    }
    mesh.userData.sharedGeometry = true;
    mesh.receiveShadow = true;
    return mesh;
  });
}
