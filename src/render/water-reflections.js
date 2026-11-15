import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// One nearby lake level, shared reflection target, capped at eight updates/s.
export class WaterReflections {
  constructor(material) {
    this.material = material;
    this.reflector = new Reflector(new T.PlaneGeometry(1, 1), {
      textureWidth: 384, textureHeight: 384, multisample: 0, clipBias: .002
    });
    this.reflector.rotation.x = -Math.PI / 2;
    this.inverse = new T.Matrix4();
    this.sky = new T.Color('#9cb9bd');
    material.uniforms.lakeReflection.value = this.reflector.getRenderTarget().texture;
    this.nextUpdate = 0;
  }

  update(renderer, scene, camera, world, focus, now) {
    if (now < this.nextUpdate) return;
    this.nextUpdate = now + 125;
    let level, best = Infinity;
    const radius = Math.min(64, focus.span);
    for (let dz = -radius; dz <= radius; dz += 8) for (let dx = -radius; dx <= radius; dx += 8) {
      const x = Math.round(focus.x + dx), z = Math.round(focus.z + dz);
      if (x < 0 || z < 0 || x >= world.stride || z >= world.stride) continue;
      const i = z * world.stride + x, distance = dx * dx + dz * dz;
      if (world.waterKind.at(i) !== 2 || world.wet.at(i) <= 0 || distance >= best) continue;
      level = world.surface.at(i); best = distance;
    }
    const uniforms = this.material.uniforms;
    uniforms.reflectionReady.value = 0;
    if (level === undefined || camera.position.y <= level) return;
    this.reflector.position.y = level + .012;
    this.reflector.updateMatrixWorld();
    scene.updateMatrixWorld();
    const hidden = [];
    scene.traverse(object => {
      if (object.material === this.material && object.visible) { hidden.push(object); object.visible = false; }
    });
    const shadowUpdate = renderer.shadowMap.needsUpdate;
    const background = scene.background;
    scene.background = this.sky;
    renderer.shadowMap.needsUpdate = false;
    try {
      this.reflector.onBeforeRender(renderer, scene, camera);
      this.inverse.copy(this.reflector.matrixWorld).invert();
      uniforms.reflectionMatrix.value.copy(this.reflector.material.uniforms.textureMatrix.value).multiply(this.inverse);
      uniforms.reflectionLevel.value = level + .012;
      uniforms.reflectionReady.value = 1;
    } finally {
      hidden.forEach(object => { object.visible = true; });
      scene.background = background;
      renderer.shadowMap.needsUpdate = shadowUpdate;
    }
  }

  dispose() { this.reflector.geometry.dispose(); this.reflector.dispose(); }
}
