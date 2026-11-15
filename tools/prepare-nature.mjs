import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BufferAttribute } from 'three';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

// Offline conversion only. Keep the supplied source pack outside the repository.
const root = process.argv[2];
if (!root) throw new Error('Usage: node tools/prepare-nature.mjs <source-pack-directory>');
const names = ['CommonTree', 'BirchTree', 'PineTree', 'Willow'].flatMap(type =>
  (type === 'PineTree' ? ['', '_Autumn', '_Snow'] : ['', '_Autumn', '_Snow', '_Dead', '_Dead_Snow'])
    .flatMap(season => [1, 2, 3, 4, 5].map(i => `${type}${season}_${i}`)));
names.push(...[1, 2, 3, 4].map(i => `PalmTree_${i}`));
names.push(...['Rock', 'Rock_Moss', 'Rock_Snow'].flatMap(family =>
  [1, 2, 3, 4, 5, 6, 7].map(i => `${family}_${i}`)));
names.push(
  'Bush_1', 'Bush_2', 'Bush_Snow_1', 'Bush_Snow_2', 'BushBerries_1', 'BushBerries_2',
  ...[1, 2, 3, 4, 5].map(i => `Cactus_${i}`), 'CactusFlower_1',
  ...[2, 3, 4, 5].map(i => `CactusFlowers_${i}`),
  'Corn_1', 'Corn_2', 'Flowers', 'Grass', 'Grass_2', 'Grass_Short', 'Lilypad',
  ...[1, 2, 3, 4, 5].map(i => `Plant_${i}`), 'TreeStump', 'TreeStump_Moss',
  'TreeStump_Snow', 'WoodLog', 'WoodLog_Moss', 'WoodLog_Snow', 'Wheat');
if (names.length !== 150 || new Set(names).size !== names.length)
  throw new Error(`Expected 150 unique pack models, found ${names.length}`);
const models = {};
await MeshoptSimplifier.ready;
for (const name of names) {
  const mtl = await readFile(path.join(root, 'OBJ', name + '.mtl'), 'utf8');
  const palette = new Map();
  let current;
  for (const line of mtl.split(/\r?\n/)) {
    const [key, ...args] = line.trim().split(/\s+/);
    if (key === 'newmtl') current = args.join(' ');
    if (key === 'Kd') palette.set(current, args.map(Number));
  }
  const pieces = [];
  const collectMeshes = object => {
    object.updateMatrixWorld(true);
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const colors = new Float32Array(g.attributes.position.count * 3);
      const surfaces = new Uint8Array(g.attributes.position.count);
      const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
      for (const group of groups) {
        const color = palette.get(materials[group.materialIndex].name);
        if (!color) throw new Error(`Missing material in ${name}`);
        const materialName = materials[group.materialIndex].name;
        const surface = materialName === 'Snow' ? 5 : name.startsWith('Rock_') ? 3 : materialName === 'Wood' ? 2
          : ['White', 'Black'].includes(materialName) ? 4 : 1;
        for (let i = group.start; i < group.start + group.count; i++) colors.set(color, i * 3);
        surfaces.fill(surface, group.start, group.start + group.count);
      }
      g.deleteAttribute('uv');
      g.setAttribute('color', new BufferAttribute(colors, 3));
      g.setAttribute('natureSurface', new BufferAttribute(surfaces, 1));
      g.clearGroups();
      pieces.push(g);
    });
  };
  collectMeshes(new OBJLoader().parse(await readFile(path.join(root, 'OBJ', name + '.obj'), 'utf8')));
  if (!pieces.length) {
    const bytes = await readFile(path.join(root, 'FBX', name + '.fbx'));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    collectMeshes(new FBXLoader().parse(buffer, ''));
  }
  if (!pieces.length) throw new Error(`No triangle mesh in OBJ or FBX for pack model ${name}`);
  const g = mergeVertices(mergeGeometries(pieces));
  const attributes = new Float32Array(g.attributes.position.count * 7);
  for (let i = 0; i < g.attributes.position.count; i++) {
    for (let k = 0; k < 3; k++) {
      attributes[i * 7 + k] = g.attributes.normal.array[i * 3 + k];
      attributes[i * 7 + 3 + k] = g.attributes.color.array[i * 3 + k];
    }
    attributes[i * 7 + 6] = g.attributes.natureSurface.array[i];
  }
  const [distantIndex, lodError] = MeshoptSimplifier.simplifyWithAttributes(
    g.index.array, g.attributes.position.array, 3, attributes, 7,
    [.02, .02, .02, .25, .25, .25, 1], null,
    Math.floor(g.index.count * .55 / 3) * 3, .02, ['Permissive']);
  const encode = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');
  const positionScale = 32760 / Math.max(...g.attributes.position.array.map(Math.abs));
  const positions = Int16Array.from(g.attributes.position.array, x => Math.round(x * positionScale));
  if (g.attributes.position.count > 65535) throw new Error(`Index exceeds uint16 in ${name}`);
  models[name] = { positionScale, position: encode(positions),
    normal: encode(Int16Array.from(g.attributes.normal.array, x => Math.round(x * 32767))),
    color: encode(Uint8Array.from(g.attributes.color.array, x => Math.round(x * 255))),
    surface: encode(Uint8Array.from(g.attributes.natureSurface.array)),
    index: encode(Uint16Array.from(g.index.array)),
    distantIndex: encode(Uint16Array.from(distantIndex)), lodError,
    triangles: g.index.count / 3, distantTriangles: distantIndex.length / 3 };
}
await mkdir('src/render/assets', { recursive: true });
await writeFile('src/render/assets/nature.json', JSON.stringify(models) + '\n');
console.log(`Prepared ${names.length} models with linear material colors and shared indexed geometry.`);
