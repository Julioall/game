import { seaBeachDistance, seaShoreDistance } from './coast.js';
import { PixelArtPass } from './pixel-art.js';
import { renderResolution } from './resolution.js';
import * as T from 'three';
import { CHUNK, SPECIES } from '../world/catalog.js';
import { crownOverlaps } from '../world/audit.js';
import { chunkKey } from '../world/chunks.js';
import { chunkObjects } from '../world/vegetation.js';
import { clamp, gridSample } from '../world/math.js';
import { buildingMaterial, groundcoverMaterial, makeClock, objectMaterial, shadowMaterial, terrainMaterial } from './materials.js';
import { groundShadows, surfaceMeshes } from './terrain.js';
import { instances, modelBank, grassView, treeVisualScale } from './vegetation.js';
import { VegetationBatches } from './vegetation-batches.js';
import { structuresMesh } from './structures.js';
import { travelerModel } from './traveler.js';
import { FaunaActors } from './fauna.js';
import { faunaProfile } from './fauna-budget.js';
import { GpuTimer, GpuDensityBudget } from './gpu-timer.js';
import { waterMaterial } from './water.js';
import { outerOceanGeometry } from './water-geometry.js';
import { WaterReflections } from './water-reflections.js';

const viewing = new T.Vector3(1, 1.16, 1);
const groundPitch = viewing.y / viewing.length();
const frustum = new T.Frustum(), matrix = new T.Matrix4();
const ndc = new T.Vector2(), point = new T.Vector3(), center = new T.Vector3();

function dispose(mesh) {
  if (!mesh.userData.sharedGeometry) mesh.geometry?.dispose();
  if (mesh.isInstancedMesh) mesh.dispose();
}

