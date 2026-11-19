// Visual style is a presentation choice: it must never alter world simulation.
// Palette "Vale de Âmbar": coherent shadow/highlight ramps for an earthy
// medieval landscape. The same colors serve sky, water, vegetation and terrain.
export const PALETTE_NAME = 'Vale de Âmbar';
export const WORLD_PALETTE = Object.freeze([
  // Shared neutral ramp (shadows, stone and mist).
  '#17242b', '#263640', '#394b4b', '#52665d',
  '#72816c', '#9da18a', '#c6c4a6', '#ede5c8',
  // Forest and grass, in readable dark-to-light steps.
  '#244a43', '#32604b', '#477a51', '#68915b',
  '#8fa96f', '#b5bd80',
  // River, sea and daylight: blue-gray rather than fluorescent cyan.
  '#334c6b', '#476984', '#6488a1', '#86abc0',
  '#b4cbd3', '#dae1d8',
  // Earth, bark, thatch and sunlight.
  '#534439', '#755442', '#946a4b', '#b58a5a',
  '#d3ab75', '#eed2a0',
  // Subtle rose/clay accents, never a second competing palette.
  '#624351', '#855660', '#aa6b68', '#cd8981',
  '#e3b5a1', '#f0d6b5'
]);

export const PIXEL_ART_MODES = Object.freeze({
  off: Object.freeze({ ratio: 1, edge: 0, dither: 0 }),
  pixel: Object.freeze({ ratio: 0.5, edge: .28, dither: .018 }),
  retro: Object.freeze({ ratio: 1 / 3, edge: .36, dither: .035 })
});

export function pixelArtProfile(mode) {
  return PIXEL_ART_MODES[mode] ?? PIXEL_ART_MODES.pixel;
}

// Low-resolution render with nearest-neighbor enlargement keeps a consistent
// pixel grid. Text, controls and the minimap are separate and remain sharp.
export function pixelArtResolution(width, height, mode = 'pixel') {
  const ratio = pixelArtProfile(mode).ratio;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scale: ratio
  };
}

// Linear fog: at the old far distance, the overhead fog contribution is 30%.
export function overviewFogFar(near = 250, far = 403, strength = .3) {
  if (!(far > near) || !(strength > 0 && strength <= 1))
    throw new RangeError('Invalid fog parameters');
  return near + (far - near) / strength;
}

// One small 256x16 RGBA lookup texture replaces an expensive 32-color nearest
// search in the fragment shader. It is computed only once and used by all modes.
// Index: x = red + green*16, y = blue. No allocations during render frames.
export const PALETTE_LUT_STEPS = 16;
let cachedPaletteLut = null;

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// OKLab makes palette choice respect visual lightness, not just RGB distance.
function toOklab(r, g, b) {
  const linear = c => {
    c /= 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  };
  r = linear(r); g = linear(g); b = linear(b);
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
  const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
  const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  return [
    .2104542553*l + .7936177850*m - .0040720468*s,
    1.9779984951*l - 2.4285922050*m + .4505937099*s,
    .0259040371*l + .7827717662*m - .8086757660*s
  ];
}

export function harmonizedPaletteLut() {
  if (cachedPaletteLut) return cachedPaletteLut;
  const swatches = WORLD_PALETTE.map(hex => {
    const color = rgb(hex);
    return { color, lab: toOklab(...color) };
  });
  const steps = PALETTE_LUT_STEPS;
  const data = new Uint8Array(steps * steps * steps * 4);
  for (let b = 0; b < steps; b++) {
    for (let g = 0; g < steps; g++) {
      for (let r = 0; r < steps; r++) {
        const lab = toOklab(r * 255 / (steps - 1), g * 255 / (steps - 1), b * 255 / (steps - 1));
        let best = swatches[0], distance = Infinity;
        for (const swatch of swatches) {
          const dl = (lab[0] - swatch.lab[0]) * 1.12;
          const da = lab[1] - swatch.lab[1];
          const db = lab[2] - swatch.lab[2];
          const score = dl*dl + da*da + db*db;
          if (score < distance) { distance = score; best = swatch; }
        }
        const offset = ((b * steps + g) * steps + r) * 4;
        data[offset] = best.color[0];
        data[offset + 1] = best.color[1];
        data[offset + 2] = best.color[2];
        data[offset + 3] = 255;
      }
    }
  }
  cachedPaletteLut = data;
  return data;
}
