import { Group } from 'three';
import { instances } from './vegetation.js';

const cellOf = key => key.split(',').map(n => Math.floor(Number(n) / 2)).join(',');

// Batch presentation in 64 m cells; authoritative resources still belong to 32 m chunks.
export class VegetationBatches {
  constructor(scene, bank, materials) {
    Object.assign(this, { scene, bank, materials });
    this.chunks = new Map();
    this.members = new Map(); // Only the chunks belonging to each 64 m batch.
    this.cells = new Map();
    this.dirty = new Set();
    this.rebuilds = 0;
  }
  setChunk(key, objects, distant, visible) {
    const cell = cellOf(key);
    const previous = this.chunks.get(key);
    if (previous && previous.cell !== cell) {
      this.members.get(previous.cell)?.delete(key);
      this.dirty.add(previous.cell);
    }
    this.chunks.set(key, { objects, distant, visible, cell });
    if (!this.members.has(cell)) this.members.set(cell, new Map());
    this.members.get(cell).set(key, this.chunks.get(key));
    this.dirty.add(cell);
  }
  setVisible(key, visible) {
    const chunk = this.chunks.get(key);
    if (!chunk || chunk.visible === visible) return;
    chunk.visible = visible;
    this.dirty.add(chunk.cell);
  }
  removeChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.dirty.add(chunk.cell);
    this.chunks.delete(key);
    this.members.get(chunk.cell)?.delete(key);
    if (!this.members.get(chunk.cell)?.size) this.members.delete(chunk.cell);
  }
  release(cell) {
    const group = this.cells.get(cell);
    if (!group) return;
    this.scene.remove(group);
    for (const mesh of group.children) mesh.dispose(); // Geometry belongs to modelBank.
    this.cells.delete(cell);
  }
  flush(maximum = 6) {
    const started = performance.now();
    let rebuilt = 0;
    for (const cell of this.dirty) {
      const near = [], far = [];
      for (const chunk of this.members.get(cell)?.values() ?? []) {
        if (chunk.visible) (chunk.distant ? far : near).push(...chunk.objects);
      }
      const group = new Group();
      const meshes = [...instances(near, this.bank, this.materials, false), ...instances(far, this.bank, this.materials, true)];
      if (meshes.length) group.add(...meshes);
      this.release(cell);
      if (group.children.length) {
        this.cells.set(cell, group);
        this.scene.add(group);
      }
      this.dirty.delete(cell);
      this.rebuilds++;
      if (++rebuilt >= maximum || performance.now() - started > 5) break;
    }
  }
  diagnostics() {
    return { vegetationCells: this.cells.size, vegetationPending: this.dirty.size,
      vegetationDraws: [...this.cells.values()].reduce((n, group) => n + group.children.length, 0) };
  }
  dispose() {
    for (const cell of this.cells.keys()) this.release(cell);
    this.chunks.clear();
    this.members.clear();
    this.dirty.clear();
  }
}
