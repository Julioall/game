import './style.css';
import { Vector3 } from 'three';
import { BIOMES, CHUNK, DEFAULT, MAX_MAP_SIZE, SETTINGS, SPECIES } from './world/catalog.js';
import { configuration } from './world/generate.js';
import { WorldState } from './world/state.js';
import { WorldView } from './render/view.js';
import { loadSave, storeSave } from './platform/local-save.js';
import { mapImage, paintMap } from './ui/map.js';
import { worldLandmarks } from './world/landmarks.js';

const $ = id => document.getElementById(id);
const canvas = $('world'), map = $('map'), dialog = $('generator'), form = $('config');
const destination = $('destination');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const keys = new Set();
const intervals = [];
let view, state, image, places, worker, selected, pointer, toastTimer, lostContext = false;
let building = false, lastFrame = 0, lastUi = 0, firstDraw = false;
let current = configuration({ ...DEFAULT, ...Object.fromEntries(
  [...new URLSearchParams(location.search)].map(([k, v]) => [k, ['style', 'detail'].includes(k) ? v : Number(v)])
) });

function message(text) {
  $('toast').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 4200);
}

function inventory() {
  $('wood').textContent = state.inventory.wood;
  $('stone').textContent = state.inventory.stone;
}

function setBuilding(enabled) {
  building = enabled;
  $('build').setAttribute('aria-pressed', String(enabled));
  canvas.classList.toggle('building', enabled);
  if (enabled) {
    inspect();
    message('Escolha um terreno livre para a cabana · 3 madeiras e 2 pedras');
  }
}

function inspect(object, point) {
  selected = object;
  const panel = $('inspect');
  panel.replaceChildren();
  panel.hidden = !object && !point;
  if (panel.hidden) return;
  const title = document.createElement('strong'), description = document.createElement('small');
  panel.append(title, description);
  if (object) {
    title.textContent = object.kind === 'tree' ? SPECIES[object.species].name : 'Afloramento rochoso';
    description.textContent = object.kind === 'tree' ? object.age + ' anos · madeira' : 'Recurso natural · pedra';
    const button = document.createElement('button');
    button.id = 'harvest';
    button.textContent = object.kind === 'tree' ? 'Cortar e recolher madeira' : 'Coletar pedra';
    button.addEventListener('click', harvest);
    panel.append(button);
  } else {
    const { world } = view;
    const i = Math.round(point.z) * world.stride + Math.round(point.x);
    title.textContent = BIOMES[world.biome[i] ?? 0].name;
    description.textContent = 'Altitude ' + point.y.toFixed(1) + ' m · declive ' + Math.round((world.slope[i] ?? 0) * 100) + '%';
  }
}

function persist() {
  try {
    storeSave(current, state.snapshot());
  } catch {
    message('Armazenamento local indisponível. Alterações mantidas nesta sessão.');
  }
}

function harvest() {
  const action = state.harvest(selected?.id);
  if (!action) return;
  view.invalidate(action.chunk);
  inventory();
  inspect();
  message('+' + action.amount + (action.key === 'wood' ? ' madeira' : ' pedra'));
  persist();
  canvas.focus();
}

function applyClick(x, y) {
  if (!view) return;
  const hit = view.pick(x, y, !building);
  if (!building) return inspect(hit.object, hit.point);
  if (!hit.point) return;
  const px = Math.round(hit.point.x), pz = Math.round(hit.point.z);
  const result = state.construct(px, pz);
  if (result.error) return message(result.error);
  view.invalidate(result.chunk);
  inventory();
  setBuilding(false);
  message('Cabana construída. Alterações salvas neste mundo.');
  persist();
}

function listDestinations(world) {
  destination.replaceChildren(new Option('Vilas e capitais…', ''));
  destination.hidden = !world.towns.length;
  for (const realm of world.realms) {
    const group = document.createElement('optgroup');
    group.label = realm.name;
    for (const town of world.towns.filter(t => t.realm === realm.id)) {
      group.append(new Option((town.cityWall ? '✦ ' : town.fort || town.kind === 'manor' ? '♜ ' : '• ') + town.name, town.id));
    }
    destination.append(group);
  }
  $('home').textContent = world.towns[0]?.fort ? 'Capital' : 'Vila';
}

