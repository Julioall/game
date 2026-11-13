import './style.css';
import { Vector3 } from 'three';
import { BIOMES, DEFAULT, HYDROLOGY_VERSIONS, MAX_MAP_SIZE, SETTINGS, SPECIES } from './world/catalog.js';
import { configuration } from './world/generate.js';
import { WorldState } from './world/state.js';
import { gridSample } from './world/math.js';
import { TRAVERSAL_TICK } from './world/traversal.js';
import { WorldView } from './render/view.js';
import { loadSave, savedGeneration, storeSave } from './platform/local-save.js';
import { mapImage, paintMap } from './ui/map.js';

const $ = id => document.getElementById(id);
const canvas = $('world'), map = $('map'), dialog = $('generator'), form = $('config');
const destination = $('destination');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const waterNames = { sea: 'Mar', lake: 'Lago', river: 'Rio' };
const travelNames = { walk: 'Caminhando', wade: 'Água rasa', swim: 'Nadando' };
const keys = new Set();
const intervals = [];
let view, state, image, places, worker, selected, pointer, toastTimer, lostContext = false;
let building = false, lastFrame = 0, lastUi = 0, firstDraw = false;
let choosingStart = false, traveler = null, travelTime = 0, ripple = null;
const initialParams = new URLSearchParams(location.search);
const requestedHydrology = Number(initialParams.get('hydrology'));
const explicitHydrology = HYDROLOGY_VERSIONS.includes(requestedHydrology);
let current = configuration({ ...DEFAULT, ...Object.fromEntries(
  [...initialParams].map(([k, v]) => [k, ['style', 'detail'].includes(k) ? v : Number(v)])
) });

function message(text) {
  $('toast').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 4200);
}

function inventory() {
  const { wood, stone } = state.inventory;
  $('wood').textContent = wood;
  $('stone').textContent = stone;
}

function setBuilding(enabled) {
  if (enabled) endTravel();
  building = enabled;
  $('build').setAttribute('aria-pressed', String(enabled));
  canvas.classList.toggle('building', enabled);
  if (enabled) {
    inspect();
    message('Escolha um terreno livre para a cabana · 3 madeiras e 2 pedras');
  }
}

function endTravel() {
  if (!choosingStart && !traveler) return;
  choosingStart = false;
  traveler = ripple = null;
  travelTime = 0;
  state?.endTraversal();
  view?.showTraveler(null);
  view?.waterRipple(0, 0, 0, 0);
  $('traverse').setAttribute('aria-pressed', 'false');
  $('map-controls').hidden = false;
  $('travel-controls').hidden = true;
}

