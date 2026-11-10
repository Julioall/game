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
  if (u + v <= 1) return field[i] + u * (field[i + 1] - field[i]) + v * (field[i + stride] - field[i]);
  const d = field[i + stride + 1];
  return d + (1 - u) * (field[i + stride] - d) + (1 - v) * (field[i + 1] - d);
}
