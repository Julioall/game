import * as T from 'three';
import { STRUCTURES } from '../world/catalog.js';
import { gridSample, hash } from '../world/math.js';
import { bridgeRise } from '../world/walkways.js';
import { WALL_WIDTH } from '../world/fortifications.js';
import { box, stone, trunk, part, stick, combine } from './mesh-parts.js';

const towerStone = new T.CylinderGeometry(1, 1, 1, 8);
const roofPyramid = new T.CylinderGeometry(0, 1, 1, 4).rotateY(Math.PI / 4);

function housePattern(geometry, pattern) {
  const { position, normal } = geometry.attributes;
  const coords = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = normal.getX(i), nz = normal.getZ(i);
    const roof = pattern <= 2;
    coords[i * 3] = roof ? x : x * nz - z * nx;
    coords[i * 3 + 1] = roof ? z : y;
    coords[i * 3 + 2] = pattern;
  }
  geometry.setAttribute('craft', new T.BufferAttribute(coords, 3));
}

function dwelling(parts, building, world) {
  const { x, z, footprint, kind, urban } = building;
  const seed = world.config.seed;
  const roll = hash(seed, x, z, 532);
  const variation = hash(seed, x, z, 533);
  const floors = kind === 'townhouse' && !urban ? 1 : STRUCTURES[kind].floors;
  const timber = '#634834', trim = '#8e6e4d', masonry = '#9b8c72';
  const plaster = ['#c9b68d', '#bca481', '#d2ba94'][Math.floor(roll * 3)];
  const thatch = !urban, slate = urban && roll < .19;
  const roofColor = thatch ? ['#a48442', '#ae9051', '#ba9b57'][Math.floor(roll * 3)]
    : slate ? '#5e6364' : ['#88563e', '#9d6045', '#a76b4a'][Math.floor(roll * 3)];
  const eaves = thatch ? .19 : .13;
  const width = footprint * (.77 + roll * .09), depth = footprint * (.66 + variation * .10);
  const story = 1.12 + variation * .17;
  const at = (px, pz) => gridSample(world.ground, world.stride, px, pz);
  const corners = [-1, 1].flatMap(dx => [-1, 1].map(dz => at(x + dx * width / 2, z + dz * depth / 2)));
  const base = Math.max(building.y, ...corners) + .07, bottom = Math.min(...corners) - .13;
  const boxPart = (paint, px, py, pz, w, h, d, angle = 0, lean = 0, pattern = 0) => {
    const mesh = part(parts, box, paint, px, py, pz, w, h, d, angle, lean, .12);
    if (pattern) housePattern(mesh, pattern);
  };
  boxPart(masonry, x, (bottom + base) / 2, z, width + .035, base - bottom + .025, depth + .035, 0, 0, 3);

  for (let floor = 0; floor < floors; floor++) {
    const y = base + floor * story;
    const upper = floor > 0;
    const w = width + (upper && urban ? .13 : 0), d = depth + (upper && urban ? .11 : 0);
    const boards = kind === 'cabin';
    const stoneFloor = !boards && !upper && (urban || kind === 'hall');
    boxPart(boards ? '#907050' : stoneFloor ? masonry : plaster,
      x, y + story / 2, z, w, story + .008, d, 0, 0, boards ? 4 : stoneFloor ? 3 : 5);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      boxPart(timber, x + a * w / 2, y + story / 2, z + b * d / 2, .086, story + .022, .086);
    }

    for (let side = 0; side < 4; side++) {
      const angle = side * Math.PI / 2, nx = Math.sin(angle), nz = Math.cos(angle);
      const span = side % 2 ? d : w, face = side % 2 ? w / 2 : d / 2;
      const panel = (paint, offset, rise, panelWidth, height, thickness, lean = 0, pattern = 0, layer = 0) =>
        boxPart(paint, x + nz * offset + nx * (face + layer), y + rise,
          z - nx * offset + nz * (face + layer), panelWidth, height, thickness, angle, lean, pattern);
      panel(timber, 0, story - .045, span + .09, .09, .087);
      const door = !upper && side === 0;
      if (door) {
        const offset = kind === 'workshop' ? 0 : -span * .18;
        const opening = Math.min(span * .39, kind === 'workshop' ? .82 : .56);
        panel('#49382a', offset, .44, opening + .10, .88, .11, 0, 0, .025);
        panel('#745535', offset, .41, opening, .81, .09, 0, 4, .057);
        panel('#a68557', offset + opening * .28, .43, .05, .055, .04, 0, 0, .11);
      }
      const windowX = door ? span * .24 : (variation - .5) * span * .27;
      const windowWidth = Math.min(.39, span * .22);
      panel(trim, windowX, .67, windowWidth + .10, .43, .10, 0, 0, .018);
      panel('#473e34', windowX, .67, windowWidth, .34, .10, 0, 0, .040);
      panel(trim, windowX, .67, .042, .32, .044, 0, 0, .099);
      for (const sign of [-1, 1]) {
        panel(roll > .55 ? '#696b45' : '#856044', windowX + sign * windowWidth * .68, .67,
          windowWidth * .35, .34, .045, 0, 4, .07);
      }
      if (!stoneFloor && !boards && !door) {
        const braceX = -span * .35, run = span * .22;
        panel(timber, braceX, .34, Math.hypot(run, .56), .067, .08, Math.atan2(.56, run) * (roll > .5 ? 1 : -1));
      }
    }
  }

  const wallTop = base + story * floors;
  const upperW = width + (floors > 1 && urban ? .13 : 0);
  const upperD = depth + (floors > 1 && urban ? .11 : 0);
  const roofW = Math.min(footprint - .02, upperW + eaves * 2);
  const roofD = Math.min(footprint / 2, upperD / 2 + eaves);
  const rise = roofD * (.85 + variation * .26);
  const eaveY = wallTop - .085;
  const slope = Math.atan2(rise, roofD);
  const gableEdge = rise * (1 - upperD / 2 / roofD) - .025;
  const gable = new T.Shape([
    new T.Vector2(-upperD / 2, 0), new T.Vector2(-upperD / 2, gableEdge),
    new T.Vector2(0, rise - .025),
    new T.Vector2(upperD / 2, gableEdge), new T.Vector2(upperD / 2, 0),
  ]);
  const gableShape = new T.ExtrudeGeometry(gable, { depth: upperW, bevelEnabled: false });
  gableShape.translate(0, 0, -upperW / 2);
  const gablePart = part(parts, gableShape, kind === 'cabin' ? '#907050' : plaster, x, eaveY, z,
    1, 1, 1, Math.PI / 2, 0, .12);
  housePattern(gablePart, kind === 'cabin' ? 4 : 5);
  gableShape.dispose();
  for (const sign of [-1, 1]) {
    const roof = part(parts, box, roofColor, 0, 0, 0, roofW, thatch ? .16 : .085,
      Math.hypot(rise, roofD) + .035, 0, 0, .17);
    roof.rotateX(sign * slope);
    roof.translate(x, eaveY + rise / 2, z + sign * roofD / 2);
    housePattern(roof, thatch ? 1 : 2);
  }
  boxPart(roofColor, x, eaveY + rise, z, roofW + .02, thatch ? .16 : .105, thatch ? .18 : .13, 0, 0, thatch ? 1 : 2);

  if (kind !== 'cabin' || variation > .35) {
    const chimneyX = x + width * .30, chimneyZ = z - depth * .22;
    const top = eaveY + rise * (.91 + roll * .27);
    const foot = eaveY + rise * .46;
    boxPart(urban ? '#92624d' : '#9e8b71', chimneyX, (foot + top) / 2, chimneyZ, .24, top - foot, .26, 0, 0, 3);
    boxPart(masonry, chimneyX, top, chimneyZ, .30, .08, .30);
  }
  if (kind === 'inn' || kind === 'workshop') {
    const front = z + depth / 2;
    boxPart(timber, x - width * .30, base + .99, front + .085, .09, .06, .21);
    boxPart(kind === 'inn' ? '#846247' : '#77774d', x - width * .30,
      base + .86, front + .18, .23, .18, .055, 0, 0, 4);
  }
}