function travelFrame(dx, dz, dt, now) {
  travelTime += Math.min(dt / 1000, .1);
  while (travelTime >= TRAVERSAL_TICK) {
    travelTime -= TRAVERSAL_TICK;
    if (!(dx || dz) && !state.hasTravelTarget && traveler.mode !== 'swim') continue;
    const next = state.moveTraveler(dx, dz);
    if (!next) { state.cancelTravelTarget(); continue; }
    if (next.mode !== traveler.mode) $('travel-mode').textContent = travelNames[next.mode];
    traveler = next;
    if (next.waterSurface !== undefined && !motion.matches && (!ripple || now - ripple.started >= 760)) {
      ripple = { x: next.x, z: next.z, started: now, strength: next.mode === 'swim' ? 1 : .68 };
    }
    view.showTraveler(traveler);
    view.move(traveler.x - view.focus.x, traveler.z - view.focus.z);
  }
  if (ripple) {
    const age = (now - ripple.started) / 760;
    view.waterRipple(ripple.x, ripple.z, age, age < 1 && !motion.matches ? ripple.strength : 0);
    if (age >= 1) ripple = null;
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
    const water = state.waterAt(point.x, point.z);
    if (water) {
      title.textContent = waterNames[water.kind];
      description.textContent = 'Profundidade ' + water.depth.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' m';
      return;
    }
    const { world } = view;
    const i = Math.round(point.z) * world.stride + Math.round(point.x);
    title.textContent = BIOMES[world.biome.at(i) ?? 0].name;
    description.textContent = 'Altitude ' + point.y.toFixed(1) + ' m · declive ' + Math.round((world.slope.at(i) ?? 0) * 100) + '%';
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
  const hit = view.pick(x, y, !building && !choosingStart && !traveler);
  if (choosingStart) {
    if (!hit.point || !state.beginTraversal(hit.point.x, hit.point.z)) return message('Escolha um ponto em terra firme.');
    choosingStart = false;
    clearTimeout(toastTimer);
    $('toast').textContent = '';
    traveler = state.traveler;
    view.go(traveler.x, traveler.z, 22);
    view.showTraveler(traveler);
    $('map-controls').hidden = true;
    $('travel-controls').hidden = false;
    $('travel-mode').textContent = travelNames[traveler.mode];
    return;
  }
  if (traveler) {
    if (hit.point) state.setTravelTarget(hit.point.x, hit.point.z);
    else state.cancelTravelTarget();
    return;
  }
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
  const realm = world.realms.find(r => r.id === (town?.realm ?? world.territory.at(i)));
  const type = town?.cityWall ? 'Grande cidade' : town?.fort ? 'Castelo nobre' : town?.kind === 'manor' ? 'Solar fortificado' : 'Vila';
  const title = town ? town.name + ' · ' + type : realm?.name ?? 'Terras de fronteira';
  $('region').textContent = title;
  const identity = document.querySelector('.identity');
  identity.title = [realm?.name, current.size + ' × ' + current.size + ' m'].filter(Boolean).join(' · ');
  identity.style.setProperty('--realm-color', realm?.color ?? '');
}

function loadWorld(config, preferSaved = true) {
  if (preferSaved) config = savedGeneration(config);
  worker?.terminate();
  if(view?.firstPerson)setFirstPerson(false);
  endTravel();
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
      const generated = data.world;
      state = new WorldState(generated, loadSave(generated.config));
      const presentation = state.presentation();
      const { world } = presentation;
      current = world.config;
      view?.destroy();
      view = null;
      view = new WorldView(canvas, presentation);
      view.showWalkways($('walkways').getAttribute('aria-pressed') === 'true');
      lostContext = false;
      inventory();
      places = world.landmarks;
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
    ['Fauna próxima / ativa', s.faunaNearby + ' / ' + s.faunaActive],
    ['Fauna pendente / falhas', s.faunaPending + ' / ' + s.faunaFailures],
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
    if (view.firstPerson) {
      view.walkFirstPerson(x,-y,dt/1000);
    } else if (traveler) {
      const scale = Math.max(1, Math.hypot(x, y));
      travelFrame((x + y) * Math.SQRT1_2 / scale, (y - x) * Math.SQRT1_2 / scale, dt, now);
    } else if (x || y) view.pan(x * Math.min(dt, 48) * .46, y * Math.min(dt, 48) * .46);
  }
  if(!dialog.open) state.tickFauna(Math.min(dt/1000,.1),{
    x:traveler?.x??view.focus.x,z:traveler?.z??view.focus.z,
    radius:Math.max(110,view.focus.span*Math.hypot(view.aspect,1))
  });
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
  if (view.firstPerson) {
    canvas.requestPointerLock?.()?.catch?.(() => message('Arraste para olhar ao redor.'));
    pointer = {x:event.clientX,y:event.clientY,moved:true};
    return;
  }
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointer = { x: event.clientX, y: event.clientY, moved: false };
});
canvas.addEventListener('pointermove', event => {
  if (view?.firstPerson) {
    if (document.pointerLockElement === canvas || pointer) view.lookFirstPerson(event.movementX,event.movementY);
    return;
  }
  if (!pointer || !view || !event.isPrimary) return;
  if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 5) return;
  pointer.moved = true;
  if (traveler) return;
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
  if (!view || view.firstPerson) return;
  const bounds = canvas.getBoundingClientRect();
  const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
  const delta = Math.max(-160, Math.min(160, event.deltaY * units));
  if (traveler) return view.zoom(Math.exp(delta * .0017));
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
  if (key === 'escape') { setFirstPerson(false); endTravel(); setBuilding(false); inspect(); }
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => view?.resize());
function setFirstPerson(enabled) {
  if (!view) return;
  endTravel();
  setBuilding(false);
  inspect();
  view.setFirstPerson(enabled);
  $('first-person').setAttribute('aria-pressed',String(enabled));
  if (!enabled) document.exitPointerLock?.();
  pointer=null;
  keys.clear();
  if(enabled) message('WASD para andar · clique e mova o mouse para olhar · Esc volta ao mapa');
}
$('first-person').onclick = () => {
  setFirstPerson(!view?.firstPerson);
  if(view?.firstPerson) canvas.requestPointerLock?.()?.catch?.(()=>{});
};
$('traverse').onclick = () => {
  if(view?.firstPerson)setFirstPerson(false);
  if (!view || !$('loading').hidden) return;
  if (choosingStart || traveler) return endTravel();
  setBuilding(false);
  inspect();
  choosingStart = true;
  $('traverse').setAttribute('aria-pressed', 'true');
  message('Clique em terra firme perto da margem para começar.');
};
$('home').onclick = () => { endTravel(); view?.go(view.home.x, view.home.z, view.home.span); };
destination.onchange = () => {
  if (!view || !destination.value) return;
  const town = view.world.towns[Number(destination.value)];
  if (!town) return;
  endTravel();
  view.go(town.x, town.z, town.cityWall ? 92 : town.fort ? 39 : town.kind === 'manor' ? 29 : 43);
  inspect();
  setBuilding(false);
  destination.value = '';
};
$('lake').onclick = () => { endTravel(); if (view && places.lake) view.go(places.lake.x, places.lake.z, 60); };
$('peak').onclick = () => { endTravel(); if (view) view.go(places.peak.x, places.peak.z, 65); };
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
  endTravel();
  const bounds = map.getBoundingClientRect(), size = view.world.config.size;
  view.go((event.clientX - bounds.left) / bounds.width * size, (event.clientY - bounds.top) / bounds.height * size);
});

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
  for (const [key, value] of Object.entries(current)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
  updateRanges();
  dialog.showModal();
};
$('close').onclick = () => dialog.close();
$('roll').onclick = () => { form.elements.seed.value = crypto.getRandomValues(new Uint32Array(1))[0]; };
form.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, ['style', 'detail'].includes(k) ? v : Number(v)]));
  if (explicitHydrology) values.hydrology = requestedHydrology;
  dialog.close();
  const query = new URLSearchParams(values);
  if (new URLSearchParams(location.search).has('qa')) query.set('qa', '1');
  history.replaceState(null, '', '?' + query);
  loadWorld(configuration(values), values.hydrology === undefined);
});

