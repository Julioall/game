import * as T from 'three';
import { gridSample, hash } from '../world/math.js';
import { dwellingPlan } from '../world/buildings.js';
import { box, stone, octagonalCylinder, part } from './mesh-parts.js';

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

export function dwelling(parts, building, world) {
  const { x, z, footprint, kind, urban } = building;
  const { floors, eaves, width, depth, story, base, bottom, roll, variation, entrance } = dwellingPlan(building, world);
  const timber = '#634834', trim = '#8e6e4d', masonry = '#9b8c72';
  const plaster = ['#c9b68d', '#bca481', '#d2ba94'][Math.floor(roll * 3)];
  const thatch = !urban, slate = urban && roll < .19;
  const roofColor = thatch ? ['#a48442', '#ae9051', '#ba9b57'][Math.floor(roll * 3)]
    : slate ? '#5e6364' : ['#88563e', '#9d6045', '#a76b4a'][Math.floor(roll * 3)];
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
        const { offset, width: opening } = entrance;
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

export function market(parts, building, world) {
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
  part(parts, octagonalCylinder, '#866341', x + .90, floor + .24, z + .70, .23, .49, .23, .39, 0, .28);
  for (const h of [.12, .36]) part(parts, octagonalCylinder, '#584c3c', x + .90, floor + h, z + .70, .24, .049, .24, .39);
}
