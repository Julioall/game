import * as T from 'three';
import { BIOMES, CHUNK } from '../world/catalog.js';
import { clamp, gridSample, hash } from '../world/math.js';
import { insideFort } from '../world/fortifications.js';

const palette = BIOMES.map(b => new T.Color(b.color));
const loam = new T.Color('#a58755');
const cliff = new T.Color('#716e6b');
const road = new T.Color('#b29b66');
const cobbles = new T.Color('#a49a82');
const courtyard = new T.Color('#a59679');
const fieldDark = new T.Color('#735332');
const fieldLight = new T.Color('#9f803e');

export function surfaceMeshes(world, index, cx, cz, materials) {
  const { stride, wet, surface, ground, biome, config } = world;
  const { roads, paved, fields } = index;
  const forts = index.yards.get(cx + ',' + cz) ?? [];
  const positions = [], colors = [], triangles = [];
  const water = [], depth = [], banks = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const x1 = Math.min(config.size, x0 + CHUNK), z1 = Math.min(config.size, z0 + CHUNK), side = x1 - x0 + 1;
  const vertices = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * stride + x, y = ground[i];
    const dx = (ground[i + (x < stride - 1 ? 1 : 0)] - ground[i - (x > 0 ? 1 : 0)]) / 2;
    const dz = (ground[i + (z < stride - 1 ? stride : 0)] - ground[i - (z > 0 ? stride : 0)]) / 2;
    const grade = Math.hypot(dx, dz);
    const base = palette[biome[i] || ((world.raw ?? ground)[i] < 0 ? 1 : 10)].clone();
    const seed = hash(config.seed, x, z, 91);
    if (wet[i] > 0) base.lerp(loam, .44);
    if (grade > .6 && wet[i] <= 0 && biome[i] !== 9) base.lerp(cliff, clamp((grade - .6) * .84));
    if (config.style === 'spring' && [2, 3, 4, 10, 11].includes(biome[i])) base.g *= 1.19;
    const plot = fields.find(f => Math.abs(f.x - x) <= 2 && Math.abs(f.z - z) <= 2);
    if (plot) base.copy((x - plot.x) % 2 ? fieldDark : fieldLight);
    if (forts.some(bounds => insideFort(bounds, x, z))) base.lerp(courtyard, .77);
    if (roads.has(i)) {
      base.copy(paved.has(i) ? cobbles : road);
      if (paved.has(i)) base.multiplyScalar(.90 + seed * .19);
    }
    const diffuse = clamp((.87 - .43 * dx - .21 * dz) / Math.sqrt(1 + dx * dx + dz * dz), .22, 1.15);
    const light = .48 + Math.round(diffuse * 12) / 15;
    base.multiplyScalar(light * (.92 + .16 * seed));
    if (light < .79) base.b += (.79 - light) * .09;
    positions.push(x, y, z);
    colors.push(base.r, base.g, base.b);
    vertices.push({ x, z, y: surface[i], mask: wet[i], depth: Math.max(0, surface[i] - y) });
  }

  function clipWater(a, b, c) {
    if (a.mask <= 0 && b.mask <= 0 && c.mask <= 0) return;
    const clipped = [];
    let prev = c;
    for (const vertex of [a, b, c]) {
      if ((prev.mask > 0) !== (vertex.mask > 0)) {
        const t = prev.mask / (prev.mask - vertex.mask);
        const x = prev.x + (vertex.x - prev.x) * t, z = prev.z + (vertex.z - prev.z) * t;
        clipped.push({ x, z, y: gridSample(ground, stride, x, z), mask: 0, depth: 0 });
      }
      if (vertex.mask > 0) clipped.push(vertex);
      prev = vertex;
    }
    for (let i = 1; i + 1 < clipped.length; i++) {
      for (const vertex of [clipped[0], clipped[i], clipped[i + 1]]) {
        water.push(vertex.x, vertex.y + .047, vertex.z);
        depth.push(vertex.depth);
        banks.push(vertex.mask);
      }
    }
  }

  for (let z = 0; z < z1 - z0; z++) for (let x = 0; x < x1 - x0; x++) {
    const a = z * side + x, b = a + side;
    triangles.push(a, b, a + 1, a + 1, b, b + 1);
    clipWater(vertices[a], vertices[b], vertices[a + 1]);
    clipWater(vertices[a + 1], vertices[b], vertices[b + 1]);
  }

  const terrain = new T.BufferGeometry();
  terrain.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  terrain.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  terrain.setIndex(triangles);
  terrain.computeVertexNormals();
  const land = new T.Mesh(terrain, materials.terrain);
  land.receiveShadow = true;
  const meshes = [land];
  if (water.length) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(water, 3));
    geometry.setAttribute('waterDepth', new T.Float32BufferAttribute(depth, 1));
    geometry.setAttribute('bank', new T.Float32BufferAttribute(banks, 1));
    const stream = new T.Mesh(geometry, materials.water);
    stream.receiveShadow = true;
    meshes.push(stream);
  }
  return meshes;
}

export function groundShadows(world, objects, material) {
  const positions = [], uvs = [], indices = [];
  for (const o of objects) {
    const radius = o.radius ?? o.footprint ?? (o.kind === 'rock' ? o.scale * .65 : 0);
    if (radius < .4 || world.slope[Math.round(o.z) * world.stride + Math.round(o.x)] > .36) continue;
    const span = Math.max(1, radius * 1.15) + (o.shadowHeight ?? 0) * .17;
    const shift = o.shadowHeight ? o.shadowHeight * .40 : o.kind === 'tree' ? o.scale * 1.5 : radius * .34;
    const x = o.x + shift, z = o.z + shift * .53, start = positions.length / 3;
    const resolution = radius > 2 ? 7 : 5;
    for (let v = 0; v < resolution; v++) for (let u = 0; u < resolution; u++) {
      const a = 2 * u / (resolution - 1) - 1, b = 2 * v / (resolution - 1) - 1;
      const px = x + span * (a * 1.19 + b * .36), pz = z + span * (b * .64 + a * .26);
      positions.push(px, gridSample(world.ground, world.stride, px, pz) + .065, pz);
      uvs.push(a, b);
      if (u < resolution - 1 && v < resolution - 1) {
        const i = start + v * resolution + u;
        indices.push(i, i + resolution, i + 1, i + 1, i + resolution, i + resolution + 1);
      }
    }
  }
  if (!positions.length) return null;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const mesh = new T.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}
