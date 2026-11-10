import { clamp, mix } from '../math.js';
import { drain, DX, DZ } from './drainage.js';

function markLakes(raw, filled, stride, sea, frequency) {
  const lake = new Uint8Array(raw.length);
  const visited = new Uint8Array(raw.length);
  let count = 0;
  if (!frequency) return { lake, count };
  for (let i = 0; i < raw.length; i++) {
    if (visited[i] || filled[i] < sea + .12 || filled[i] - raw[i] < .075) continue;
    const group = [i], level = filled[i];
    let deepest = 0;
    visited[i] = 1;
    for (let p = 0; p < group.length; p++) {
      const j = group[p], x = j % stride, z = Math.floor(j / stride);
      deepest = Math.max(deepest, level - raw[j]);
      for (let k = 0; k < 4; k++) {
        const a = x + DX[k], b = z + DZ[k], n = b * stride + a;
        if (a < 0 || a >= stride || b < 0 || b >= stride || visited[n]) continue;
        if (filled[n] === level && level - raw[n] >= .075) {
          group.push(n);
          visited[n] = 1;
        }
      }
    }
    if (group.length < mix(115, 21, frequency) * ((stride - 1) / 256) ** 1.5 || deepest < .47) continue;
    count++;
    for (const j of group) lake[j] = 1;
  }
  return { lake, count };
}

function waterFields(config, raw, drainage, lake, stride, sea) {
  const { downstream, filled, flux, slope } = drainage;
  const surface = new Float32Array(raw.length), wet = new Float32Array(raw.length).fill(-1.4);
  const ground = raw.slice(), river = new Uint8Array(raw.length), falls = [];
  const threshold = mix(220, 27, config.rivers) * (config.size / 256) ** 1.32;
  let edges = 0, confluences = 0;
  const feeders = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] <= sea) {
      wet[i] = Math.max(.03, Math.min(1.4, sea - raw[i]));
      surface[i] = sea;
    } else if (lake[i]) {
      wet[i] = Math.max(.03, Math.min(1.4, filled[i] - raw[i]));
      surface[i] = filled[i];
    }
    if (config.rivers && flux[i] >= threshold && downstream[i] >= 0 && raw[i] > sea && !lake[i]) {
      river[i] = 1;
      feeders[downstream[i]]++;
      edges++;
    }
  }

  function elevation(i) {
    return lake[i] || raw[i] <= sea ? filled[i] : filled[i] - .16;
  }

  for (let i = 0; i < raw.length; i++) {
    if (!river[i]) continue;
    if (feeders[i] > 1) confluences++;
    const j = downstream[i];
    const x = i % stride, z = Math.floor(i / stride);
    const jx = j % stride, jz = Math.floor(j / stride);
    const dx = jx - x, dz = jz - z, len2 = dx * dx + dz * dz;
    const start = elevation(i), end = Math.min(start, elevation(j));
    const width = clamp(.41 + Math.sqrt(flux[i]) * .045, .68, 2.85);
    if (slope[i] > .96 && width > .94) falls.push({ i, j, start, end, width });
    const radius = Math.ceil(width + 1);
    for (let nz = Math.max(0, z - radius); nz <= Math.min(stride - 1, z + radius); nz++) {
      for (let nx = Math.max(0, x - radius); nx <= Math.min(stride - 1, x + radius); nx++) {
        const k = nz * stride + nx;
        if (lake[k] || raw[k] <= sea) continue;
        const t = clamp(((nx - x) * dx + (nz - z) * dz) / len2);
        const distance = Math.hypot(nx - x - dx * t, nz - z - dz * t);
        const influence = width - distance;
        if (influence <= wet[k]) continue;
        const level = mix(start, end, t);
        wet[k] = influence;
        surface[k] = level;
        if (influence >= 0) ground[k] = Math.min(ground[k], level - .18 - Math.min(influence, 1) * .47);
        else if (influence > -1) ground[k] = Math.min(ground[k], mix(level + .18, raw[k], -influence));
      }
    }
  }
  for (let i = 0; i < raw.length; i++) if (wet[i] <= 0) {
    const x = i % stride, z = Math.floor(i / stride);
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], nz = z + DZ[k], j = nz * stride + nx;
      if (nx < 0 || nz < 0 || nx >= stride || nz >= stride) continue;
      if (lake[j] || raw[j] <= sea) wet[i] = Math.max(wet[i], Math.min(-.02, surface[j] - ground[i]));
    }
    surface[i] = ground[i];
  }
  return { wet, surface, ground, river, falls, edges, confluences };
}

export function hydrology(config, stride, { raw, rain, sea }) {
  const drainage = drain(raw, rain, stride, sea);
  const { lake, count } = markLakes(raw, drainage.filled, stride, sea, config.lakes);
  const fields = waterFields(config, raw, drainage, lake, stride, sea);
  return { drainage, lake, count, fields };
}
