import { seaBeachDistance } from './coast.js';
import { PixelArtPass } from './pixel-art.js';
import * as T from 'three';
import { CHUNK, SPECIES } from '../world/catalog.js';
import { crownOverlaps } from '../world/audit.js';
import { chunkKey } from '../world/chunks.js';
import { chunkObjects } from '../world/vegetation.js';
import { clamp, gridSample } from '../world/math.js';
import { beachMaterial, buildingMaterial, makeClock, objectMaterial, shadowMaterial, terrainMaterial, waterMaterial } from './materials.js';
import { groundShadows, surfaceMeshes } from './terrain.js';
import { instances, modelBank } from './vegetation.js';
import { structuresMesh } from './structures.js';
import { travelerModel } from './traveler.js';
import { FaunaActors } from './fauna.js';
import { oceanGeometry } from './water.js';

const viewing = new T.Vector3(1, 1.16, 1);
const groundPitch = viewing.y / viewing.length();
const frustum = new T.Frustum(), matrix = new T.Matrix4();
const ndc = new T.Vector2(), point = new T.Vector3(), center = new T.Vector3();

function dispose(mesh) {
  if (!mesh.userData.sharedGeometry) mesh.geometry?.dispose();
  if (mesh.isInstancedMesh) mesh.dispose();
}

