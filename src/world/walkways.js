import { WALL_WIDTH } from './fortifications.js';
import { gridSample } from './math.js';

export const WALK_WIDTH = 1.02;
const STAIR_WIDTH = .92;
const STAIR_INSET = WALL_WIDTH / 2 + STAIR_WIDTH / 2 - .02;
const MAX_RISER = .23;
const MIN_TREAD = .19;
export const bridgeRise = t => Math.sin(t * Math.PI) * .33;

export function layFortWalkway(world, fort, route) {
  const { bounds, gate, pieces, side, entryDepth } = fort;
  const { stride, ground } = world;
  const at = (x, z) => gridSample(ground, stride, x, z);
  const index = (x, z) => z * stride + x;
  const towers = pieces.filter(piece => piece.kind === 'tower');
  const gatehouse = pieces.find(piece => piece.kind === 'gate');
  let y = -Infinity;
  for (const piece of pieces) {
    if (!['wall', 'tower', 'gate'].includes(piece.kind)) continue;
    const rise = piece === gatehouse ? 2.98 : 2.12;
    for (const a of [-.5, 0, .5]) for (const b of [-.5, 0, .5]) {
      y = Math.max(y, at(piece.x + a * piece.width, piece.z + b * piece.depth) + rise);
    }
  }
  const nodes = towers.map(({ x, z }) => ({ x, y, z }));
  const edges = [];
  const add = node => nodes.push(node) - 1;
  const connect = (from, to, kind, width, steps) => edges.push(
    steps === undefined ? { from, to, kind, width } : { from, to, kind, width, steps });
  const gateNodes = [];
  for (let d = -entryDepth; d <= 6; d++) {
    const x = gate.x + gate.dx * d, z = gate.z + gate.dz * d;
    const node = add({ x, y: at(x, z), z });
    if (gateNodes.length) connect(gateNodes.at(-1), node, 'portao', 1.65);
    gateNodes.push(node);
  }
  const goal = nodes[gateNodes[entryDepth - 1]];
  const stairs = [];
  for (const [i, a] of towers.entries()) {
    const next = (i + 1) % 4, b = towers[next];
    connect(i, next, 'adarve', WALK_WIDTH);
    if (i % 2 === side % 2) continue;
    const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z);
    const ix = -dz, iz = dx;
    const run = Math.hypot(b.x - a.x, b.z - a.z) / 2 - 1.98;
    for (const [tower, end, sign] of [[a, i, 1], [b, next, -1]]) {
      const ux = dx * sign, uz = dz * sign;
      const atDistance = d => ({ x: tower.x + ux * d + ix * STAIR_INSET, z: tower.z + uz * d + iz * STAIR_INSET });
      const to = { ...atDistance(1.68), y }, landing = { ...atDistance(1.03), y };
      const from = atDistance(1.68 + run);
      from.y = at(from.x, from.z);
      const steps = Math.ceil((y - from.y) / MAX_RISER);
      if (steps < 1 || run / steps < MIN_TREAD) return false;
      for (let n = 0; n < steps; n++) {
        const tread = atDistance(1.68 + run * (1 - (n + .5) / steps));
        const h = from.y + (y - from.y) * (n + 1) / steps;
        if (at(tread.x, tread.z) > h + .04) return false;
      }
      stairs.push({ kind: 'stairs', x: (from.x + to.x) / 2, z: (from.z + to.z) / 2, side: i, tower: end,
        from, to, landing, steps, width: STAIR_WIDTH, depth: STAIR_WIDTH, dx: -ux, dz: -uz, ix, iz });
    }
  }

  const obstacles = pieces.filter(p => ['keep', 'well', 'tower'].includes(p.kind));
  const blocked = (x, z) => x <= bounds.minX + .68 || x >= bounds.maxX - .68 ||
    z <= bounds.minZ + .68 || z >= bounds.maxZ - .68 ||
    obstacles.some(p => p.kind === 'tower' ? Math.hypot(p.x - x, p.z - z) < p.width / 2 + .21 :
      Math.abs(p.x - x) < p.width / 2 + .25 && Math.abs(p.z - z) < p.depth / 2 + .25) ||
    stairs.some(p => Math.abs(x - p.x) < Math.abs(p.to.x - p.from.x) / 2 + Math.abs(p.dz) * .52 &&
      Math.abs(z - p.z) < Math.abs(p.to.z - p.from.z) / 2 + Math.abs(p.dx) * .52);
  for (const stair of stairs) {
    const { from, to, landing, steps, width, tower, ix, iz } = stair;
    const candidates = [.55, .90, 1.3].map(d => ({ x: Math.round(from.x + ix * d), z: Math.round(from.z + iz * d) }));
    const path = candidates.map(p => !blocked(p.x, p.z) && Math.abs(at(p.x, p.z) - from.y) <= .54
      ? route(world, index(goal.x, goal.z), index(p.x, p.z), blocked, 1200) : []).find(p => p.length);
    if (!path) return false;

    let previous = gateNodes[entryDepth - 1];
    for (const i of path.slice(1)) {
      const next = add({ x: i % stride, y: ground[i], z: Math.floor(i / stride) });
      connect(previous, next, 'patio', width);
      previous = next;
    }
    const foot = add(from), top = add(to), join = add(landing);
    connect(previous, foot, 'patio', width);
    connect(foot, top, 'escada', width, steps);
    connect(top, join, 'patamar', width);
    connect(join, tower, 'patamar', width);
  }
  for (const piece of pieces) if (['wall', 'tower', 'gate'].includes(piece.kind)) piece.walkY = y;
  pieces.push(...stairs);
  fort.walkway = { nodes, edges, width: WALK_WIDTH, entry: gateNodes.at(-1) };
  return true;
}
export function bridgeWalkway(world, bridge) {
  const { stride, ground } = world;
  const { a, b, deck } = bridge;
  const ax = a % stride, az = Math.floor(a / stride), bx = b % stride, bz = Math.floor(b / stride);
  const length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length, dz = (bz - az) / length;
  const intervals = Math.ceil(length / .26);
  const bank = (x, z, sign) => {
    const ramp = Math.max(.85, (deck + .095 - gridSample(ground, stride, x, z)) * 1.85);
    x += sign * dx * ramp;
    z += sign * dz * ramp;
    return { x, y: gridSample(ground, stride, x, z) + .02, z };
  };
  const nodes = [bank(ax, az, -1)];
  for (let i = 0; i <= intervals; i++) {
    const t = i / intervals;
    nodes.push({ x: ax + (bx - ax) * t, y: deck + bridgeRise(t) + .095, z: az + (bz - az) * t });
  }
  nodes.push(bank(bx, bz, 1));
  return { nodes, width: 1.55, entry: 0, edges: nodes.slice(1).map((_, i) => ({ from: i, to: i + 1, kind: 'ponte' })) };
}
