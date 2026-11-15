import { smooth } from '../math.js';
import { DX, DZ } from './drainage.js';

export function traceMouthPath(world, mouth) {
  const path = [{ x: mouth.x, z: mouth.z, distance: 0 }];
  const visited = new Set([mouth.z * world.stride + mouth.x]);
  let headingX = mouth.dx, headingZ = mouth.dz;
  while (path.at(-1).distance < mouth.length) {
    const previous = path.at(-1);
    let best = null, score = -Infinity;
    for (let k = 0; k < DX.length; k++) {
      const x = previous.x + DX[k], z = previous.z + DZ[k], i = z * world.stride + x;
      if (x < 0 || z < 0 || x >= world.stride || z >= world.stride || visited.has(i) ||
          world.waterKind.at(i) !== mouth.kind || world.wet.at(i) <= 0 ||
          Math.abs(world.surface.at(i) - mouth.level) > .35) continue;
      const length = Math.hypot(DX[k], DZ[k]), dx = DX[k] / length, dz = DZ[k] / length;
      const alignment = dx * headingX + dz * headingZ;
      if (alignment < -.05) continue;
      const depth = world.surface.at(i) - world.ground.at(i);
      const candidate = alignment * .7 + (dx * mouth.dx + dz * mouth.dz) * .3 + Math.min(depth, 3) * .4;
      if (candidate > score) {
        score = candidate;
        best = { x, z, distance: previous.distance + length, dx, dz };
      }
    }
    if (!best) break;
    path.push({ x: best.x, z: best.z, distance: best.distance });
    visited.add(best.z * world.stride + best.x);
    headingX = best.dx;
    headingZ = best.dz;
  }
  return path;
}

// Extend only through connected water at the receiver's elevation.
export function mouthFlow(world, x, z, mouths, base, mixing, work) {
  let flowX = base[0], flowZ = base[1], strongest = Math.hypot(flowX, flowZ);
  for (const mouth of mouths) {
    if (work) work.mouthCandidates++;
    let originX = mouth.x, originZ = mouth.z, directionX = mouth.dx, directionZ = mouth.dz, progress = 0;
    let nearest = Infinity;
    for (let i = 1; i < (mouth.path?.length ?? 0); i++) {
      if (work) work.pathSegments++;
      const a = mouth.path[i - 1], b = mouth.path[i];
      const dx = b.x - a.x, dz = b.z - a.z, length = b.distance - a.distance;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (length * length)));
      const px = a.x + dx * t, pz = a.z + dz * t;
      const distance = (x - px) ** 2 + (z - pz) ** 2;
      if (distance >= nearest) continue;
      nearest = distance;
      originX = px; originZ = pz;
      directionX = dx / length; directionZ = dz / length;
      progress = a.distance + length * t;
    }
    const px = x - originX, pz = z - originZ;
    const along = progress + px * directionX + pz * directionZ;
    const upstreamReach = mouth.kind === 1 ? -40 : -3;
    if (along <= upstreamReach || along >= mouth.length) continue;
    const across = pz * directionX - px * directionZ;
    const spread = mouth.width + 1.8 + Math.max(0, along) * .38;
    const weight = smooth(upstreamReach, mouth.kind === 1 ? -20 : 1, along) * (1 - smooth(0, mouth.length, Math.max(0, along)))
      * (1 - smooth(0, spread, Math.abs(across))) * .94;
    if (weight <= strongest && (!mixing || weight <= mixing.strength)) continue;
    const steps = Math.max(1, Math.ceil(Math.hypot(px, pz)));
    let connected = true;
    for (let step = 0; step <= steps; step++) {
      if (work) work.connectionSamples++;
      const t = step / steps;
      const i = Math.round(originZ + pz * t) * world.stride + Math.round(originX + px * t);
      if (world.wet.at(i) <= 0 || Math.abs(world.surface.at(i) - mouth.level) > .35) {
        connected = false;
        break;
      }
    }
    if (!connected) continue;
    if (mixing && weight > mixing.strength) {
      mixing.strength = weight;
      mixing.progress = Math.max(0, along) / mouth.length;
      mixing.lateral = across / spread;
    }
    if (weight <= strongest) continue;
    const lateral = across * .14 / spread;
    const dx = directionX - directionZ * lateral, dz = directionZ + directionX * lateral;
    const length = Math.hypot(dx, dz);
    flowX = dx / length * weight;
    flowZ = dz / length * weight;
    strongest = weight;
  }
  if (work && strongest > Math.hypot(base[0], base[1])) work.affectedQueries++;
  return [flowX, flowZ, base[2]];
}