export class WorldView {
  constructor(canvas, projection) {
    const { world } = projection;
    this.canvas = canvas;
    this.world = { ...world, beachDistance: seaBeachDistance(world) };
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
      terrain: terrainMaterial(), water: waterMaterial(this.clock), beach: beachMaterial(this.clock), shadow: shadowMaterial(),
      wind: objectMaterial(this.clock, true), solid: objectMaterial(this.clock),
      houses: buildingMaterial()
    };
    this.bank = modelBank(world.config.style);
    this.ocean = new T.Mesh(oceanGeometry(world.config.size), this.materials.water);
    this.scene.add(this.ocean);
    this.traveler = travelerModel();
    this.scene.add(this.traveler);
    this.walkwayOverlay = null;
    this.chunks = new Map();
    this.faunaIndex = projection.fauna;
    this.faunaActors = new FaunaActors({ THREE: T, scene: this.scene, index: this.faunaIndex, world,
      visible: record => {
        const p = new T.Vector3(record.x,record.y+.6,record.z).project(this.camera);
        return p.z>=-1 && p.z<=1 && Math.abs(p.x)<=1.05 && Math.abs(p.y)<=1.05;
      },
      readState: id => projection.fauna.read(id) });
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
    const scale = { crisp: 2, balanced: 3, atlas: 4 }[this.world.config.detail];
    this.renderer.setSize(Math.max(1, Math.round(width / scale)), Math.max(1, Math.round(height / scale)), false);
    this.pixelArt.resize(this.renderer.domElement.width,this.renderer.domElement.height);
    this.aspect = width / height;
    this.stale = true;
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
        new T.Vector3(center.x - 20, -15, center.z - 20),
        new T.Vector3(center.x + 20, 52, center.z + 20)
      );
      if (!frustum.intersectsBox(box)) continue;
      const distance = Math.hypot(center.x - x, center.z - z);
      const key = cx + ',' + cz;
      const existing = this.chunks.get(key);
      const limit = existing?.distant ? 45 : 58;
      candidates.push({ cx, cz, key, distance, distant: span > 66 || distance > limit });
    }
    this.near = candidates.sort((a, b) => a.distance - b.distance).slice(0, 66);
    const visible = new Set(this.near.map(c => c.key));
    for (const [key, chunk] of this.chunks) {
      if (chunk.group.visible !== visible.has(key)) this.renderer.shadowMap.needsUpdate = true;
      chunk.group.visible = visible.has(key);
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
    const objects = instances(natural, this.bank, this.materials, entry.distant);
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
    let count = 0;
    for (const entry of this.near) {
      let chunk = this.chunks.get(entry.key);
      if (chunk && !chunk.dirty && chunk.distant === entry.distant) continue;
      if (count > 0 && (count >= 2 || performance.now() - started > 5)) break;
      if (!chunk) {
        const group = new T.Group();
        const surfaces = surfaceMeshes(this.world, this.index, entry.cx, entry.cz, this.materials);
        group.add(...surfaces);
        chunk = { key: entry.key, group, surfaces, touched: this.frame,
          objects: chunkObjects(this.world, this.index, entry.cx, entry.cz).filter(o => {
            const i=Math.round(o.z)*this.world.stride+Math.round(o.x);
            return o.kind==='rock' || this.world.beachDistance.at(i)>10 || o.y>3.5;
          }) };
        this.chunks.set(entry.key, chunk);
        this.scene.add(group);
      }
      this.decorate(chunk, entry);
      count++;
    }
    if (count) {
      this.lastChunkMs = performance.now() - started;
      this.maxChunkMs = Math.max(this.maxChunkMs, this.lastChunkMs);
    }
    if (this.chunks.size <= 80) return;
    const inactive = [...this.chunks].filter(([, c]) => !c.group.visible).sort((a, b) => a[1].touched - b[1].touched);
    for (const [key, chunk] of inactive) {
      if (this.chunks.size <= 80) break;
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
    if (this.stale) this.updateCamera();
    this.frame++;
    this.stream();
    const dt = this.previousDraw === undefined ? 0 : seconds - this.previousDraw;
    this.previousDraw = seconds;
    this.faunaActors.radius = Math.max(44, this.focus.span * Math.hypot(this.aspect, 1));
    this.faunaActors.update(this.focus, dt, performance.now() / 1000);
    this.clock.value = seconds;
    this.renderer.info.reset();
    this.pixelArt.render(this.renderer, this.scene, this.camera);
  }

  pick(clientX, clientY, objects = true) {
    const rect = this.canvas.getBoundingClientRect();
    ndc.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
    this.ray.setFromCamera(ndc, this.camera);
    const active = [...this.chunks.values()].filter(c => c.group.visible);
    const terrain = this.ray.intersectObjects(active.flatMap(c => c.surfaces), false)[0];
    let bestDistance = terrain?.distance ?? Infinity, hit = null;
    if (objects) for (const chunk of active) for (const o of chunk.objects) {
      if (!['tree', 'rock'].includes(o.kind) || this.projection.isRemoved(o.id)) continue;
      const y = o.kind === 'tree' ? SPECIES[o.species].height * o.scale * .70 : o.scale * .42;
      const radius = o.kind === 'tree' ? Math.max(.55, o.radius * .85) : o.scale * .62;
      point.set(o.x, o.y + y, o.z);
      if (this.ray.ray.distanceSqToPoint(point) > radius * radius) continue;
      const distance = this.ray.ray.origin.distanceTo(point) - radius;
      if (distance < bestDistance) { bestDistance = distance; hit = o; }
    }
    return { object: hit, point: terrain?.point };
  }

  release(chunk) {
    this.scene.remove(chunk.group);

    for (const mesh of chunk.group.children) dispose(mesh);
  }

  diagnostics() {
    const render = this.renderer.info.render, memory = this.renderer.info.memory;
    const objects = this.near.flatMap(c => this.chunks.get(c.key)?.objects ?? [])
      .filter(o => !this.projection.isRemoved(o.id));
    return { active: this.near.filter(c => this.chunks.has(c.key)).length, desired: this.near.length,
      cached: this.chunks.size, calls: render.calls, triangles: render.triangles,
      geometries: memory.geometries, chunkMs: this.lastChunkMs, maxChunkMs: this.maxChunkMs, objects: objects.length,
      crowns: crownOverlaps(objects), ...this.faunaActors.diagnostics() };
  }

  destroy() {
    this.faunaActors.dispose();
    for (const chunk of this.chunks.values()) this.release(chunk);
    this.bank.clear();
    this.ocean.geometry.dispose();
    this.traveler.userData.dispose();
    for (const mat of Object.values(this.materials)) mat.dispose();
    this.sun.shadow.dispose();
    if (this.walkwayOverlay) {
      this.walkwayOverlay.children[0].geometry.dispose();
      for (const line of this.walkwayOverlay.children) line.material.dispose();
    }
    this.pixelArt.dispose();
    this.renderer.dispose();
  }
}
