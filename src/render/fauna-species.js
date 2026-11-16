// Use the library's public species entry points instead of stale internal dev chunks.
const loaders = {
  wolf: () => import('procedural-animals/species/wolf'),
  fox: () => import('procedural-animals/species/fox'),
  deer: () => import('procedural-animals/species/deer'),
  boar: () => import('procedural-animals/species/boar'),
  horse: () => import('procedural-animals/species/horse'),
  cow: () => import('procedural-animals/species/cow'),
  sheep: () => import('procedural-animals/species/sheep'),
  goat: () => import('procedural-animals/species/goat'),
  rabbit: () => import('procedural-animals/species/rabbit'),
  bear: () => import('procedural-animals/species/bear'),
  chicken: () => import('procedural-animals/species/chicken'),
  dog: () => import('procedural-animals/species/dog'),
  pig: () => import('procedural-animals/species/pig'),
  cat: () => import('procedural-animals/species/cat'),
  rat: () => import('procedural-animals/species/rat'),
  frog: () => import('procedural-animals/species/frog'),
  snake: () => import('procedural-animals/species/snake'),
  spider: () => import('procedural-animals/species/spider'),
  crow: () => import('procedural-animals/species/crow'),
  eagle: () => import('procedural-animals/species/eagle'),
  fish: () => import('procedural-animals/species/fish'),
  shark: () => import('procedural-animals/species/shark'),
};
const loaded = new Map();

export function loadFaunaSpecies(id) {
  if (!loaders[id]) throw new Error('Unknown fauna species: ' + id);
  if (!loaded.has(id)) loaded.set(id, loaders[id]().then(module => module.default));
  return loaded.get(id);
}
