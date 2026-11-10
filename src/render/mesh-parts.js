import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash } from '../world/math.js';

export const box = new T.BoxGeometry(1, 1, 1);
export const stone = new T.DodecahedronGeometry(1, 0);
export const trunk = new T.CylinderGeometry(.62, 1, 1, 7);
const color = new T.Color();
const up = new T.Vector3(0, 1, 0);

export function part(parts, base, paint, x, y, z, sx, sy, sz, ry = 0, lean = 0, grain = 0) {
  const g = base.index ? base.toNonIndexed() : base.clone();
  g.deleteAttribute('uv');
  g.scale(sx, sy, sz);
  if (lean) g.rotateZ(lean);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  const n = g.attributes.position.count, colors = new Float32Array(n * 3);
  color.set(paint);
  for (let i = 0; i < n; i += 3) {
    const m = 1 + (hash(88713, i, n) - .43) * grain;
    for (let j = i; j < i + 3; j++) {
      colors[j * 3] = color.r * m;
      colors[j * 3 + 1] = color.g * m;
      colors[j * 3 + 2] = color.b * m;
    }
  }
  g.setAttribute('color', new T.BufferAttribute(colors, 3));
  parts.push(g);
  return g;
}

export function stick(parts, paint, a, b, r) {
  const g = trunk.index ? trunk.toNonIndexed() : trunk.clone();
  g.deleteAttribute('uv');
  const from = new T.Vector3(...a), to = new T.Vector3(...b), d = to.clone().sub(from);
  const q = new T.Quaternion().setFromUnitVectors(up, d.clone().normalize());
  g.scale(r, d.length(), r);
  g.applyQuaternion(q);
  from.lerp(to, .5);
  g.translate(from.x, from.y, from.z);
  const colors = new Float32Array(g.attributes.position.count * 3);
  color.set(paint);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  g.setAttribute('color', new T.BufferAttribute(colors, 3));
  parts.push(g);
}

export function combine(parts) {
  const geometry = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return geometry;
}
