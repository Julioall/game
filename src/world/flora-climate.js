import { clamp } from './math.js';

const at = (grid, index) => ArrayBuffer.isView(grid) ? grid[index] : grid?.at(index);
export function createFloraClimate(config, stride, ground, rain, heat) {
  const floraClimateStep = 32;
  const floraClimateStride = Math.ceil(config.size / floraClimateStep) + 1;
  const floraThermal = new Uint8Array(floraClimateStride ** 2);
  const floraRain = new Uint8Array(floraClimateStride ** 2);
  for (let z = 0; z < floraClimateStride; z++) for (let x = 0; x < floraClimateStride; x++) {
    const px = Math.min(config.size, x * floraClimateStep), pz = Math.min(config.size, z * floraClimateStep);
    const i = pz * stride + px, j = z * floraClimateStride + x;
    const elevation = Math.max(0, ground[i]) / (.63 + .68 * config.relief);
    // Store reference warmth; restore the local altitude effect when querying.
    floraThermal[j] = Math.round(clamp((heat[i] + elevation * .025) / 1.25) * 255);
    floraRain[j] = Math.round(clamp(rain[i]) * 255);
  }
  return { floraClimateStep, floraClimateStride, floraThermal, floraRain };
}

export function floraClimateAt(world, x, z) {
  const px = clamp(x, 0, world.config.size), pz = clamp(z, 0, world.config.size);
  const i = Math.round(pz) * world.stride + Math.round(px);
  const elevation = (at(world.ground, i) ?? 0) / (.63 + .68 * world.config.relief);
  let warmth, rain;
  if (world.floraThermal && world.floraRain) {
    const step = world.floraClimateStep, stride = world.floraClimateStride;
    const gx = Math.min(stride - 2, Math.floor(px / step)), gz = Math.min(stride - 2, Math.floor(pz / step));
    const u = (px - gx * step) / Math.min(step, world.config.size - gx * step);
    const v = (pz - gz * step) / Math.min(step, world.config.size - gz * step);
    const interpolate = grid => {
      const a = at(grid, gz * stride + gx), b = at(grid, gz * stride + gx + 1);
      const c = at(grid, (gz + 1) * stride + gx), d = at(grid, (gz + 1) * stride + gx + 1);
      return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) / 255;
    };
    warmth = interpolate(world.floraThermal) * 1.25 - Math.max(0, elevation) * .025;
    rain = interpolate(world.floraRain);
  } else {
    warmth = .95 - (1 - pz / world.config.size) * .42 - Math.max(0, elevation) * .025;
    const biome = at(world.biome, i);
    rain = ({ 5: .45, 6: .3, 10: .7, 11: .85 })[biome] ?? .62;
  }
  const shore = at(world.distance, i) ?? 255;
  const moisture = clamp(rain + .25 * (1 - Math.min(24, shore) / 24));
  return { temperature: clamp(warmth), moisture, elevation, shore, slope: at(world.slope, i) ?? 0 };
}
