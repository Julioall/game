import { bridgeRise } from '../world/walkways.js';
import { box, part, stick } from './mesh-parts.js';

export function buildBridge(parts, bridge, world) {
  const { a, b, deck } = bridge, { stride, ground } = world;
  const ax = a % stride, az = Math.floor(a / stride), bx = b % stride, bz = Math.floor(b / stride);
  const length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length, dz = (bz - az) / length;
  const angle = Math.atan2(-dz, dx);
  const planks = bridge.walkway.nodes.slice(1, -1);
  for (const node of planks) {
    const t = Math.hypot(node.x - ax, node.z - az);
    const y = node.y - .095;
    const paint = Math.floor(t * 61) % 3 ? '#a78756' : '#bc9b66';
    part(parts, box, paint, node.x, y, node.z, length / (planks.length - 1) + .003, .19, 2.02, angle);
  }
  const path = bridge.walkway.nodes;
  for (const [a, b] of [[path[0], path[1]], [path.at(-2), path.at(-1)]]) {
    const run = Math.hypot(b.x - a.x, b.z - a.z), rise = b.y - a.y;
    part(parts, box, '#a68755', (a.x + b.x) / 2, (a.y + b.y) / 2 - .065, (a.z + b.z) / 2,
      Math.hypot(run, rise) + .06, .13, 1.98, angle, Math.atan2(rise, run), .14);
  }
  for (let side of [-1, 1]) {
    const rail = [];
    for (let t = 0; t <= length; t += 1) {
      const x = ax + dx * t + dz * side * .88, z = az + dz * t - dx * side * .88;
      const y = deck + bridgeRise(t / length);
      rail.push([x, y + .58, z]);
      part(parts, box, '#7b674d', x, y + .31, z, .19, .79, .19, angle);
    }
    for (let i = 1; i < rail.length; i++) stick(parts, '#9e8056', rail[i - 1], rail[i], .09);
  }
  for (let t of [0, 1, length - 1, length]) {
    const x = ax + dx * t, z = az + dz * t, i = Math.round(z) * stride + Math.round(x);
    const low = Math.min(ground[i] - .16, deck - .34);
    part(parts, box, '#827b6a', x, (low + deck) / 2 - .06, z, .84, deck - low, 1.82, angle, 0, .16);
  }
}
