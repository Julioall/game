import { VERSION } from '../world/catalog.js';

const saveKey = config => 'kingdom:' + VERSION + ':' + JSON.stringify(config);

export function loadSave(config) {
  try {
    return JSON.parse(localStorage.getItem(saveKey(config))) ?? {};
  } catch {
    return {};
  }
}

export function storeSave(config, snapshot) {
  localStorage.setItem(saveKey(config), JSON.stringify(snapshot));
}