export function house(parts, building, world) {
  const { x, z, kind } = building;
  if (kind === 'market') {
    market(parts, building, world);
  } else if (kind === 'chapel') {
    chapel(parts, building, world);
  } else if (kind === 'manor') {
    const at = (px, pz) => gridSample(world.ground, world.stride, px, pz);
    const corners = [-2.25, 2.25].flatMap(dx => [-1.8, 1.8].map(dz => at(x + dx, z + dz)));
    keepModel(parts, { x, z, width: 4.5, depth: 3.6, frontX: 0, frontZ: 1, banner: '#8b6b4b' },
      Math.min(...corners) - .18, Math.max(building.y, ...corners));
  } else {
    dwelling(parts, building, world);
  }
}

function market(parts, building, world) {
  const { x, y, z, banner } = building;
  const cloth = new T.Color(banner).lerp(new T.Color('#a58961'), .44);
  const slanted = hash(world.config.seed, x, z, 71) > .45;
  const canopyY = b => y + 1.86 - (slanted ? b * .28 : 0);
  for (const a of [-.86, .86]) for (const b of [-.61, .61]) {
    const floor = gridSample(world.ground, world.stride, x + a, z + b);
    const eave = canopyY(b);
    part(parts, box, '#775639', x + a, (floor + eave) / 2, z + b, .12, eave - floor + .06, .12);
  }
  for (let i = 0; i < 8; i++) {
    const paint = i % 2 ? '#cdb58b' : cloth;
    const panel = part(parts, box, paint, 0, 0, 0, .25, .06, 1.64, 0, 0, .15);
    if (slanted) panel.rotateX(Math.atan(.28));
    panel.translate(x - .875 + i * .25, canopyY(0), z);
    part(parts, box, paint, x - .875 + i * .25, canopyY(.78) - .10, z + .78, .25, .20, .05);
  }
  part(parts, box, '#98734b', x, y + .76, z + .27, 1.75, .16, .81);
  for (let i = 0; i < 4; i++) {
    part(parts, box, '#795738', x + (i - 1.5) * .40, y + .91, z + .32, .32, .16, .41);
    part(parts, stone, ['#aa6135', '#c6a256', '#75904d', '#ba7539'][i], x + (i - 1.5) * .40,
      y + 1.02, z + .32, .13, .085, .13);
  }
  const floor = gridSample(world.ground, world.stride, x + .90, z + .70);
  part(parts, towerStone, '#866341', x + .90, floor + .24, z + .70, .23, .49, .23, .39, 0, .28);
  for (const h of [.12, .36]) part(parts, towerStone, '#584c3c', x + .90, floor + h, z + .70, .24, .049, .24, .39);
}

