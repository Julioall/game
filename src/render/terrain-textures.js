import * as T from 'three';

// Grass, dry grass, woodland floor, soil, sand, snow, snowy grass, paving.
const layers = [3, 4, 0, 0, 2, 1, 3, 7, 6, 5, 0, 2];
export function terrainTextureWeights(biome, wet, grade, sand, plot, fort, road, paved) {
  const weights = new Array(8).fill(0);
  weights[wet > 0 ? 3 : layers[biome] ?? 0] = 1;
  const blend = (layer, amount) => {
    for (let i = 0; i < 8; i++) weights[i] *= 1 - amount;
    weights[layer] += amount;
  };
  if (wet <= 0 && biome !== 9 && grade > .6) blend(7, Math.min(.8, (grade - .6) * .5));
  if (wet <= 0 && sand > 0) blend(4, sand);
  if (fort) blend(3, .8);
  if (plot || road) { weights.fill(0); weights[paved ? 7 : 3] = 1; }
  return weights;
}

export function loadTerrainAtlas() {
  const texture = new T.TextureLoader().load(import.meta.env.BASE_URL + 'terrain/terrain-atlas.png');
  // Shader decodes atlas samples explicitly because this is a custom sampler.
  texture.colorSpace = T.NoColorSpace;
  texture.magFilter = T.NearestFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.flipY = false;
  return texture;
}

export const terrainTextureGLSL = `
uniform sampler2D terrainAtlas;
varying vec4 terrainWeightsA;
varying vec4 terrainWeightsB;
vec3 terrainSample(float layer, vec2 uv) {
  vec2 tile = vec2(mod(layer, 4.), floor(layer / 4.));
  vec2 atlasUV = (tile * 272. + 8. + fract(uv) * 256.) / vec2(1088., 544.);
  // Derivatives from continuous world coordinates avoid mip seams at repeats.
  vec2 scale = vec2(256.) / vec2(1088., 544.);
  vec3 c = textureGrad(terrainAtlas, atlasUV, dFdx(uv) * scale, dFdy(uv) * scale).rgb;
  return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(vec3(.04045), c));
}
`;