export class WorldView {
  constructor(canvas, projection, { baseline = false } = {}) {
    this.performanceBaseline = baseline;
    const { world } = projection;
    this.canvas = canvas;
    this.world = { ...world, beachDistance: seaBeachDistance(world), coastDistance: seaShoreDistance(world) };
    this.projection = projection;
    this.index = projection.index;
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#233e40');
    this.scene.fog = new T.Fog('#77948b', 250, 403);
    this.scene.add(new T.HemisphereLight('#fff0cb', '#8095bd', 2.25));
    const sun = new T.DirectionalLight('#ffedc4', 1.85);
    sun.position.set(-45, 70, -24);
    this.scene.add(sun);
    this.renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gpuTimer = new GpuTimer(this.renderer.getContext());
    this.gpuBudget = new GpuDensityBudget();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -.00032;
    sun.shadow.normalBias = .035;
    sun.shadow.radius = 1.45;
    Object.assign(sun.shadow.camera, { left: -49, right: 49, top: 49, bottom: -49, near: 5, far: 184 });
    sun.shadow.camera.updateProjectionMatrix();
    this.sun = sun;
    this.scene.add(sun.target);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.pixelArt = new PixelArtPass();
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 480);
    const town = world.towns[0];
    this.home = { x: town?.x ?? world.config.size * .5, z: town?.z ?? world.config.size * .52, span: 43 };
    this.focus = { ...this.home };
    this.clock = makeClock();
    this.materials = {
      terrain: terrainMaterial(), shadow: shadowMaterial(), water: waterMaterial(this.clock),
      wind: objectMaterial(this.clock, true), solid: objectMaterial(this.clock),
      groundcover: groundcoverMaterial(this.clock),
      houses: buildingMaterial()
    };
    this.outerOcean = new T.Mesh(outerOceanGeometry(world.config.size), this.materials.water);
    this.scene.add(this.outerOcean);
    this.waterReflections = new WaterReflections(this.materials.water);
    this.bank = modelBank(world.config.style, !baseline);
    this.vegetation = new VegetationBatches(this.scene, this.bank, this.materials);
    this.traveler = travelerModel();
    this.scene.add(this.traveler);
    this.walkwayOverlay = null;
    this.chunks = new Map();
    this.faunaIndex = projection.fauna;
    this.faunaActors = new FaunaActors({ THREE: T, scene: this.scene, index: this.faunaIndex, world,
      visible: (record, margin = 1.05) => {
        const p = new T.Vector3(record.x,record.y+.6,record.z).project(this.camera);
        return p.z>=-1 && p.z<=1 && Math.abs(p.x)<=margin && Math.abs(p.y)<=margin;
      },
      readState: id => projection.fauna.read(id),
      stagger: !baseline,
      presentationProfile: baseline ? null
        : record => faunaProfile(record, this.focus, this.canvas.clientHeight, Boolean(this.firstPerson)) });
    this.bridges = new Map();
    for (const { bridge, x, z } of world.towns) {
      if (!bridge) continue;
      const key = chunkKey(x, z);
      if (!this.bridges.has(key)) this.bridges.set(key, []);
      this.bridges.get(key).push(bridge);
    }
    this.ray = new T.Raycaster();
    this.near = [];
    this.stale = true;
    this.frame = 0;
    this.lastChunkMs = 0;
    this.maxChunkMs = 0;
    this.resize();
  }

  resize() {
    const width = this.canvas.clientWidth || innerWidth, height = this.canvas.clientHeight || innerHeight;
    this.aspect = width / height;
    this.updateResolution();
    this.stale = true;
  }

  updateResolution() {
    const width = this.canvas.clientWidth || innerWidth, height = this.canvas.clientHeight || innerHeight;
    const target = renderResolution(this.world.config.detail, this.focus.span, width, height, Boolean(this.firstPerson), this.gpuBudget.cap);
    if (this.renderWidth === target.width && this.renderHeight === target.height) return;
    this.renderer.setSize(target.width, target.height, false);
    this.pixelArt.resize(target.width, target.height);
    this.renderWidth = target.width;
    this.renderHeight = target.height;
    this.pixelScale = target.scale;
  }

  showTraveler(actor) {
    const wasVisible = this.traveler.visible;
    this.traveler.visible = Boolean(actor);
    if (!actor) return;
    if (wasVisible) {
      const dx = actor.x - this.traveler.position.x, dz = actor.z - this.traveler.position.z;
      if (dx || dz) this.traveler.rotation.y = Math.atan2(dx, dz);
    }
    this.traveler.position.set(actor.x, actor.y - (actor.mode === 'swim' ? 1.20 : 0), actor.z);
  }

  waterRipple(x, z, age, strength) {
    this.materials.water.uniforms.ripple.value.set(x, z, age, strength);
  }

  move(dx, dz) {
    const { size } = this.world.config;
    this.focus.x = clamp(this.focus.x + dx, 2, size - 2);
    this.focus.z = clamp(this.focus.z + dz, 2, size - 2);
    this.stale = true;
  }

  pan(screenX, screenY) {
    const u = screenX * this.focus.span / this.canvas.clientHeight;
    const v = screenY * this.focus.span / this.canvas.clientHeight / groundPitch;
    this.move((u + v) * Math.SQRT1_2, (v - u) * Math.SQRT1_2);
  }

  zoom(amount, offsetX = 0, offsetY = 0) {
    const previous = this.focus.span;
    this.focus.span = clamp(previous * amount, 20, Math.min(112, 198 / this.aspect));
    const shift = previous / this.focus.span - 1;
    if (shift && (offsetX || offsetY)) this.pan(offsetX * shift, offsetY * shift);
    this.stale = true;
  }

  go(x, z, span = this.focus.span) {
    this.focus = { x, z, span };
    this.move(0, 0);
    this.zoom(1);
  }

  setFirstPerson(enabled) {
    if (enabled === Boolean(this.firstPerson)) return;
    if (enabled) {
      this.mapCamera = this.camera;
      this.camera = new T.PerspectiveCamera(70, this.aspect, .08, 300);
      this.firstPerson = { yaw: Math.PI*.25, pitch: 0 };
    } else {
      this.camera = this.mapCamera;
      this.firstPerson = null;
    }
    this.stale = true;
  }

  lookFirstPerson(dx,dy) {
    if (!this.firstPerson) return;
    this.firstPerson.yaw -= dx*.002;
    this.firstPerson.pitch = clamp(this.firstPerson.pitch-dy*.002,-1.45,1.45);
    this.stale = true;
  }

  walkFirstPerson(strafe,forward,dt) {
    if (!this.firstPerson) return;
    const yaw=this.firstPerson.yaw, scale=4*Math.min(dt,.05)/Math.max(1,Math.hypot(strafe,forward));
    const dx=(Math.cos(yaw)*strafe-Math.sin(yaw)*forward)*scale;
    const dz=(-Math.sin(yaw)*strafe-Math.cos(yaw)*forward)*scale;
    this.move(dx,dz);
  }

  updateCamera() {
    this.updateResolution();
    const { x, z, span } = this.focus;
    const y = gridSample(this.world.ground, this.world.stride, x, z) + 1.4;
    const sx = Math.round(x / 16) * 16, sz = Math.round(z / 16) * 16;
    const shadowFocus = this.sun.target.position;
    if (shadowFocus.x !== sx || shadowFocus.z !== sz) {
      const sy = gridSample(this.world.ground, this.world.stride, sx, sz);
      shadowFocus.set(sx, sy, sz);
      this.sun.position.set(sx - 45, sy + 70, sz - 24);
      this.renderer.shadowMap.needsUpdate = true;
    }
    const camera = this.camera;
    if (this.firstPerson) {
      camera.aspect = this.aspect;
      camera.position.set(x,y+.3,z);
      camera.rotation.order='YXZ';
      camera.rotation.set(this.firstPerson.pitch,this.firstPerson.yaw,0);
    } else {
    camera.position.copy(viewing).multiplyScalar(144).add(point.set(x, y, z));
    camera.lookAt(x, y, z);
    camera.left = -span * this.aspect * .5;
    camera.right = -camera.left;
    camera.top = span * .5;
    camera.bottom = -camera.top;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const max = Math.ceil(this.world.config.size / CHUNK) - 1;
    const candidates = [];
    const first = v => Math.max(0, Math.ceil((v - 150) / CHUNK - .5));
    const last = v => Math.min(max, Math.floor((v + 150) / CHUNK - .5));
    for (let cz = first(z); cz <= last(z); cz++) for (let cx = first(x); cx <= last(x); cx++) {
      center.set((cx + .5) * CHUNK, 10, (cz + .5) * CHUNK);
      const box = new T.Box3(
        new T.Vector3(center.x - 52, -15, center.z - 52),
        new T.Vector3(center.x + 52, 52, center.z + 52)
      );
      if (!frustum.intersectsBox(box)) continue;
      const distance = Math.hypot(center.x - x, center.z - z);
      const key = cx + ',' + cz;
      const existing = this.chunks.get(key);
      const limit = existing?.distant ? 45 : 58;
      // Every chunk entering the camera is shown with its complete vegetation.
      // Keep geometry stable throughout panning/zoom: no visible chunk swaps
      // or procedural grass removal while the player is watching.
      candidates.push({ cx, cz, key, distance, distant: false });
    }
    this.near = candidates.sort((a, b) => a.distance - b.distance).slice(0, 100);
    const visible = new Set(this.near.map(c => c.key));
    for (const [key, chunk] of this.chunks) {
      if (chunk.group.visible !== visible.has(key)) this.renderer.shadowMap.needsUpdate = true;
      chunk.group.visible = visible.has(key);
      this.vegetation.setVisible(key, chunk.group.visible);
      if (chunk.group.visible) chunk.touched = this.frame;
    }
    this.stale = false;
  }

  decorate(chunk, entry) {
    for (const mesh of chunk.dynamic ?? []) {
      chunk.group.remove(mesh);
      dispose(mesh);
    }
    const natural = chunk.objects.filter(o => !this.projection.isRemoved(o.id));
    const buildings = [...(this.index.buildings.get(entry.key) ?? []), ...this.projection.buildingsAt(entry.key)];
    const objects = this.performanceBaseline ? instances(natural, this.bank, this.materials, entry.distant) : [];
    if (!this.performanceBaseline) this.vegetation.setChunk(entry.key, natural, entry.distant, chunk.group.visible);
    const forts = this.index.defenses.get(entry.key) ?? [];
    const structures = structuresMesh(buildings, this.bridges.get(entry.key) ?? [], forts, this.world, this.materials.houses);
    if (structures) {
      structures.castShadow = true;
      structures.receiveShadow = true;
    }
    this.renderer.shadowMap.needsUpdate = true;
    const shadows = groundShadows(this.world, natural, this.materials.shadow);
    chunk.dynamic = [...objects, structures, shadows].filter(Boolean);
    for (const mesh of chunk.dynamic) chunk.group.add(mesh);
    chunk.distant = entry.distant;
    chunk.dirty = false;
  }


  stream() {
    const started = performance.now();
    // Prepare lightweight ground before the expensive plant generation. The
    // expanded camera bounds warm one extra row before it enters the viewport.
    let surfacesCreated = 0;
    for (const entry of this.near) {
      if (this.chunks.has(entry.key)) continue;
      if (surfacesCreated && (surfacesCreated >= 8 || performance.now() - started > 5)) break;
      const group = new T.Group();
      const surfaces = surfaceMeshes(this.world, this.index, entry.cx, entry.cz, this.materials);
      group.add(...surfaces);
      this.chunks.set(entry.key, { key: entry.key, group, surfaces, touched: this.frame, dirty: true });
      this.scene.add(group);
      surfacesCreated++;
    }
    let count = 0;
    for (const entry of this.near) {
      let chunk = this.chunks.get(entry.key);
      if (chunk && !chunk.dirty && chunk.distant === entry.distant) continue;
      if (count > 0 && (count >= 6 || performance.now() - started > 7)) break;
      if (!chunk) continue;
      if (!chunk.objects) {
        chunk.objects = chunkObjects(this.world, this.index, entry.cx, entry.cz).filter(o => {
            const i=Math.round(o.z)*this.world.stride+Math.round(o.x);
            return o.kind==='rock' || this.world.beachDistance.at(i)>10 || o.y>3.5;
          });
      }
      this.decorate(chunk, entry);
      count++;
    }
    if (count) {
      this.lastChunkMs = performance.now() - started;
      this.maxChunkMs = Math.max(this.maxChunkMs, this.lastChunkMs);
    }
    if (this.chunks.size <= 144) return;
    const inactive = [...this.chunks].filter(([, c]) => !c.group.visible).sort((a, b) => a[1].touched - b[1].touched);
    for (const [key, chunk] of inactive) {
      if (this.chunks.size <= 144) break;
      this.release(chunk);
      this.chunks.delete(key);
    }
  }

  invalidate(key) {
    const chunk = this.chunks.get(key);
    if (chunk) chunk.dirty = true;
  }

  showWalkways(enabled) {
    if (this.walkwayOverlay) {
      this.walkwayOverlay.visible = enabled;
      return;
    }
    if (!enabled) return;
    const positions = [], colors = [];
    const surface = new T.Color('#ffe2a0'), raised = new T.Color('#70e0dd'), stair = new T.Color('#f5a969');
    for (const town of this.world.towns) for (const path of [town.fort?.walkway, town.bridge?.walkway]) {
      if (!path) continue;
      for (const { from, to, kind } of path.edges) {
        const tint = kind === 'escada' ? stair : ['adarve', 'patamar', 'ponte'].includes(kind) ? raised : surface;
        const lift = kind === 'escada' ? .23 : .095;
        for (const i of [from, to]) {
          const p = path.nodes[i];
          positions.push(p.x, p.y + lift, p.z);
          colors.push(tint.r, tint.g, tint.b);
        }
      }
    }
    if (!positions.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    this.walkwayOverlay = new T.Group();
    const hidden = new T.LineSegments(g, new T.LineBasicMaterial({
      vertexColors: true, depthFunc: T.GreaterDepth, depthWrite: false, transparent: true, opacity: .40
    }));
    const visible = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true }));
    this.walkwayOverlay.add(hidden, visible);
    this.scene.add(this.walkwayOverlay);
  }

  draw(seconds) {
    const cpuStarted = performance.now();
    if (this.stale) this.updateCamera();
    this.frame++;
    grassView.value.set(this.focus.x, this.focus.z, this.firstPerson ? 20 : this.focus.span);
    this.stream();
    this.vegetation.flush();
    const dt = this.previousDraw === undefined ? 0 : seconds - this.previousDraw;
    this.previousDraw = seconds;
    this.faunaActors.radius = Math.max(44, this.focus.span * Math.hypot(this.aspect, 1));
    this.faunaActors.animationInterval = 1 / 60;
    const faunaStarted = performance.now();
    this.faunaActors.update(this.focus, dt, performance.now() / 1000);
    const faunaMs = performance.now() - faunaStarted;
    this.faunaCpuMs = this.faunaCpuMs === undefined ? faunaMs : this.faunaCpuMs * .9 + faunaMs * .1;
    this.clock.value = seconds;
    this.renderer.info.reset();
    this.gpuTimer.begin();
    this.waterReflections.update(this.renderer, this.scene, this.camera, this.world, this.focus, performance.now());
    this.pixelArt.render(this.renderer, this.scene, this.camera);
    this.gpuTimer.end();
    const cpuMs = performance.now() - cpuStarted;
    this.renderCpuMs = this.renderCpuMs === undefined ? cpuMs : this.renderCpuMs * .9 + cpuMs * .1;
    const stable = !this.firstPerson && this.focus.span >= 66 && !this.vegetation.dirty.size
      && !this.faunaActors.pending.size && this.near.every(entry => {
        const chunk = this.chunks.get(entry.key);
        return chunk && !chunk.dirty && chunk.distant === entry.distant;
      });
    if (!this.performanceBaseline && this.gpuBudget.observe(this.gpuTimer.average(), this.renderCpuMs, this.gpuTimer.serial, stable)) this.updateResolution();
  }

  pick(clientX, clientY, objects = true) {
    const rect = this.canvas.getBoundingClientRect();
    ndc.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
    this.ray.setFromCamera(ndc, this.camera);
    const active = [...this.chunks.values()].filter(c => c.group.visible);
    const terrain = this.ray.intersectObjects(active.flatMap(c => c.surfaces), false)[0];
    let bestDistance = terrain?.distance ?? Infinity, hit = null;
    if (objects) for (const chunk of active) for (const o of chunk.objects ?? []) {
      if (!['tree', 'rock'].includes(o.kind) || this.projection.isRemoved(o.id)) continue;
        const visualScale = o.kind === 'tree' ? treeVisualScale(o) : 1;
        const y = o.kind === 'tree' ? SPECIES[o.flora?.renderSpecies ?? o.species].height * o.scale * visualScale * .70 : o.scale * .42;
      const radius = o.kind === 'tree' ? Math.max(.55, o.radius * visualScale * .85) : o.scale * .62;
      point.set(o.x, o.y + y, o.z);
      if (this.ray.ray.distanceSqToPoint(point) > radius * radius) continue;
      const distance = this.ray.ray.origin.distanceTo(point) - radius;
      if (distance < bestDistance) { bestDistance = distance; hit = o; }
    }
    return { object: hit, point: terrain?.point };
  }

  release(chunk) {
    this.vegetation.removeChunk(chunk.key);
    this.scene.remove(chunk.group);

    for (const mesh of chunk.group.children) dispose(mesh);
  }

  diagnostics() {
    const render = this.renderer.info.render, memory = this.renderer.info.memory;
    const objects = this.near.flatMap(c => this.chunks.get(c.key)?.objects ?? [])
      .filter(o => !this.projection.isRemoved(o.id));
    return { active: this.near.filter(c => this.chunks.has(c.key)).length, desired: this.near.length,
      cached: this.chunks.size, calls: render.calls, triangles: render.triangles,
      geometries: memory.geometries, renderWidth: this.renderWidth, renderHeight: this.renderHeight, pixelScale: this.pixelScale,
      gpuMs: this.gpuTimer.average(), renderCpuMs: this.renderCpuMs ?? 0, gpuDensityCap: this.gpuBudget.cap,
      chunkMs: this.lastChunkMs, maxChunkMs: this.maxChunkMs, objects: objects.length,
      crowns: crownOverlaps(objects), faunaCpuMs: this.faunaCpuMs ?? 0,
      ...this.vegetation.diagnostics(), ...this.faunaActors.diagnostics() };
  }

  destroy() {
    this.waterReflections.dispose();
    this.outerOcean.geometry.dispose();
    this.faunaActors.dispose();
    for (const chunk of this.chunks.values()) this.release(chunk);
    this.vegetation.dispose();
    this.bank.clear();
    this.traveler.userData.dispose();
    for (const mat of Object.values(this.materials)) mat.dispose();
    this.sun.shadow.dispose();
    if (this.walkwayOverlay) {
      this.walkwayOverlay.children[0].geometry.dispose();
      for (const line of this.walkwayOverlay.children) line.material.dispose();
    }
    this.pixelArt.dispose();
    this.gpuTimer.dispose();
    this.renderer.dispose();
  }
}
