export function worldLandmarks(world) {
  if (world.landmarks) return world.landmarks;
  let peak = 0;
  const basins = new Map();
  for (let i = 0; i < world.ground.length; i++) {
    if (world.ground[i] > world.ground[peak]) peak = i;
    if (!world.lake[i]) continue;
    const height = world.filled[i], sample = basins.get(height);
    if (sample) {
      sample.x += i % world.stride;
      sample.z += Math.floor(i / world.stride);
      sample.n++;
    } else basins.set(height, { x: i % world.stride, z: Math.floor(i / world.stride), n: 1 });
  }
  const biggest = [...basins.values()].sort((a, b) => b.n - a.n)[0];
  return {
    peak: { x: peak % world.stride, z: Math.floor(peak / world.stride) },
    lake: biggest && { x: biggest.x / biggest.n, z: biggest.z / biggest.n }
  };
}
