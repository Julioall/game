import { clamp, hash, mix, smooth } from '../math.js';
import { drain, DX, DZ } from './drainage.js';
import { deepenMouth, traceMouthPath } from './water-flow.js';

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

const HEADWATER_LENGTH = 16;
const PRUNED = 255;

function refineChannels(river, lake, { downstream, order }, minimumInlet, headwaterSteps) {
  // Reuse the river mask to count the longest upstream run, capped at the end of the source taper.
  for (let p = order.length - 1; p >= 0; p--) {
    const i = order[p];
    if (!river[i]) continue;
    const j = downstream[i];
    if (river[j]) river[j] = Math.max(river[j], Math.min(headwaterSteps, river[i] + 1));
  }
  // Remove the whole short branch ending at a lake, without cutting tributaries of longer rivers.
  for (const i of order) {
    if (!river[i]) continue;
    const j = downstream[i];
    if (river[j] === PRUNED || (lake[j] && river[i] <= minimumInlet)) river[i] = PRUNED;
  }
}

function carveHeadwaterPond(seed, i, j, stride, strength, lake, river, waterKind, wet, surface, ground) {
  const x = i % stride, z = Math.floor(i / stride);
  const dx = j % stride - x, dz = Math.floor(j / stride) - z;
  const outletLength = Math.hypot(dx, dz), ax = dx / outletLength, az = dz / outletLength;
  const compactTerrain = stride <= 769;
  const scale = mix(.65, 1, smooth(768, 3000, stride - 1)) * mix(.86, 1.13, strength);
  const length = scale * mix(4.4, 6.5, hash(seed, x, z, 114));
  const width = scale * mix(3, 4.8, hash(seed, x, z, 115));
  const level = surface[i];
  const radius = Math.ceil(length * 1.62 + 1);
  for (let nz = Math.max(0, z - radius); nz <= Math.min(stride - 1, z + radius); nz++) {
    for (let nx = Math.max(0, x - radius); nx <= Math.min(stride - 1, x + radius); nx++) {
      const k = nz * stride + nx;
      // Small maps already pack settlements tightly around the drainage network.
      if (compactTerrain && wet[k] <= 0) continue;
      if (k !== i && (river[k] || lake[k] || waterKind[k] === 1 ||
          (waterKind[k] >= 3 && surface[k] - ground[k] > .2))) continue;
      const along = (nx - x) * ax + (nz - z) * az;
      const across = (nz - z) * ax - (nx - x) * az;
      const u = along / length + .66;
      const v = across / width;
      // The basin widens upstream and tapers toward the existing downstream cell.
      const distance = Math.hypot(u, v * (1 + .24 * u));
      if (distance >= 1) continue;
      const depth = mix(.04, .95, smooth(1, .12, distance));
      ground[k] = Math.min(ground[k], level - depth);
      surface[k] = level;
      wet[k] = Math.max(.03, Math.min(1.4, depth));
      lake[k] = 2;
      waterKind[k] = 2;
    }
  }
}

