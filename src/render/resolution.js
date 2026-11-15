// Keep distant silhouettes sharp and add sampling as the camera approaches.
export function renderResolution(detail, span, width, height, firstPerson = false, densityCap = Infinity) {
  const baseline = detail === 'atlas' ? 1 : 1.5;
  const close = firstPerson ? 1 : Math.max(0, Math.min(1, (43 - span) / 23));
  // Quantize sampling density to avoid reallocating for every tiny wheel delta.
  const requested = Math.round((baseline + close * .5) * 12) / 12;
  const density = !firstPerson && span >= 66 ? Math.min(requested, Math.max(1.25, densityCap)) : requested;
  const scale = 1 / density;
  return { width: Math.max(1, Math.round(width / scale)),
    height: Math.max(1, Math.round(height / scale)), scale };
}
