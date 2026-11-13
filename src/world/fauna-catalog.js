// Species definitions adapted from Kingdom Fauna Lab; see THIRD_PARTY_NOTICES.md.
export const FAUNA_SPECIES = Object.freeze({
  wolf: {
    label: 'Lobo',
    biomes: { 3: 1, 4: 1.1, 7: 0.4, 8: 0.6, 9: 0.25, 10: 0.6 },
    variants: ['grey', 'black', 'pale', 'tawny'],
    clearance: 1.2
  },
  fox: {
    label: 'Raposa',
    biomes: { 2: 0.5, 3: 1, 4: 0.65, 5: 0.4, 6: 0.3, 10: 0.5 },
    variants: ['red', 'cross', 'silver', 'urban'],
    clearance: 1.2
  },
  deer: {
    label: 'Cervo',
    biomes: { 2: 0.9, 3: 1.1, 4: 0.7, 10: 0.65 },
    variants: ['summer', 'winter'],
    clearance: 1.2
  },
  boar: {
    label: 'Javali',
    biomes: { 3: 0.7, 4: 1.3, 5: 0.5, 10: 0.4, 11: 0.5 },
    variants: ['adult', 'yearling'],
    clearance: 1.2
  },
  horse: {
    label: 'Cavalo',
    biomes: { 2: 1.2, 5: 0.6, 10: 0.35 },
    variants: ['bay', 'darkbay', 'chestnut', 'black', 'grey', 'palomino', 'dun', 'buckskin'],
    clearance: 1.2
  },
  cow: {
    label: 'Vaca',
    biomes: { 2: 1.1, 5: 0.5, 10: 0.5 },
    variants: ['holstein', 'hereford', 'angus', 'jersey', 'highland'],
    clearance: 1.2
  },
  sheep: {
    label: 'Ovelha',
    biomes: { 2: 1.3, 5: 0.4, 7: 0.4 },
    variants: ['whiteface', 'suffolk', 'merino', 'black', 'shorn'],
    clearance: 1.2
  },
  goat: {
    label: 'Cabra',
    biomes: { 2: 0.6, 5: 0.7, 6: 0.5, 7: 1.2 },
    variants: ['saanen', 'alpine', 'pied', 'nubian', 'boer'],
    clearance: 1.2
  },
  rabbit: {
    label: 'Coelho',
    biomes: { 2: 1.2, 3: 0.45, 5: 0.6, 8: 0.3 },
    variants: ['wild', 'domestic', 'fawn', 'black', 'white'],
    clearance: 1.2
  },
  bear: {
    label: 'Urso',
    biomes: { 3: 0.3, 4: 0.7, 7: 0.7, 8: 0.4 },
    variants: ['eurasian', 'grizzly', 'coastal', 'black'],
    clearance: 1.2
  },
  chicken: {
    label: 'Galinha',
    biomes: { 2: 0.7, 5: 0.4 },
    variants: ['red', 'leghorn', 'australorp', 'barred', 'buff', 'speckled'],
    clearance: 1.2
  },
  dog: {
    label: 'Cão',
    biomes: { 2: 0.6, 3: 0.5, 5: 0.4 },
    variants: ['shepherd', 'retriever', 'terrier'],
    clearance: 1.2
  },
  pig: {
    label: 'Porco',
    biomes: { 2: 1, 5: 0.3 },
    variants: ['largewhite', 'landrace', 'duroc', 'hampshire', 'berkshire', 'spotted'],
    clearance: 1.2
  },
  cat: {
    label: 'Gato',
    biomes: { 2: 0.3, 3: 0.5, 5: 0.2 },
    variants: ['mackerel', 'classic', 'ginger', 'black', 'tuxedo', 'calico', 'grey'],
    clearance: 1.2
  },
  rat: {
    label: 'Rato',
    biomes: { 2: 0.4, 3: 0.2, 5: 0.3, 11: 0.1 },
    variants: ['wild', 'agouti', 'dark', 'albino', 'hooded'],
    clearance: 1.2
  },
  frog: {
    label: 'Sapo',
    biomes: { 10: 1, 11: 1.1 },
    variants: ['bullfrog', 'bullfrog-pale', 'common-frog'],
    clearance: 1.2
  },
  snake: {
    label: 'Serpente',
    biomes: { 3: 0.2, 4: 0.3, 5: 0.6, 6: 0.5, 11: 0.3 },
    variants: ['corn', 'rattlesnake'],
    clearance: 1.2
  },
  spider: {
    label: 'Aranha',
    biomes: { 3: 0.2, 4: 0.3, 11: 0.4 },
    variants: ['wolf', 'tarantula'],
    clearance: 1.2
  },
  crow: {
    label: 'Corvo',
    biomes: { 2: 0.4, 3: 0.6, 4: 0.4 },
    variants: ['american', 'carrion', 'hooded'],
    clearance: 1.2
  },
  eagle: { label: 'Águia', biomes: { 2: 0.3, 5: 0.2, 7: 0.8 }, variants: ['bald', 'golden'], clearance: 1.2 },
  lion: { label: 'Leão', biomes: { 5: 0.7, 6: 0.2 }, variants: ['tawny', 'white'], clearance: 1.2 },
  cheetah: { label: 'Guepardo', biomes: { 5: 0.5, 6: 0.4 }, variants: [], clearance: 1.2 },
  fish: {
    label: 'Peixe',
    biomes: { 0: 1 },
    variants: ['trout', 'goldfish', 'clownfish', 'bluegill'],
    clearance: 1.2
  },
  shark: { label: 'Tubarão', biomes: { 0: 0.2 }, variants: ['white', 'blacktip'], clearance: 1.2 }
});

export const SMALL_FAUNA = new Set([
  'fox',
  'rabbit',
  'chicken',
  'cat',
  'rat',
  'frog',
  'snake',
  'spider',
  'crow',
  'fish'
]);
export const FAUNA_BEHAVIOR = Object.freeze({
  tick: 0.1,
  homeRadius: 18,
  walkSpeed: 0.65,
  smallSpeed: 0.35,
  swimSpeed: 0.8,
  pausePeriod: 15,
  pauseDuration: 5
});

for (const definition of Object.values(FAUNA_SPECIES)) {
  Object.freeze(definition.biomes);
  Object.freeze(definition.variants);
  Object.freeze(definition);
}
