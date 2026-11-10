import { createNoise2D } from 'simplex-noise';
import { clamp, hash, mix, random, smooth } from '../math.js';

export function geography(config, stride) {
  const { seed, size } = config;
  const count = stride ** 2;
  const raw = new Float32Array(count), rain = new Float32Array(count), heat = new Float32Array(count);
  const noise = createNoise2D(random(seed));
  const lakeX = .43 + .12 * hash(seed, 4, 4), lakeZ = .38 + .12 * hash(seed, 4, 5);
  const mountainAngle = mix(-.87, -.28, hash(seed, 8, 1));
  const sea = 0, vertical = .63 + .68 * config.relief;

  for (let z = 0; z < stride; z++) for (let x = 0; x < stride; x++) {
    const u = x / size, v = z / size, i = z * stride + x;
    const warp = noise(u * 2.8 + 9, v * 2.8) * .050;
    const warp2 = noise(u * 2.8, v * 2.8 - 9) * .045;
    const px = u + warp, pz = v + warp2;
    const broad = noise(px * 3.3, pz * 3.3);
    const axis = (px - .34) * Math.sin(mountainAngle) + (pz - .24) * Math.cos(mountainAngle);
    const long = (px - .34) * Math.cos(mountainAngle) - (pz - .24) * Math.sin(mountainAngle);
    const chain = Math.exp(-axis * axis * 67 - long * long * 15);
    const folds = (1 - Math.abs(noise(px * 7 - 5, pz * 7 + 6))) ** 2;
    const ridge = chain * (13 + 29 * folds);
    const detail = noise(px * 9 + 7, pz * 9) * (1.1 + chain * 2.4)
      + noise(u * 22, v * 22) * (.34 + chain * 1.2) + noise(x * .084, z * .084) * (.10 + chain * .25);
    const plateau = smooth(.36, .62, noise(px * 4 + 11, pz * 4 + 6)) * 4.6;
    const edge = Math.min(u, v, 1 - u, 1 - v);
    const coast = Math.min(px, pz, 1 - px, 1 - pz);
    const inland = smooth(-.055, .22, coast) * smooth(0, .075, edge);
    let elevation = (7.6 + broad * 3.7 + detail + ridge + plateau) * inland
      - (1 - inland) * (1.65 + config.water * 8.2) - config.water * 1.35;

    if (config.lakes > 0) {
      // A warped glacial cirque adds an inland depression. Drainage determines
      // its actual shoreline, spill elevation and outlet.
      const radius = Math.hypot((u - lakeX) / 1.22, v - lakeZ)
        + noise(u * 16 + 11, v * 16) * .017;
      const bowl = smooth(.105 + config.lakes * .04, .038, radius);
      const floor = 3.1 + noise(u * 10, v * 10) * .52 - config.lakes * 2.6;
      elevation = mix(elevation, floor, bowl * .99);
      const out = v - lakeZ;
      const meander = lakeX + Math.sin(out * 17) * .036 + out * .24;
      const floodplain = (1 - smooth(.016, .079, Math.abs(u - meander)))
        * smooth(.047, .145, out) * smooth(.025, .14, edge);
      const valley = 5.4 - out * 13 + noise(u * 12 + 5, v * 12) * .42;
      elevation = mix(elevation, Math.min(elevation, valley), floodplain * .96);
    }
    raw[i] = elevation * vertical;
    rain[i] = clamp(.49 + config.climate * .25 + noise(px * 5, pz * 5 + 13) * .31
      + (1 - u) * .13 - smooth(.46, .88, u) * .19 + smooth(3, 20, elevation) * .17, .12, 1);
    heat[i] = clamp(.95 - (1 - v) * .42 - Math.max(0, elevation) * .025
      + noise(u * 4, v * 4 + 15) * .13);
  }
  return { raw, rain, heat, sea };
}