function pennant(parts, x, y, z, banner, angle = 0) {
  const dx = Math.cos(angle), dz = -Math.sin(angle);
  part(parts, box, '#6a4c36', x, y + .68, z, .095, 1.63, .095);
  part(parts, box, banner, x + dx * .49, y + .99, z + dz * .49, .98, .58, .052, angle, 0, .2);
  part(parts, box, '#dfbd79', x + dx * .49, y + .73, z + dz * .49, .98, .083, .056, angle);
}

function crenels(parts, x, y, z, length, angle, shade = '#a99b84') {
  const dx = Math.cos(angle), dz = -Math.sin(angle);
  const count = Math.max(1, Math.floor(length / .86));
  for (let n = 0; n < count; n++) {
    const a = length * ((n + .5) / count - .5);
    part(parts, box, shade, x + a * dx, y + .24, z + a * dz, .53, .49, .39, angle, 0, .21);
  }
}

function limestone(geometry, round) {
  const { position, normal } = geometry.attributes;
  const colors = geometry.attributes.color;
  geometry.computeBoundingBox();
  const foot = geometry.boundingBox.min.y;
  const craft = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = normal.getX(i), nz = normal.getZ(i);
    const top = Math.abs(normal.getY(i)) > .55;
    let u = x * nz - z * nx;
    if (round && !top) {
      const first = i - i % 3;
      const angle = Math.atan2(x - round.x, z - round.z);
      const start = Math.atan2(position.getX(first) - round.x, position.getZ(first) - round.z);
      const turn = Math.atan2(Math.sin(angle - start), Math.cos(angle - start));
      u = (start + turn) * round.radius;
    }
    craft.set(top ? [x, z, 6] : [u, y, 6], i * 3);
    const wear = Math.max(0, 1 - (y - foot) / 1.35) * .18;
    colors.setXYZ(i, colors.getX(i) * (1 - wear), colors.getY(i) * (1 - wear * .65), colors.getZ(i) * (1 - wear * 1.15));
  }
  geometry.setAttribute('craft', new T.BufferAttribute(craft, 3));
}

