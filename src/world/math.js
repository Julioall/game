export const clamp = (x, low = 0, high = 1) => Math.min(high, Math.max(low, x));
export const mix = (a, b, t) => a + (b - a) * t;
export function smooth(a, b, x) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function hash(seed, x, z, stream = 0) {
  let h = seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(z, 0x85ebca77) ^ Math.imul(stream, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export function random(seed) {
  let count = 0;
  return () => hash(seed, ++count, 0);
}

export function gridSample(field, stride, x, z) {
  x = clamp(x, 0, stride - 1.000001);
  z = clamp(z, 0, stride - 1.000001);
  const ix = Math.floor(x), iz = Math.floor(z);
  const u = x - ix, v = z - iz, i = iz * stride + ix;
  // Matches the diagonal in the terrain mesh and in the shore clipping pass.
  const read = ArrayBuffer.isView(field) || Array.isArray(field) ? null : field.at;
  const east = read ? read(i + 1) : field[i + 1];
  const south = read ? read(i + stride) : field[i + stride];
  if (u + v <= 1) {
    const origin = read ? read(i) : field[i];
    return origin + u * (east - origin) + v * (south - origin);
  }
  const d = read ? read(i + stride + 1) : field[i + stride + 1];
  return d + (1 - u) * (south - d) + (1 - v) * (east - d);
}