function showRegion() {
  const { world, focus } = view;
  const i = Math.round(focus.z) * world.stride + Math.round(focus.x);
  const town = world.towns.find(t => t.cityWall
    ? focus.x >= t.cityWall.bounds.minX && focus.x <= t.cityWall.bounds.maxX &&
      focus.z >= t.cityWall.bounds.minZ && focus.z <= t.cityWall.bounds.maxZ
    : Math.hypot(t.x - focus.x, t.z - focus.z) < (t.fort ? 22 : 16));
  const realm = world.realms.find(r => r.id === (town?.realm ?? world.territory[i]));
  const type = town?.cityWall ? 'Grande cidade' : town?.fort ? 'Castelo nobre' : town?.kind === 'manor' ? 'Solar fortificado' : 'Vila';
  const title = town ? town.name + ' · ' + type : realm?.name ?? 'Terras de fronteira';
  $('region').textContent = title;
  const identity = document.querySelector('.identity');
  identity.title = [realm?.name, current.size + ' × ' + current.size + ' m'].filter(Boolean).join(' · ');
  identity.style.setProperty('--realm-color', realm?.color ?? '');
}

function loadWorld(config) {
  worker?.terminate();
  inspect();
  setBuilding(false);
  if (view && (current.size > 768 || config.size > 768)) {
    view.destroy();
    view = null;
    state = null;
  }
  $('loading').hidden = false;
  $('loading').querySelector('p').textContent = 'Traçando os rios e o relevo';
  $('region').textContent = 'Cartografando o mundo…';
  worker = new Worker(new URL('./platform/world-worker.js', import.meta.url), { type: 'module' });
  const active = worker;
  active.onerror = event => {
    $('loading').querySelector('p').textContent = 'Falha ao gerar o mapa. ' + event.message;
  };
  active.onmessage = ({ data }) => {
    if (active !== worker) return;
    if (data.progress) {
      $('loading').querySelector('p').textContent = data.progress;
      return;
    }
    active.terminate();
    if (data.error) {
      $('loading').querySelector('p').textContent = data.error;
      return;
    }
    try {
      const world = data.world;
      current = world.config;
      state = new WorldState(world, loadSave(current));
      view?.destroy();
      view = null;
      view = new WorldView(canvas, world, state);
      view.showWalkways($('walkways').getAttribute('aria-pressed') === 'true');
      lostContext = false;
      inventory();
      places = worldLandmarks(world);
      image = mapImage(map, world, $('layer').value);
      $('lake').disabled = !places.lake;
      $('home').disabled = !world.towns.length;
      $('seed-label').textContent = '#' + current.seed;
      listDestinations(world);
      showRegion();
      intervals.length = 0;
      firstDraw = true;
    } catch (error) {
      $('loading').querySelector('p').textContent = 'O mundo precisa de WebGL 2. ' + error.message;
    }
  };
  active.postMessage(config);
}

function stats() {
  const dt = [...intervals].sort((a, b) => a - b);
  const average = dt.reduce((a, b) => a + b, 0) / Math.max(dt.length, 1);
  return { ...view.diagnostics(), ...view.world.metrics,
    fps: average ? 1000 / average : 0, p95Ms: dt[Math.floor(dt.length * .95)] ?? 0, maxFrameMs: dt.at(-1) ?? 0,
    heapBytes: performance.memory?.usedJSHeapSize ?? null, revision: state.revision };
}