function gableRoof(parts, x, y, z, width, depth, rise, angle = 0, slate = '#635d60') {
  const roof = new T.Shape();
  roof.moveTo(-depth / 2, 0);
  roof.lineTo(0, rise);
  roof.lineTo(depth / 2, 0);
  const geometry = new T.ExtrudeGeometry(roof, { depth: width, bevelEnabled: false });
  geometry.translate(0, 0, -width / 2);
  part(parts, geometry, slate, x, y, z, 1, 1, 1, angle + Math.PI / 2, 0, .12);
  geometry.dispose();
  for (let row = 0; row < 5; row++) {
    const t = (row + .3) / 5;
    for (const side of [-1, 1]) {
      const d = side * depth / 2 * (1 - t);
      part(parts, box, row % 2 ? '#776f6c' : '#686468',
        x + Math.sin(angle) * d, y + rise * t + .03, z + Math.cos(angle) * d,
        width + .04, .045, .075, angle, 0, .14);
    }
  }
}

const FORT_STONE = '#9e947a', FORT_TRIM = '#c1b394', FORT_SLATE = '#565350', FORT_DARK = '#423a32';

function stoneBlock(parts, paint, x, y, z, w, h, d) {
  limestone(part(parts, box, paint, x, y, z, w, h, d, 0, 0, .16));
}

function archedInset(parts, x, y, z, width, height, angle, door = false) {
  const nx = Math.sin(angle), nz = Math.cos(angle);
  const panel = (w, h, lift, offset, paint) => {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(-w / 2, h - w * .55);
    shape.quadraticCurveTo(-w * .42, h - w * .22, 0, h);
    shape.quadraticCurveTo(w * .42, h - w * .22, w / 2, h - w * .55);
    shape.lineTo(w / 2, 0);
    const g = new T.ShapeGeometry(shape, 5);
    part(parts, g, paint, x + nx * offset, y + lift, z + nz * offset, 1, 1, 1, angle);
    g.dispose();
  };
  panel(width, height, 0, .022, FORT_TRIM);
  panel(width * .72, height * .91, door ? 0 : height * .035, .035, door ? '#483525' : FORT_DARK);
  if (!door) part(parts, box, FORT_TRIM, x + nx * .025, y + .018, z + nz * .025, width * 1.08, .055, .095, angle);
}