export function deepenMouth(world, mouth) {
  const radius = mouth.width + 2 + mouth.length * .38;
  const points = mouth.path.length ? mouth.path : [mouth];
  const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x)) - radius));
  const maxX = Math.min(world.stride - 1, Math.ceil(Math.max(...points.map(p => p.x)) + radius));
  const minZ = Math.max(0, Math.floor(Math.min(...points.map(p => p.z)) - radius));
  const maxZ = Math.min(world.stride - 1, Math.ceil(Math.max(...points.map(p => p.z)) + radius));
  for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
    const i = z * world.stride + x;
    if (world.waterKind.at(i) !== mouth.kind || world.wet.at(i) <= 0) continue;
    const flow = mouthFlow(world, x, z, [mouth], [0, 0, 0]);
    const influence = Math.hypot(flow[0], flow[1]);
    const edge = smooth(.025, .55, world.wet.at(i));
    const depth = (mouth.kind === 1 ? 4.2 + mouth.width * .16 : 1.3 + mouth.width * .24) * influence * edge;
    world.ground[i] = Math.min(world.ground[i], world.surface[i] - depth);
  }
}


// Final terrain pass: one continuous bed across the sand and into the ocean.
export function carveEstuary(world, mouth) {
  if (mouth.kind !== 1) return;
  const upstream = 24, length = Math.max(36, mouth.length * 1.5);
  const radius = mouth.width + 12 + length * .18;
  const reach = upstream + length + radius;
  for (let z = Math.max(0, Math.floor(mouth.z - reach)); z <= Math.min(world.stride - 1, Math.ceil(mouth.z + reach)); z++) {
    for (let x = Math.max(0, Math.floor(mouth.x - reach)); x <= Math.min(world.stride - 1, Math.ceil(mouth.x + reach)); x++) {
      const px = x - mouth.x, pz = z - mouth.z;
      const along = px * mouth.dx + pz * mouth.dz;
      if (along <= -upstream || along >= length) continue;
      const bend = Math.sin(along * .13 + mouth.x * .07) * .6 + Math.sin(along * .29 + mouth.z * .09) * .25;
      const across = Math.abs(pz * mouth.dx - px * mouth.dz + bend);
      // Rounded shoulders begin inland; the offshore fan keeps opening.
      const shoulder = smooth(-upstream, 12, along);
      const fan = Math.max(0, along) * .18 * smooth(-12, 24, along);
      const width = (mouth.width * (.8 + shoulder * 1.15) + 2 + fan)
        * (1 + Math.sin(along * .11 + mouth.z) * .065
          + Math.sin(along * .27 + mouth.x) * .025);
      if (across >= width) continue;
      const i = z * world.stride + x;
      if (world.waterKind[i] === 2 || world.ground[i] > mouth.level + 4) continue;
      const lateral = 1 - smooth(width * .3, width, across);
      const radial = Math.hypot(Math.max(0, along) / length, across / width);
      const ramp = smooth(-upstream, -3, along) * (1 - smooth(.3, 1, radial));
      const bankFade = 1 - smooth(1.5, 4, world.ground[i] - mouth.level);
      const depth = 3.6 * lateral * ramp * bankFade;
      if (depth <= .02) continue;
      // Blend excavation into the existing sand instead of snapping every
      // affected bank vertex below sea level (which produced square corners).
      const weight = lateral * ramp * bankFade;
      const target = Math.min(world.ground[i], mouth.level - 3.6);
      world.ground[i] += (target - world.ground[i]) * weight;
      const actualDepth = mouth.level - world.ground[i];
      if (actualDepth > 0) {
        world.surface[i] = mouth.level;
        world.wet[i] = Math.max(world.wet[i], Math.min(1.4, actualDepth * 2));
        world.waterKind[i] = 1;
      }
    }
  }
}