function refresh() {
  paintMap(map, image, view);
  showRegion();
  if ($('diagnostics').hidden) return;
  const s = stats();
  const rows = [
    ['FPS médio', s.fps.toFixed(0)], ['Quadro p95', s.p95Ms.toFixed(1) + ' ms'],
    ['Geração', s.generationMs.toFixed(0) + ' ms'], ['Lote de chunks mais lento', s.maxChunkMs.toFixed(1) + ' ms'],
    ['Grade do mundo', (s.gridBytes / 1048576).toFixed(1) + ' MiB'],
    ['Heap JS aprox.', s.heapBytes === null ? 'indisponível' : (s.heapBytes / 1048576).toFixed(1) + ' MiB'],
    ['Chunks ativos / cache', s.active + ' / ' + s.cached], ['Chamadas GPU', s.calls],
    ['Rios / descontinuidades', s.riverEdges + ' / ' + s.brokenRivers],
    ['Lagos / confluências', s.lakes + ' / ' + s.confluences],
    ['Declive > 63%', s.steepLand], ['Lotes ou vias inválidos', s.invalidSites],
    ['Copas sobrepostas', s.crowns],
    ['Reinos / grandes cidades', s.realms + ' / ' + s.metropolises],
    ['Castelos / solares / vilas', (s.cities - s.metropolises) + ' / ' + s.manors + ' / ' + s.villages]
  ];
  $('stats').innerHTML = rows.map(([label, value]) => '<span>' + label + '</span><b>' + value + '</b>').join('');
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastFrame ? now - lastFrame : 16.7;
  lastFrame = now;
  if (!view || lostContext) return;
  if (!dialog.open) {
    const x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    const y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    if (x || y) view.pan(x * Math.min(dt, 48) * .46, y * Math.min(dt, 48) * .46);
  }
  view.draw(motion.matches ? 0 : now / 1000);
  if (firstDraw) {
    $('loading').hidden = true;
    firstDraw = false;
  }
  if (dt < 2000 && !document.hidden) {
    intervals.push(dt);
    if (intervals.length > 150) intervals.shift();
  }
  if (now - lastUi > 280) {
    refresh();
    lastUi = now;
  }
}

canvas.addEventListener('pointerdown', event => {
  if (!view || !event.isPrimary || event.button !== 0) return;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointer = { x: event.clientX, y: event.clientY, moved: false };
});
canvas.addEventListener('pointermove', event => {
  if (!pointer || !view || !event.isPrimary) return;
  if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 5) return;
  pointer.moved = true;
  canvas.classList.add('dragging');
  view.pan(pointer.x - event.clientX, pointer.y - event.clientY);
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if (!pointer || !event.isPrimary) return;
  if (!pointer.moved) applyClick(event.clientX, event.clientY);
  pointer = null;
  canvas.classList.remove('dragging');
});
canvas.addEventListener('lostpointercapture', () => {
  pointer = null;
  canvas.classList.remove('dragging');
});
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  if (!view) return;
  const bounds = canvas.getBoundingClientRect();
  const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
  const delta = Math.max(-160, Math.min(160, event.deltaY * units));
  view.zoom(Math.exp(delta * .0017), event.clientX - bounds.left - bounds.width / 2,
    event.clientY - bounds.top - bounds.height / 2);
}, { passive: false });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  lostContext = true;
  $('loading').hidden = false;
  $('loading').querySelector('p').textContent = 'Aguardando a recuperação do contexto gráfico…';
});
canvas.addEventListener('webglcontextrestored', () => { lostContext = false; firstDraw = true; });
window.addEventListener('keydown', event => {
  if (dialog.open || event.target.matches?.('input,select,textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }
  if (key === '+' || key === '=') view?.zoom(.85);
  if (key === '-') view?.zoom(1.18);
  if (key === 'escape') { setBuilding(false); inspect(); }
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => view?.resize());
$('home').onclick = () => view?.go(view.home.x, view.home.z, view.home.span);
destination.onchange = () => {
  if (!view || !destination.value) return;
  const town = view.world.towns[Number(destination.value)];
  if (!town) return;
  view.go(town.x, town.z, town.cityWall ? 92 : town.fort ? 39 : town.kind === 'manor' ? 29 : 43);
  inspect();
  setBuilding(false);
  destination.value = '';
};
$('lake').onclick = () => { if (view && places.lake) view.go(places.lake.x, places.lake.z, 60); };
$('peak').onclick = () => { if (view) view.go(places.peak.x, places.peak.z, 65); };
$('zoom-out').onclick = () => view?.zoom(1.24);
$('zoom-in').onclick = () => view?.zoom(.81);
$('build').onclick = () => { if (view) setBuilding(!building); };
$('diagnose').onclick = () => {
  const panel = $('diagnostics');
  panel.hidden = !panel.hidden;
  $('diagnose').setAttribute('aria-expanded', String(!panel.hidden));
  if (view) refresh();
};
$('layer').onchange = () => { if (view) image = mapImage(map, view.world, $('layer').value); };
$('walkways').onclick = () => {
  const button = $('walkways');
  const enabled = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(enabled));
  button.textContent = enabled ? 'Ocultar percursos' : 'Mostrar percursos';
  view?.showWalkways(enabled);
};
map.addEventListener('click', event => {
  if (!view) return;
  const bounds = map.getBoundingClientRect(), size = view.world.config.size;
  view.go((event.clientX - bounds.left) / bounds.width * size, (event.clientY - bounds.top) / bounds.height * size);
});

for (let size = CHUNK * 4; size <= CHUNK * 24; size += CHUNK) {
  form.elements.size.add(new Option(size + ' × ' + size + ' m', size));
}
for (const size of [1024, 1536, 2048, 3072, 4096, MAX_MAP_SIZE]) {
  form.elements.size.add(new Option(size + ' × ' + size + ' m', size));
}
for (const [name, label] of Object.entries(SETTINGS)) {
  const row = document.createElement('label');
  row.innerHTML = '<span>' + label + '</span><input type="range" name="' + name +
    '" min="0" max="1" step=".01"><output></output>';
  row.querySelector('input').addEventListener('input', updateRanges);
  $('sliders').append(row);
}
function updateRanges() {
  for (const key of Object.keys(SETTINGS)) {
    const input = form.elements[key];
    input.nextElementSibling.value = String(Math.round(input.valueAsNumber * 100));
  }
}
$('settings').onclick = () => {
  keys.clear();
  if (![...form.elements.size.options].some(o => Number(o.value) === current.size)) {
    form.elements.size.add(new Option(current.size + ' × ' + current.size + ' m', current.size));
  }
  for (const [key, value] of Object.entries(current)) form.elements[key].value = value;
  updateRanges();
  dialog.showModal();
};
$('close').onclick = () => dialog.close();
$('roll').onclick = () => { form.elements.seed.value = crypto.getRandomValues(new Uint32Array(1))[0]; };
form.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, ['style', 'detail'].includes(k) ? v : Number(v)]));
  dialog.close();
  const query = new URLSearchParams(values);
  if (new URLSearchParams(location.search).has('qa')) query.set('qa', '1');
  history.replaceState(null, '', '?' + query);
  loadWorld(configuration(values));
});

