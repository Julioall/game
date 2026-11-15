import { DX, DZ } from './drainage.js';

// Chebyshev distance is a conservative lower bound on distance to the sea.
// Two bounded grid sweeps avoid scanning the coastline for every lake.
export function coastDistances(raw, stride, sea) {
  const distance = new Uint16Array(raw.length);
  for (let i = 0; i < raw.length; i++) distance[i] = raw[i] <= sea ? 0 : 65535;
  for (let z = 0; z < stride; z++) for (let x = 0; x < stride; x++) {
    const i = z * stride + x;
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
    if (z) {
      distance[i] = Math.min(distance[i], distance[i - stride] + 1);
      if (x) distance[i] = Math.min(distance[i], distance[i - stride - 1] + 1);
      if (x + 1 < stride) distance[i] = Math.min(distance[i], distance[i - stride + 1] + 1);
    }
  }
  for (let z = stride - 1; z >= 0; z--) for (let x = stride - 1; x >= 0; x--) {
    const i = z * stride + x;
    if (x + 1 < stride) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
    if (z + 1 < stride) {
      distance[i] = Math.min(distance[i], distance[i + stride] + 1);
      if (x) distance[i] = Math.min(distance[i], distance[i + stride - 1] + 1);
      if (x + 1 < stride) distance[i] = Math.min(distance[i], distance[i + stride + 1] + 1);
    }
  }
  return distance;
}

export function lakeFedChannels(config, raw, lake, drainage, stride, sea, river, threshold, blocked) {
  const { downstream, order, flux, filled } = drainage;
  const clearance = Math.min(100, Math.max(12, config.size * .08));
  const connected = config.hydrology >= 9;
  const coast = coastDistances(raw, stride, sea);
  const reachesSea = new Uint8Array(raw.length);
  for (const i of order) {
    const j = downstream[i];
    reachesSea[i] = raw[i] <= sea || (!blocked?.[i] && j >= 0 && reachesSea[j]) ? 1 : 0;
  }
  const visited = new Uint8Array(raw.length), sources = [];
  river.fill(0);
  if (!config.rivers || !config.lakes) {
    if (connected) lake.fill(0);
    return sources;
  }
  for (let i = 0; i < lake.length; i++) {
    if (!lake[i] || visited[i]) continue;
    const group = [i];
    visited[i] = 1;
    let nearestSea = 65535, outlet = -1;
    for (let p = 0; p < group.length; p++) {
      const k = group[p], x = k % stride, z = Math.floor(k / stride), j = downstream[k];
      nearestSea = Math.min(nearestSea, coast?.[k] ?? 65535);
      if (j >= 0 && !lake[j] && (connected || raw[j] > sea) && reachesSea[k] &&
          (outlet < 0 || flux[k] > flux[outlet])) outlet = k;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d], nz = z + DZ[d], n = nz * stride + nx;
        if (nx < 0 || nz < 0 || nx >= stride || nz >= stride || visited[n] || !lake[n]) continue;
        // Separate basins touching diagonally can have different water levels.
        if (filled[n] !== filled[k]) continue;
        visited[n] = 1;
        group.push(n);
      }
    }
    if ((connected && nearestSea < clearance) || (connected && group.some(k => !reachesSea[k])) || outlet < 0 || (!connected && (nearestSea < clearance || flux[outlet] < threshold))) {
      if (connected) for (const k of group) lake[k] = 0;
      continue;
    }
    sources.push(outlet);
  }
  // Follow the authoritative tree, crossing intermediate lakes until the sea.
  // Already marked reaches are shared and never walked a second time.
  const routed = new Uint8Array(raw.length);
  const routeSources = connected ? lake.keys() : sources;
  for (const source of routeSources) {
    if (connected && !lake[source]) continue;
    for (let i = downstream[source]; i >= 0 && raw[i] > sea && !routed[i]; i = downstream[i]) {
      routed[i] = 1;
      if (!lake[i]) river[i] = 1;
    }
  }
  return sources;
}