function chapel(parts, building, world) {
  const { x, z } = building;
  const heights = [-1.83, 1.83].flatMap(dx => [-1, 1].map(dz =>
    gridSample(world.ground, world.stride, x + dx, z + dz)));
  const base = Math.max(building.y, ...heights), bottom = Math.min(building.y, ...heights) - .14;
  const naveX = x + .39, bellX = x - 1.30, roof = base + 1.75;
  stoneBlock(parts, FORT_STONE, naveX, (bottom + roof) / 2, z, 2.68, roof - bottom, 1.80);
  gableRoof(parts, naveX, roof - .03, z, 2.86, 2.01, 1.03, 0, FORT_SLATE);
  const belfry = base + 2.79;
  stoneBlock(parts, FORT_STONE, bellX, (bottom + belfry) / 2, z, 1.08, belfry - bottom, 1.28);
  part(parts, box, FORT_TRIM, bellX, belfry - .08, z, 1.19, .13, 1.40);
  part(parts, roofPyramid, FORT_SLATE, bellX, belfry + .51, z, .94, 1.09, 1.07, 0, 0, .15);
  for (const dx of [-.79, 0, .79]) {
    archedInset(parts, naveX + dx, base + .60, z + .90, .33, .70, 0);
    stoneBlock(parts, FORT_STONE, naveX + dx - .33, base + .46, z + .96, .13, .94, .23);
  }
  archedInset(parts, bellX, base + 1.91, z + .64, .40, .55, 0);
  archedInset(parts, bellX, base, z + .64, .54, .98, 0, true);
  archedInset(parts, x + 1.73, base + .60, z, .39, .81, Math.PI / 2);
}

// The two intersecting arcs and contrasting ring follow the construction
// idea in Pixel Plays: Stari Most (MIT). Each wedge is a small solid.
function gateArch(parts, x, base, z, angle, height, stoneColor, trim, scale) {
  const half = 1.08, spring = 1.28, offset = .25, thickness = .23;
  const curve = (t, outer, sign = 1) => {
    const radius = half + offset + (outer ? thickness : 0);
    const a = t * Math.acos(offset / radius);
    return [sign * (radius * Math.cos(a) - offset), spring + Math.sin(a) * radius * .91];
  };
  const make = (points, width, center, paint, coursed = false) => {
    const shape = new T.Shape(points.map(p => new T.Vector2(...p)));
    const g = new T.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    g.translate(0, 0, center - width / 2);
    const mesh = part(parts, g, paint, x, base, z, scale, scale, scale, angle, 0, .10);
    g.dispose();
    if (coursed) limestone(mesh);
  };
  const profile = [[-half, spring], [-half, height], [half, height], [half, spring]];
  for (let i = 1; i <= 8; i++) profile.push(curve(i / 8, false));
  for (let i = 7; i >= 1; i--) profile.push(curve(i / 8, false, -1));
  make(profile, 1.92, 0, stoneColor, true);
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const a = (i + .055) / 6, b = (i + .945) / 6;
    const wedge = [curve(a, false, side), curve(b, false, side), curve(b, true, side), curve(a, true, side)];
    const paint = i % 2 ? trim : '#deceb1';
    make(wedge, .105, -.971, paint);
    make(wedge, .105, .971, paint);
  }
}