function waterFields(config, raw, drainage, lake, stride, sea) {
  const { downstream, filled, flux, slope } = drainage;
  const surface = new Float32Array(raw.length), wet = new Float32Array(raw.length).fill(-1.4);
  // 0 = dry, 1 = sea, 2 = lake, 3–10 = river directions in drainage order.
  const waterKind = new Uint8Array(raw.length);
  const ground = raw.slice(), river = new Uint8Array(raw.length), falls = [];
  const threshold = mix(220, 27, config.rivers) * (config.size / 256) ** 1.32;
  let edges = 0, confluences = 0;
  const headwaters = [];
  const riverMouths = [];
  const feeders = new Uint8Array(raw.length);
  const revised = config.hydrology !== 1;
  const landscaped = config.hydrology >= 3;
  const headwaterSteps = landscaped
    ? Math.round(mix(HEADWATER_LENGTH, 235, clamp((config.size - 768) / (5000 - 768))))
    : HEADWATER_LENGTH;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] <= sea) {
      waterKind[i] = 1;
      wet[i] = Math.max(.03, Math.min(1.4, sea - raw[i]));
      surface[i] = sea;
    } else if (lake[i]) {
      waterKind[i] = 2;
      wet[i] = Math.max(.03, Math.min(1.4, filled[i] - raw[i]));
      surface[i] = filled[i];
    }
    if (config.rivers && flux[i] >= threshold && downstream[i] >= 0 && raw[i] > sea && !lake[i]) {
      river[i] = 1;
    }
  }

  if (revised && config.rivers) {
    refineChannels(river, lake, drainage, Math.round(4 + config.size / 600), headwaterSteps);
  }
  for (let i = 0; i < river.length; i++) {
    if (river[i] === PRUNED) river[i] = 0;
    if (!river[i]) continue;
    feeders[downstream[i]]++;
    edges++;
  }

  function elevation(i) {
    if (revised) return raw[i] <= sea ? sea : filled[i];
    return lake[i] || raw[i] <= sea ? filled[i] : filled[i] - .16;
  }

  for (let i = 0; i < raw.length; i++) {
    if (!river[i]) continue;
    if (feeders[i] > 1) confluences++;
    const j = downstream[i];
    const x = i % stride, z = Math.floor(i / stride);
    const jx = j % stride, jz = Math.floor(j / stride);
    const dx = jx - x, dz = jz - z, len2 = dx * dx + dz * dz;
    const direction = DX.findIndex((step, k) => step === dx && DZ[k] === dz) + 3;
    const start = elevation(i), end = Math.min(start, elevation(j));
    const strength = landscaped ? smooth(1, 3.2, flux[i] / threshold) : 0;
    const maximumWidth = landscaped && config.size > 768 ? mix(2.85, 3.35, strength) : 2.85;
    const fullWidth = clamp(.41 + Math.sqrt(flux[i]) * .045, .68, maximumWidth);
    const narrowWidth = Math.min(mix(.78, 1.02, strength), fullWidth);
    const startTaper = revised ? smooth(1, headwaterSteps, river[i]) : 1;
    const endTaper = revised && river[j] ? smooth(1, headwaterSteps, river[j]) : 1;
    const width = revised ? mix(narrowWidth, fullWidth, startTaper) : fullWidth;
    const endWidth = mix(narrowWidth, fullWidth, endTaper);
    if (slope[i] > .96 && width > .94) falls.push({ i, j, start, end, width });
    const radius = Math.ceil(Math.max(width, endWidth) + 1);
    for (let nz = Math.max(0, z - radius); nz <= Math.min(stride - 1, z + radius); nz++) {
      for (let nx = Math.max(0, x - radius); nx <= Math.min(stride - 1, x + radius); nx++) {
        const k = nz * stride + nx;
        if (lake[k] || raw[k] <= sea) continue;
        const t = clamp(((nx - x) * dx + (nz - z) * dz) / len2);
        const distance = Math.hypot(nx - x - dx * t, nz - z - dz * t);
        const influence = (revised ? mix(width, endWidth, t) : width) - distance;
        if (influence <= wet[k]) continue;
        const level = revised && river[k] ? elevation(k) : mix(start, end, t);
        wet[k] = influence;
        waterKind[k] = influence > 0 ? direction : 0;
        surface[k] = level;
        if (influence >= 0) {
          const depth = .18 + Math.min(influence, 1) * .47;
          const taper = revised && river[k] ? smooth(1, headwaterSteps, river[k]) : mix(startTaper, endTaper, t);
          const bed = revised ? mix(landscaped && config.size > 768 ? .10 : .035, depth, taper) : depth;
          ground[k] = Math.min(ground[k], revised ? level - bed : level - .18 - Math.min(influence, 1) * .47);
        }
        else if (influence > -1) ground[k] = Math.min(ground[k], mix(level + .18, raw[k], -influence));
      }
    }
  }
  if (landscaped && config.lakes > 0 && edges > 0) {
    for (let i = 0; i < river.length; i++) {
      if (river[i] !== 1) continue;
      const strength = smooth(1, 3.2, flux[i] / threshold);
      carveHeadwaterPond(config.seed, i, downstream[i], stride, strength, lake, river, waterKind, wet, surface, ground);
      headwaters.push(i);
      // The former first river cell is now part of the pond. The downstream channel keeps its original link.
      river[i] = 0;
      edges--;
    }
  }
  for (let i = 0; i < raw.length; i++) {
    if (river[i]) river[i] = 1;
    const j = downstream[i];
    if (river[i] && j >= 0 && (waterKind[j] === 1 || waterKind[j] === 2)) {
      const x = i % stride, z = Math.floor(i / stride);
      const dx = j % stride - x, dz = Math.floor(j / stride) - z;
      const distance = Math.hypot(dx, dz);
      riverMouths.push({ x: j % stride, z: Math.floor(j / stride), dx: dx / distance, dz: dz / distance,
        level: surface[j], kind: waterKind[j], width: Math.max(.8, wet[i]),
        length: clamp(12 + Math.sqrt(flux[i]) * .09, 14, 32) });
    }
    if (wet[i] > 0) continue;
    const x = i % stride, z = Math.floor(i / stride);
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], nz = z + DZ[k], j = nz * stride + nx;
      if (nx < 0 || nz < 0 || nx >= stride || nz >= stride) continue;
      if (lake[j] || raw[j] <= sea) wet[i] = Math.max(wet[i], Math.min(-.02, surface[j] - ground[i]));
    }
    surface[i] = ground[i];
  }
  for (const mouth of riverMouths) {
    mouth.path = traceMouthPath({ stride, wet, surface, ground, waterKind }, mouth);
  }
  if (config.hydrology >= 4) {
    for (const mouth of riverMouths) deepenMouth({ stride, wet, surface, ground, waterKind }, mouth);
  }
  return { wet, surface, ground, waterKind, river, falls, edges, confluences, headwaters, headwaterSteps, riverMouths };
}

export function hydrology(config, stride, { raw, rain, sea }) {
  const drainage = drain(raw, rain, stride, sea);
  const { lake, count } = markLakes(raw, drainage.filled, stride, sea, config.lakes);
  const fields = waterFields(config, raw, drainage, lake, stride, sea);
  return { drainage, lake, count, fields };
}
