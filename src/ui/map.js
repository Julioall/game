import { BIOMES } from '../world/catalog.js';

const rgbOf = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
const colors = BIOMES.map(({ color }) => rgbOf(color));

export function mapImage(canvas, world, layer) {
  const image = document.createElement('canvas');
  image.width = canvas.width;
  image.height = canvas.height;
  const ctx = image.getContext('2d'), pixels = ctx.createImageData(image.width, image.height);
  const { stride, biome, lake, wet, river, slope, ground, territory } = world;
  const realmColors = new Map(world.realms.map(r => [r.id, rgbOf(r.color)]));
  for (let z = 0; z < image.height; z++) for (let x = 0; x < image.width; x++) {
    const gx = Math.floor((x + .5) * (stride - 1) / image.width);
    const gz = Math.floor((z + .5) * (stride - 1) / image.height);
    const i = gz * stride + gx, p = (z * image.width + x) * 4;
    let rgb = colors[biome.at(i)];
    if (layer === 'realm' && territory.at(i)) {
      const faction = realmColors.get(territory.at(i));
      const border = [i + 1, i + stride].some(j => territory.at(j) && territory.at(j) !== territory.at(i));
      rgb = rgb.map((value, k) => border ? Math.min(255, faction[k] * .75 + 54) : value * .42 + faction[k] * .58);
    } else if (layer === 'water') rgb = river.at(i) ? [136, 232, 208] : lake.at(i) ? [50, 151, 172] :
      wet.at(i) > 0 ? [33, 86, 105] : [93 + ground.at(i) * 2, 108 + ground.at(i) * 2, 83 + ground.at(i) * 2];
    else if (layer === 'slope' && wet.at(i) <= 0) rgb = slope.at(i) < .31 ? [81, 119, 81] :
      slope.at(i) < .62 ? [189, 154, 78] : [154, 84, 67];
    const shade = 1 - Math.max(-.1, Math.min(.27, (ground.at(i + 1) - ground.at(i)) * .15));
    pixels.data.set([rgb[0] * shade, rgb[1] * shade, rgb[2] * shade, 255], p);
  }
  ctx.putImageData(pixels, 0, 0);
  return image;
}

export function paintMap(canvas, image, view) {
  const ctx = canvas.getContext('2d');
  const { size } = view.world.config;
  const scale = canvas.width / size;
  ctx.drawImage(image, 0, 0);
  for (const town of view.world.towns) {
    const x = town.x * scale, z = town.z * scale;
    if (town.cityWall) {
      const { bounds } = town.cityWall;
      ctx.strokeStyle = '#edcc8f';
      ctx.strokeRect(bounds.minX * scale, bounds.minZ * scale, (bounds.maxX - bounds.minX) * scale,
        (bounds.maxZ - bounds.minZ) * scale);
    }
    if (town.kind === 'city') {
      ctx.fillStyle = '#253634';
      ctx.fillRect(x - 4, z - 4, 9, 9);
      ctx.fillStyle = '#ffe0a1';
      ctx.fillRect(x - 2.5, z - 1.5, 6, 5);
      for (let a = -2.5; a <= 2.5; a += 2.5) ctx.fillRect(x + a, z - 3, 1, 2);
    } else if (town.kind === 'manor') {
      ctx.fillStyle = '#e0b67f';
      ctx.fillRect(x - 1.5, z - 2.5, 4, 5);
    } else {
      ctx.fillStyle = '#f7d39a';
      ctx.fillRect(x - 1.5, z - 1.5, 4, 4);
    }
  }
  const { x, z, span } = view.focus;
  ctx.save();
  ctx.translate(x * scale, z * scale);
  ctx.rotate(-Math.PI / 4);
  const width = span * view.aspect * scale, height = span * scale / .634;
  ctx.strokeStyle = '#fff0be';
  ctx.lineWidth = 1;
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.restore();
  ctx.fillStyle = '#fff5d2';
  ctx.fillRect(x * scale - 1, z * scale - 1, 3, 3);
}
