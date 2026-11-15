// Match the cold/boreal warmth boundary and exclude tundra/snow altitudes.
// A seven-metre margin keeps channel banks out of the cold region as well.
export function coldWaterMask(config, raw, heat, stride) {
  const distance = new Uint8Array(raw.length);
  const vertical = .63 + .68 * config.relief;
  for (let i = 0; i < raw.length; i++) distance[i] = heat[i] < .44 || raw[i] / vertical > 20 ? 0 : 255;
  for (let z = 0; z < stride; z++) for (let x = 0; x < stride; x++) {
    const i = z * stride + x;
    let d = distance[i];
    if (x) d = Math.min(d, distance[i - 1] + 1);
    if (z) {
      d = Math.min(d, distance[i - stride] + 1);
      if (x) d = Math.min(d, distance[i - stride - 1] + 1);
      if (x + 1 < stride) d = Math.min(d, distance[i - stride + 1] + 1);
    }
    distance[i] = d;
  }
  for (let z = stride - 1; z >= 0; z--) for (let x = stride - 1; x >= 0; x--) {
    const i = z * stride + x;
    let d = distance[i];
    if (x + 1 < stride) d = Math.min(d, distance[i + 1] + 1);
    if (z + 1 < stride) {
      d = Math.min(d, distance[i + stride] + 1);
      if (x) d = Math.min(d, distance[i + stride - 1] + 1);
      if (x + 1 < stride) d = Math.min(d, distance[i + stride + 1] + 1);
    }
    distance[i] = d;
  }
  for (let i = 0; i < distance.length; i++) distance[i] = distance[i] <= 7 ? 1 : 0;
  return distance;
}
