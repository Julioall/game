import { flowDirection } from '../world/terrain/water.js';
import { mouthFlow } from '../world/terrain/water-flow.js';

// Presentation only: smooth the eight drainage directions and extend their
// influence through connected receiving water, using local mouth candidates.
export function waterMotion(world, x, z, kind, mouths = [], work) {
  const ix = Math.round(x), iz = Math.round(z), stride = world.stride;
  const level = world.surface.at(iz * stride + ix);
  let ax = 0, az = 0;
  if (kind >= 3) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = ix + dx, nz = iz + dz;
      if (nx < 0 || nz < 0 || nx >= stride || nz >= stride) continue;
      const i = nz * stride + nx;
      if (work) work.directionSamples = (work.directionSamples ?? 0) + 1;
      if (world.wet.at(i) <= 0 || world.waterKind.at(i) < 3 || Math.abs(world.surface.at(i) - level) > .45) continue;
      const [vx, vz] = flowDirection(world.waterKind.at(i));
      const weight = 1 / (1 + dx * dx + dz * dz);
      ax += vx * weight; az += vz * weight;
    }
    const length = Math.hypot(ax, az);
    if (length > .001) { ax /= length; az /= length; }
    else [ax, az] = flowDirection(kind);
  }
  const transition = { strength: 0, progress: 0, lateral: 0 };
  const receivers = kind === 1 || kind === 2 ? mouths.filter(mouth => mouth.kind === kind) : [];
  const vector = receivers.length ? mouthFlow(world, x, z, receivers, [ax, az, 0], transition, work) : [ax, az, 0];
  return { flow: vector.slice(0, 2), transition: [transition.strength, transition.progress, transition.lateral] };
}

// Two overlapping advection phases keep spatially varying flow bounded in time.
export function waterPhases(seconds) {
  const phase = ((seconds * .125) % 1 + 1) % 1;
  return { first: phase, second: (phase + .5) % 1, blend: Math.abs(phase * 2 - 1) };
}