function keepModel(parts, piece, bottom, base) {
  const { x, z, width, depth, frontX, frontZ, banner } = piece;
  const s = Math.min(width, depth) / 4.2;
  const block = (paint, px, py, pz, w, h, d) => part(parts, box, paint, px, py, pz, w, h, d, 0, 0, .16);
  const stone = (px, py, pz, w, h, d) => stoneBlock(parts, FORT_STONE, px, py, pz, w, h, d);
  const bodyW = width * .85, bodyD = depth * .84;
  const top = base + 4.35 * s;
  stone(x, (bottom + base + .40 * s) / 2, z, width, base + .40 * s - bottom, depth);
  block(FORT_TRIM, x, base + .39 * s, z, width * .98, .13 * s, depth * .98);
  stone(x, (top + base) / 2, z, bodyW, top - base, bodyD);
  block('#9a8c70', x, top - .27 * s, z, bodyW + .16 * s, .16 * s, bodyD + .16 * s);
  block(FORT_TRIM, x, top - .09 * s, z, bodyW + .25 * s, .18 * s, bodyD + .25 * s);
  block('#746a55', x, top + .005, z, bodyW, .12 * s, bodyD);
  for (const side of [-1, 1]) {
    crenels(parts, x, top, z + side * bodyD / 2, bodyW * .67, 0, FORT_TRIM);
    crenels(parts, x + side * bodyW / 2, top, z, bodyD * .65, Math.PI / 2, FORT_TRIM);
  }

  const turret = .94 * s;
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
    const tx = x + dx * (width - turret) / 2, tz = z + dz * (depth - turret) / 2;
    const rim = top + .72 * s;
    stone(tx, (rim + bottom) / 2, tz, turret, rim - bottom, turret);
    block(FORT_TRIM, tx, rim - .11 * s, tz, turret + .17 * s, .14 * s, turret + .17 * s);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      block(FORT_TRIM, tx + a * turret * .37, rim + .17 * s, tz + b * turret * .37,
        .28 * s, .34 * s, .28 * s);
    }
    archedInset(parts, tx, rim - .89 * s, tz + turret / 2, .25 * s, .49 * s, 0);
    archedInset(parts, tx + turret / 2, rim - 1.1 * s, tz, .22 * s, .48 * s, Math.PI / 2);
  }

  for (const offset of [-.23, .23]) {
    archedInset(parts, x + offset * width, base + 2.66 * s, z + bodyD / 2, .48 * s, .90 * s, 0);
    archedInset(parts, x + bodyW / 2, base + 2.59 * s, z + offset * depth, .44 * s, .89 * s, Math.PI / 2);
  }
  const facing = Math.atan2(frontX, frontZ);
  const facade = frontX ? bodyW / 2 : bodyD / 2;
  archedInset(parts, x + frontX * facade, base + (piece.great ? .42 : .30) * s, z + frontZ * facade, 1.09 * s, 1.61 * s, facing, true);
  const flag = part(parts, box, banner, x + frontX * (facade + .04), base + 2.92 * s,
    z + frontZ * (facade + .04), .57 * s, 1.15 * s, .035, facing, 0, .16);
  flag.translate(0, .14 * s, 0);

  for (const t of [-.29, -.10, .10, .29]) {
    block(FORT_STONE, x + bodyW * t, top - .42 * s, z + bodyD / 2, .23 * s, .35 * s, .23 * s);
    block(FORT_STONE, x + bodyW / 2, top - .42 * s, z + bodyD * t, .23 * s, .35 * s, .23 * s);
  }
  if (piece.great) {
    const landing = base + .40 * s;
    const approach = z + depth / 2;
    block(FORT_TRIM, x, (bottom + landing) / 2, approach + .27, width * .31, landing - bottom, .60);
    const stairFloor = piece.approachY ?? bottom + .17;
    const count = Math.max(2, Math.ceil((landing - stairFloor) / .22));
    for (let i = 0; i < count; i++) {
      const tread = 1.65 / count, step = stairFloor + (landing - stairFloor) * (i + 1) / count;
      if (step <= stairFloor - .14) continue;
      stone(x, (stairFloor - .14 + step) / 2, approach + .55 + (count - i - .5) * tread,
        width * .30, step - stairFloor + .14, tread + .005);
    }
    const upperW = width * .63, upperD = depth * .65, upper = top + 2.65;
    stone(x, (top + upper) / 2, z, upperW, upper - top, upperD);
    block(FORT_TRIM, x, top + .46, z, upperW + .15, .19, upperD + .15);
    block(FORT_TRIM, x, upper - .17, z, upperW + .22, .25, upperD + .22);
    for (const sign of [-1, 1]) {
      crenels(parts, x, upper, z + sign * upperD / 2, upperW, 0, FORT_TRIM);
      crenels(parts, x + sign * upperW / 2, upper, z, upperD, Math.PI / 2, FORT_TRIM);
    }
    for (const offset of [-.29, 0, .29]) {
      archedInset(parts, x + upperW * offset, top + .95, z + upperD / 2, .53, 1.16, 0);
      archedInset(parts, x + upperW / 2, top + .95, z + upperD * offset, .53, 1.16, Math.PI / 2);
    }
    const crown = upper + 1.38;
    stone(x, (upper + crown) / 2, z, upperW * .48, crown - upper, upperD * .55);
    block(FORT_TRIM, x, crown - .06, z, upperW * .53, .18, upperD * .61);
    for (const sign of [-1, 1]) {
      crenels(parts, x, crown, z + sign * upperD * .27, upperW * .50, 0, FORT_TRIM);
      crenels(parts, x + sign * upperW * .24, crown, z, upperD * .56, Math.PI / 2, FORT_TRIM);
    }
    pennant(parts, x, crown + .02, z, banner, .35);
  }
}