if (new URLSearchParams(location.search).has('qa')) {
  const point = new Vector3();
  window.kingdomQA = {
    stats: () => view && stats(), resetFrames: () => { intervals.length = 0; },
    focus: () => ({ ...view.focus }), go: (x, z, span) => view.go(x, z, span),
    state: () => state.snapshot(), world: () => view.world.config,
    walkway: id => view.world.towns[id]?.fort?.walkway,
    settlements: () => view.world.towns.map(({ id, kind, name, realm, x, z, fort, cityWall, buildings }) =>
      ({ id, kind, name, realm, x, z, gate: fort?.gate, metropolis: Boolean(cityWall), buildings: buildings.length })),
    project(x, y, z) {
      point.set(x, y, z).project(view.camera);
      return { x: (point.x + 1) * canvas.clientWidth / 2, y: (1 - point.y) * canvas.clientHeight / 2 };
    },
    targets(kind) {
      return [...view.chunks.values()].filter(c => c.group.visible).flatMap(c => c.objects)
        .filter(o => o.kind === kind && !state.removed.has(o.id))
        .map(o => ({ ...o, screen: this.project(o.x, o.y + (o.kind === 'tree' ? SPECIES[o.species].height * o.scale * .7 : o.scale * .42), o.z) }));
    },
    lots() {
      const { focus, world } = view, lots = [];
      for (let dz = -18; dz <= 18; dz++) for (let dx = -18; dx <= 18; dx++) {
        const x = Math.round(focus.x) + dx, z = Math.round(focus.z) + dz;
        if (x < 2 || z < 2 || x >= world.config.size - 2 || z >= world.config.size - 2) continue;
        if (state.placement(x, z)) continue;
        lots.push({ x, z, screen: this.project(x, world.ground[z * world.stride + x], z) });
      }
      return lots;
    }
  };
}

loadWorld(current);
requestAnimationFrame(frame);
