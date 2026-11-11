import { VERSION } from '../world/catalog.js';

const saveKey = config => {
  const { hydrology, ...legacy } = config;
  return 'kingdom:' + VERSION + ':' + JSON.stringify(hydrology > 1 ? config : legacy);
};

export function loadSave(config, storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage).getItem(saveKey(config)));
    return saved?.version === VERSION ? saved : {};
  } catch {
    return {};
  }
}

export function savedGeneration(config, storage) {
  if (loadSave(config, storage).version === VERSION) return config;
  for (let hydrology = config.hydrology - 1; hydrology >= 1; hydrology--) {
    const previous = { ...config, hydrology };
    const saved = loadSave(previous, storage);
    if (saved.removed?.length || saved.buildings?.length || saved.inventory?.wood || saved.inventory?.stone) return previous;
  }
  return config;
}

export function storeSave(config, snapshot) {
  localStorage.setItem(saveKey(config), JSON.stringify(snapshot));
}