function fortPiece(parts, piece, world) {
  const { kind, x, z, width, depth, alongX, banner } = piece;
  const at = (x, z) => gridSample(world.ground, world.stride, x, z);
  const heights = [-1, 1].flatMap(a => [-1, 1].map(b => at(x + a * width / 2, z + b * depth / 2)));
  const bottom = Math.min(...heights) - .22, base = Math.max(...heights, at(x, z));
  const masonry = FORT_STONE, trim = FORT_TRIM, dark = FORT_DARK;
  const angle = alongX ? 0 : Math.PI / 2;
  const block = (paint, px, py, pz, w, h, d, rotation = 0) =>
    part(parts, box, paint, px, py, pz, w, h, d, rotation, 0, .17);
  if (kind === 'stairs') {
    const { from, to, landing, steps, dx, dz } = piece;
    const length = Math.hypot(to.x - from.x, to.z - from.z), tread = length / steps;
    const rotation = dx ? 0 : Math.PI / 2;
    for (let i = 0; i < steps; i++) {
      const x = from.x + dx * (i + .5) * tread, z = from.z + dz * (i + .5) * tread;
      const y = from.y + (to.y - from.y) * (i + 1) / steps;
      const floor = Math.min(at(x - dx * tread / 2, z - dz * tread / 2),
        at(x + dx * tread / 2, z + dz * tread / 2)) - .12;
      limestone(block('#a79c85', x, (floor + y) / 2, z, tread + .004, y - floor, piece.width, rotation));
    }
    const join = Math.hypot(landing.x - to.x, landing.z - to.z);
    const px = (to.x + landing.x) / 2, pz = (to.z + landing.z) / 2;
    const floor = Math.min(at(to.x, to.z), at(landing.x, landing.z)) - .15;
    limestone(block('#a79c85', px, (floor + to.y) / 2, pz, join + .025, to.y - floor, piece.width, rotation));
    return;
  }
  if (kind === 'well') {
    part(parts, towerStone, '#4c655c', x, base + .12, z, .62, .19, .62, .39);
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4;
      const px = x + Math.sin(a) * .65, pz = z + Math.cos(a) * .65;
      block(masonry, px, (bottom + base + .42) / 2, pz, .56, base + .42 - bottom, .22, a);
      block(trim, px, base + .45, pz, .56, .16, .26, a);
    }
    for (const s of [-1, 1]) block('#76583c', x + s * .64, base + 1.03, z, .11, 1.5, .12);
    block('#80613f', x, base + 1.66, z, 1.5, .15, .15);
    block('#af936a', x, base + 1.25, z, .045, .69, .045);
    part(parts, trunk, '#866442', x, base + .91, z, .17, .23, .17);
    return;
  }
  const ashlar = (...args) => limestone(block(...args));
  if (kind === 'wall') {
    const top = piece.walkY - .075, length = piece.length;
    const thickness = piece.thickness ?? WALL_WIDTH, shift = (thickness - WALL_WIDTH) / 2;
    ashlar(masonry, x, (top + bottom) / 2, z, length + .016, top - bottom, thickness, angle);
    block('#a89b85', x, top, z, length + .016, .15, thickness + .04, angle);
    const { outX, outZ } = piece;
    block(trim, x + outX * (.68 + shift), top + .115, z + outZ * (.68 + shift), length + .016, .21, .21, angle);
    crenels(parts, x + outX * (.71 + shift), top + .20, z + outZ * (.71 + shift), length, angle, '#b8ac92');
    ashlar(trim, x - outX * (.655 + shift), top + .29, z - outZ * (.655 + shift), length + .016, .43, .24, angle);
    return;
  }
  if (kind === 'tower') {
    const top = piece.walkY - .07, radius = width / 2, face = radius * Math.cos(Math.PI / 8);
    limestone(part(parts, towerStone, masonry, x, (top + bottom) / 2, z, radius, top - bottom,
      radius, .39, 0, .15), { x, z, radius });
    part(parts, towerStone, trim, x, top - .15, z, radius + .095, .19, radius + .095, .39, 0, .12);
    part(parts, towerStone, '#a0947a', x, top + .01, z, radius + .015, .12, radius + .015, .39);
    const [a, b] = piece.access;
    const openings = [...piece.access, [(a[0] + b[0]) * Math.SQRT1_2, (a[1] + b[1]) * Math.SQRT1_2]];
    for (let n = 0; n < 16; n++) {
      const a = n * Math.PI / 8, dx = Math.sin(a), dz = Math.cos(a);
      if (openings.some(([x, z]) => x * dx + z * dz > .91)) continue;
      const rim = radius - .27;
      block(trim, x + dx * rim, top + .26, z + dz * rim, .76, .38, .27, a);
      if (n % 2 === 0) block(trim, x + dx * rim, top + .60, z + dz * rim, .48, .45, .36, a);
    }
    block(dark, x, top - .90, z + face, .16, .49, .06);
    block(trim, x, top - 1.19, z + face, .24, .10, .12);
    block(dark, x + face, top - 1.52, z, .06, .52, .16);
    block(trim, x + face, top - 1.82, z, .12, .10, .25);
    return;
  }
  if (kind === 'gate') {
    const top = piece.walkY - .09;
    const dx = Math.cos(angle), dz = -Math.sin(angle);
    const scale = piece.gateScale;
    for (const s of [-1, 1]) ashlar(masonry, x + s * 1.62 * dx * scale, (top + bottom) / 2,
      z + s * 1.62 * dz * scale, 1.14 * scale, top - bottom, 1.94 * scale, angle);
    gateArch(parts, x, base, z, angle, (top - base) / scale, masonry, trim, scale);
    block(trim, x, top, z, 4.34 * scale, .18, 2.12 * scale, angle);
    const { outX, outZ } = piece;
    crenels(parts, x + outX * .80 * scale, top + .08, z + outZ * .80 * scale, 4.2 * scale, angle, '#b8ac92');
    ashlar(trim, x - outX * .655 * scale, top + .305, z - outZ * .655 * scale, 4.34 * scale, .43, .24, angle);
    pennant(parts, x + outX * .82 * scale, top + .15, z + outZ * .82 * scale, banner, .22);
    return;
  }
  keepModel(parts, piece, bottom, base);
}

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

export function structuresMesh(buildings, bridges, forts, world, material) {
  const parts = [];
  for (const building of buildings) house(parts, building, world);
  for (const bridge of bridges) buildBridge(parts, bridge, world);
  for (const piece of forts) fortPiece(parts, piece, world);
  if (!parts.length) return null;
  for (const part of parts) {
    if (!part.hasAttribute('craft')) part.setAttribute('craft', new T.Float32BufferAttribute(part.attributes.position.count * 3, 3));
  }
  return new T.Mesh(combine(parts), material);
}
