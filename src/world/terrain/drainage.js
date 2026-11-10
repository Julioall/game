/*
 * Adapted from assignDownslope and assignFlow in Red Blob Games Mapgen4 (map.ts).
 * Copyright 2018 Red Blob Games <redblobgames@gmail.com>. Apache-2.0.
 * Changes: regular eight-neighbor grid, outlet-only roots, priority-flood spill
 * surfaces for lakes, grid-index parents, and distance-weighted grade.
 */
import FlatQueue from 'flatqueue';

export const DX = [1, 0, -1, 0, 1, -1, -1, 1];
export const DZ = [0, 1, 0, -1, 1, 1, -1, -1];

export function drain(height, rain, stride, sea) {
  const queue = new FlatQueue();
  const downstream = new Int32Array(height.length).fill(-2);
  const order = new Int32Array(height.length);
  const filled = new Float32Array(height.length);
  const flux = new Float32Array(height.length);
  const slope = new Float32Array(height.length);
  let written = 0;

  function visit(i, parent, level) {
    downstream[i] = parent;
    filled[i] = level;
    queue.push(i, filled[i]);
  }

  for (let z = 0; z < stride; z++) for (let x = 0; x < stride; x++) {
    if (x === 0 || z === 0 || x === stride - 1 || z === stride - 1) {
      const i = z * stride + x;
      visit(i, -1, Math.max(sea, height[i]));
    }
  }

  while (queue.length) {
    const i = queue.pop();
    order[written++] = i;
    const x = i % stride, z = Math.floor(i / stride);
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], nz = z + DZ[k];
      if (nx < 0 || nz < 0 || nx >= stride || nz >= stride) continue;
      const j = nz * stride + nx;
      if (downstream[j] !== -2) continue;
      visit(j, i, Math.max(height[j], filled[i]));
    }
  }

  for (let i = 0; i < height.length; i++) {
    if (height[i] > sea) flux[i] = rain[i] * rain[i];
    const j = downstream[i];
    if (j >= 0) slope[i] = (filled[i] - filled[j]) / (Math.abs(j - i) === 1 || Math.abs(j - i) === stride ? 1 : Math.SQRT2);
  }
  for (let p = order.length - 1; p >= 0; p--) {
    const i = order[p], j = downstream[i];
    if (j >= 0) flux[j] += flux[i];
  }
  return { downstream, filled, flux, slope, order };
}
