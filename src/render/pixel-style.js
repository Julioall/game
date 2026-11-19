// Pixel-art rendering is a presentation choice, never part of world generation.
export const PIXEL_ART_MODES = Object.freeze({
  off: Object.freeze({ ratio: 1, levels: [23, 27, 23], edge: 0, dither: 0 }),
  pixel: Object.freeze({ ratio: 0.5, levels: [15, 17, 15], edge: 0.42, dither: 0.18 }),
  retro: Object.freeze({ ratio: 1 / 3, levels: [9, 11, 9], edge: 0.52, dither: 0.25 })
});

export function pixelArtProfile(mode) {
  return PIXEL_ART_MODES[mode] ?? PIXEL_ART_MODES.pixel;
}

// Render the world at a smaller, stable resolution; browser CSS uses
// image-rendering: pixelated so the upscale never blurs the picture.
// UI, text and minimap are separate DOM/canvas layers and stay sharp.
export function pixelArtResolution(width, height, mode = 'pixel') {
  const ratio = pixelArtProfile(mode).ratio;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scale: ratio
  };
}

// In linear fog, increasing the falloff distance by 1 / strength reduces
// its contribution by that fraction at the same depth (before saturation).
export function overviewFogFar(near = 250, far = 403, strength = 0.3) {
  if (!(far > near) || !(strength > 0 && strength <= 1)) throw new RangeError('Invalid fog parameters');
  return near + (far - near) / strength;
}