if (new URLSearchParams(location.search).has('qa')) {
  const point = new Vector3();
  window.kingdomQA = {
    stats: () => view && stats(), resetFrames: () => { intervals.length = 0; },
    focus: () => ({ ...view.focus }), go: (x, z, span) => view.go(x, z, span),
    fauna: () => view?.faunaActors.diagnostics(),
    faunaActors: () => [...(view?.faunaActors.actors.values() ?? [])].map(({ animal, record }) => ({
      id: record.id, species: record.species, x: record.x, y: record.y, z: record.z,
      screen: (() => { point.set(record.x, record.y, record.z).project(view.camera); return {
        x: (point.x + 1) * canvas.clientWidth / 2, y: (1 - point.y) * canvas.clientHeight / 2
      }; })(),
      animal: { x: animal.position.x, y: animal.position.y, z: animal.position.z }
    })),
    state: () => state?.snapshot(), world: () => view && view.world.config,
    groundAt: (x, z) => gridSample(view.world.ground, view.world.stride, x, z),
    waterAt: (x, z) => state.waterAt(x, z),
    traveler: () => state.traveler,
    walkway: id => view.world.towns[id]?.fort?.walkway,
    settlements: () => view.world.towns.map(({ id, kind, name, realm, x, z, fort, cityWall, buildingCount }) =>
      ({ id, kind, name, realm, x, z, gate: fort?.gate, metropolis: Boolean(cityWall), buildings: buildingCount })),
    project(x, y, z) {
      point.set(x, y, z).project(view.camera);
      return { x: (point.x + 1) * canvas.clientWidth / 2, y: (1 - point.y) * canvas.clientHeight / 2 };
    },
    targets(kind) {
      return [...view.chunks.values()].filter(c => c.group.visible).flatMap(c => c.objects)
        .filter(o => o.kind === kind && !state.isRemoved(o.id))
        .map(o => ({ ...o, screen: this.project(o.x, o.y + (o.kind === 'tree' ? SPECIES[o.species].height * o.scale * .7 : o.scale * .42), o.z) }));
    },
    lots() {
      const { focus, world } = view, lots = [];
      for (let dz = -18; dz <= 18; dz++) for (let dx = -18; dx <= 18; dx++) {
        const x = Math.round(focus.x) + dx, z = Math.round(focus.z) + dz;
        if (x < 2 || z < 2 || x >= world.config.size - 2 || z >= world.config.size - 2) continue;
        if (state.placement(x, z)) continue;
        lots.push({ x, z, screen: this.project(x, world.ground.at(z * world.stride + x), z) });
      }
      return lots;
    }
  };
}

loadWorld(current, !explicitHydrology);
requestAnimationFrame(frame);
