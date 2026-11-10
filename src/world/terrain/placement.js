export function buildable(world, x, z, radius) {
  const { stride, ground, distance } = world;
  let low = Infinity, high = -Infinity;
  for (let nz = Math.floor(z - radius); nz <= Math.ceil(z + radius); nz++) {
    for (let nx = Math.floor(x - radius); nx <= Math.ceil(x + radius); nx++) {
      if (nx < 1 || nz < 1 || nx >= stride - 1 || nz >= stride - 1) return false;
      const i = nz * stride + nx;
      if (distance[i] < 2) return false;
      low = Math.min(low, ground[i]);
      high = Math.max(high, ground[i]);
    }
  }
  return high - low < 1.1;
}
