import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { BufferAttribute } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

const root = process.argv[2];
if (!root) throw new Error('Usage: node tools/prepare-megakit-plants.mjs <MegaKit-directory>');
execFileSync('python', ['tools/prepare-megakit-atlas.py', root], { stdio: 'inherit' });
const textures = ['Grass.png', 'Leaves.png', 'Flowers.png', 'Leaves_NormalTree_C.png',
  'Leaves_TwistedTree_C.png', 'Mushrooms.png'];
const names = ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall',
  'Clover_1', 'Clover_2', 'Fern_1', 'Plant_1', 'Plant_1_Big', 'Plant_7', 'Plant_7_Big',
  'Flower_3_Single', 'Flower_3_Group', 'Flower_4_Single', 'Flower_4_Group',
  'Bush_Common', 'Bush_Common_Flowers', 'Mushroom_Common', 'Mushroom_Laetiporus'];
await MeshoptSimplifier.ready;
const models = {};
const encode = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
for (const name of names) {
  const mtl = await readFile(path.join(root, 'OBJ', name + '.mtl'), 'utf8');
  const maps = new Map(); let current;
  for (const line of mtl.split(/\r?\n/)) {
    if (line.startsWith('newmtl ')) current = line.slice(7).trim();
    if (line.startsWith('map_Kd ')) maps.set(current, textures.indexOf(line.trim().split(/[\\/]/).at(-1)));
  }
  const object = new OBJLoader().parse(await readFile(path.join(root, 'OBJ', name + '.obj'), 'utf8'));
  object.updateMatrixWorld(true);
  const pieces = [];
  object.traverse(mesh => {
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (!g.attributes.uv) throw new Error(`Missing UV in ${name}`);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    const uv = g.attributes.uv;
    for (const group of groups) {
      const mat = materials[group.materialIndex].name, tile = maps.get(mat);
      if (tile === undefined || tile < 0) throw new Error(`Unmapped texture ${name}: ${mat}`);
      for (let i = group.start; i < group.start + group.count; i++) {
        const u = Math.max(0, Math.min(1, uv.getX(i))), v = Math.max(0, Math.min(1, uv.getY(i)));
        uv.setXY(i, (tile % 3 * 512 + 4 + u * 504) / 1536,
          1 - (Math.floor(tile / 3) * 512 + 4 + (1 - v) * 504) / 1024);
      }
    }
    g.setAttribute('color', new BufferAttribute(new Uint8Array(g.attributes.position.count * 3).fill(255), 3, true));
    g.clearGroups(); pieces.push(g);
  });
  if (!pieces.length) throw new Error(`No triangles in ${name}`);
  const g = mergeVertices(mergeGeometries(pieces));
  const attributes = new Float32Array(g.attributes.position.count * 5);
  for (let i = 0; i < g.attributes.position.count; i++) {
    attributes.set(g.attributes.normal.array.subarray(i * 3, i * 3 + 3), i * 5);
    attributes.set(g.attributes.uv.array.subarray(i * 2, i * 2 + 2), i * 5 + 3);
  }
  const [far] = MeshoptSimplifier.simplifyWithAttributes(g.index.array, g.attributes.position.array, 3,
    attributes, 5, [.02, .02, .02, 1, 1], null, Math.floor(g.index.count * .6 / 3) * 3, .01, ['LockBorder']);
  let maximum = 0;
  for (const value of g.attributes.position.array) maximum = Math.max(maximum, Math.abs(value));
  const positionScale = 32760 / maximum;
  if (g.attributes.position.count > 65535) throw new Error(`Too many vertices in ${name}`);
  models['Mega_' + name] = {
    positionScale, position: encode(Int16Array.from(g.attributes.position.array, x => Math.round(x * positionScale))),
    normal: encode(Int16Array.from(g.attributes.normal.array, x => Math.round(x * 32767))),
    uv: encode(Uint16Array.from(g.attributes.uv.array, x => Math.round(x * 65535))),
    index: encode(Uint16Array.from(g.index.array)), distantIndex: encode(Uint16Array.from(far)),
    triangles: g.index.count / 3, distantTriangles: far.length / 3
  };
}
await mkdir('src/render/assets', { recursive: true });
await writeFile('src/render/assets/megakit-plants.json', JSON.stringify(models) + '\n');
await copyFile(path.join(root, 'License_Standard.txt'), 'public/third-party/Quaternius-MegaKit-CC0.txt');
console.log(`Prepared ${names.length} textured plant models with shared atlas and LOD.`);
