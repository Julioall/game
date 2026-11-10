import * as T from 'three';
import { gridSample, hash } from '../world/math.js';
import { WALL_WIDTH } from '../world/fortifications.js';
import { box, trunk, octagonalCylinder, part, stick } from './mesh-parts.js';

const roofPyramid = new T.CylinderGeometry(0, 1, 1, 4).rotateY(Math.PI / 4);

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

export function chapel(parts, building, world) {
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

export function keepModel(parts, piece, bottom, base) {
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

export function fortPiece(parts, piece, world) {
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
    part(parts, octagonalCylinder, '#4c655c', x, base + .12, z, .62, .19, .62, .39);
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
    limestone(part(parts, octagonalCylinder, masonry, x, (top + bottom) / 2, z, radius, top - bottom,
      radius, .39, 0, .15), { x, z, radius });
    part(parts, octagonalCylinder, trim, x, top - .15, z, radius + .095, .19, radius + .095, .39, 0, .12);
    part(parts, octagonalCylinder, '#a0947a', x, top + .01, z, radius + .015, .12, radius + .015, .39);
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
