import * as T from 'three';
import { SPECIES } from '../world/catalog.js';
import { random } from '../world/math.js';
import { stone, part, stick, combine } from './mesh-parts.js';

const ball = new T.IcosahedronGeometry(1, 1);
const cone = new T.CylinderGeometry(.06, 1, 1, 8);
const transform = new T.Object3D();

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

export function modelBank(style) {
  const cache = new Map();
  return {
    get(object, distant) {
      const type = object.kind === 'tree' ? object.species : object.kind;
      const variant = distant ? object.variant % 2 : object.variant;
      const key = type + ':' + variant + ':' + (object.kind === 'tree' && distant);
      if (!cache.has(key)) {
        const g = object.kind === 'tree'
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
    if (distant && ['grass', 'flower', 'reed', 'crop'].includes(o.kind)) continue;
    const geometry = bank.get(o, distant);
    if (!batches.has(geometry)) batches.set(geometry, []);
    batches.get(geometry).push(o);
  }
  return [...batches].map(([geometry, entries]) => {
    const waving = entries[0].kind !== 'rock';
    const mesh = new T.InstancedMesh(geometry, waving ? materials.wind : materials.solid, entries.length);
    for (let i = 0; i < entries.length; i++) {
      const o = entries[i];
      transform.position.set(o.x, o.y, o.z);
      transform.rotation.set(0, o.rotation, 0);
      transform.scale.set(o.scale * (.91 + (o.variant % 3) * .07), o.scale, o.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    }
    mesh.userData.sharedGeometry = true;
    return mesh;
  });
}
