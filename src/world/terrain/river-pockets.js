// Heal only tiny *enclosed* holes in the freshwater river raster.
// A river bank, peninsula, genuine island or ocean/estuary edge must remain dry.
// This is a presentation/terrain-generation operation, never a frame-time pass.
const CARDINAL = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function closeRiverPockets(world, { maximumArea = 3, blocked = null } = {}) {
  const { stride, wet, surface, ground, waterKind } = world;
  const visited = new Uint8Array(wet.length);
  let filled = 0;
  const isCandidate = (i, x, z) => {
    if (x < 1 || z < 1 || x >= stride - 1 || z >= stride - 1 ||
        wet[i] > 0 || blocked?.[i]) return false;
    let adjacentRiver = 0;
    for (const [dx, dz] of CARDINAL) {
      const j = i + dz * stride + dx;
      if (wet[j] > 0 && waterKind[j] >= 3) adjacentRiver++;
    }
    return adjacentRiver >= 2;
  };

  for (let z = 1; z < stride - 1; z++) for (let x = 1; x < stride - 1; x++) {
    const origin = z * stride + x;
    if (visited[origin] || !isCandidate(origin, x, z)) continue;
    const queue = [origin];
    visited[origin] = 1;
    let enclosed = true, levelSum = 0, perimeter = 0;
    let lowest = Infinity, highest = -Infinity, direction = 3;
    for (let at = 0; at < queue.length; at++) {
      const i = queue[at], cx = i % stride, cz = Math.floor(i / stride);
      if (queue.length > maximumArea) enclosed = false;
      for (const [dx, dz] of CARDINAL) {
        const nx = cx + dx, nz = cz + dz, j = nz * stride + nx;
        if (nx < 1 || nz < 1 || nx >= stride - 1 || nz >= stride - 1) {
          enclosed = false;
          continue;
        }
        if (wet[j] > 0 && waterKind[j] >= 3) {
          const level = surface[j];
          lowest = Math.min(lowest, level);
          highest = Math.max(highest, level);
          levelSum += level;
          perimeter++;
          direction = waterKind[j];
        } else if (wet[j] <= 0 && isCandidate(j, nx, nz)) {
          if (!visited[j]) { visited[j] = 1; queue.push(j); }
        } else {
          // Unconnected dry bank, open sea, lake or excluded terrain.
          enclosed = false;
        }
      }
    }
    if (!enclosed || !perimeter || queue.length > maximumArea ||
        highest - lowest > .25) continue;
    const level = levelSum / perimeter;
    if (queue.some(i => ground[i] > level + .24)) continue;
    for (const i of queue) {
      surface[i] = level;
      ground[i] = Math.min(ground[i], level - .18);
      wet[i] = .22;
      waterKind[i] = direction;
    }
    filled += queue.length;
  }
  return filled;
}
