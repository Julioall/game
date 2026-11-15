import { Group } from 'three';
import { instances } from './vegetation.js';

const cellOf = key => key.split(',').map(n => Math.floor(Number(n) / 2)).join(',');

// Batch presentation in 64 m cells; authoritative resources still belong to 32 m chunks.
export class VegetationBatches {
  constructor(scene, bank, materials) {
    Object.assign(this, { scene, bank, materials });
    this.chunks = new Map();
    this.cells = new Map();
    this.dirty = new Set();
    this.rebuilds = 0;
  }
  setChunk(key, objects, distant, visible) {
    this.chunks.set(key, { objects, distant, visible, cell: cellOf(key) });
    this.dirty.add(cellOf(key));
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
      for (const chunk of this.chunks.values()) {
        if (chunk.cell === cell && chunk.visible) (chunk.distant ? far : near).push(...chunk.objects);
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
    this.dirty.clear();
  }
}
