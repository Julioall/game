import { FAUNA_SPECIES } from '../world/fauna-catalog.js';

export function createBakedFactory(createAnimal, { fetchAsset = (...args) => fetch(...args),
  baseUrl = import.meta.env?.BASE_URL ?? '/' } = {}) {
  const cache = new Map();
  const stats = { loaded: 0, failures: 0 };
  const factory = async (species, options) => {
    // The legacy two-seed bakes do not encode an explicitly selected breed/coat.
    if (options.baked || options.variant != null || options.quality !== 'low' || !FAUNA_SPECIES[species] || ![1769, 1770].includes(options.seed))
      return createAnimal(species, options);
    const key = `${species}-${options.seed}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        try {
          const response = await fetchAsset(`${baseUrl}fauna/${key}.animal.gz`);
          if (!response.ok) throw new Error(`Fauna asset HTTP ${response.status}`);
          let baked = await response.arrayBuffer();
          const header = new Uint8Array(baked, 0, Math.min(4, baked.byteLength));
          // Some hosts set Content-Encoding for .gz and the browser decodes it.
          // Others serve raw gzip. Inspect bytes to avoid decompressing twice.
          if (header[0] === 31 && header[1] === 139) {
            const stream = new Blob([baked]).stream().pipeThrough(new DecompressionStream('gzip'));
            baked = await new Response(stream).arrayBuffer();
          }
          const magic = new Uint8Array(baked, 0, Math.min(4, baked.byteLength));
          if (magic[0] !== 80 || magic[1] !== 65 || magic[2] !== 78 || magic[3] !== 77)
            throw new Error('Invalid fauna bake header');
          stats.loaded++;
          return baked;
        } catch (error) {
          stats.failures++;
          console.warn('Fauna bake fallback:', key, String(error));
          return null; // One failed fetch per appearance, then procedural fallback.
        }
      })());
    }
    const baked = await cache.get(key);
    return createAnimal(species, baked ? { ...options, baked } : options);
  };
  factory.bakeStats = stats;
  return factory;
}
