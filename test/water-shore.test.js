import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { swashGeometry } from '../src/render/water-geometry.js';
import { WaterReflections } from '../src/render/water-reflections.js';

function world(kind = 2) {
  const stride = 33, n = stride ** 2;
  return { stride, config: { size: 32 }, ground: new Float32Array(n).fill(.1),
    wet: new Float32Array(n).fill(1), surface: new Float32Array(n).fill(2),
    waterKind: new Uint8Array(n).fill(kind), beachDistance: new Uint8Array(n).fill(255) };
}

test('swash is confined to low coastal sand and does not mutate physical terrain', () => {
  const w = world();
  assert.equal(swashGeometry(w, 0, 0), null);
  w.beachDistance.fill(2);
  const before = w.ground.slice(), geometry = swashGeometry(w, 0, 0);
  assert.ok(geometry.attributes.position.count > 0);
  assert.ok(Array.from(geometry.attributes.shoreFilm.array).every(v => v === 1));
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    assert.ok(Math.abs(geometry.attributes.position.getY(i) - .118) < 1e-6);
  }
  assert.deepEqual(w.ground, before);
  geometry.dispose();
  w.ground.fill(1.5);
  assert.equal(swashGeometry(w, 0, 0), null, 'no swash climbing steep/high banks');
});

function reflectionFixture() {
  const uniforms = { lakeReflection: {}, reflectionMatrix: { value: new T.Matrix4() },
    reflectionReady: { value: 0 }, reflectionLevel: { value: 0 } };
  const material = new T.ShaderMaterial({ uniforms });
  const reflection = new WaterReflections(material), scene = new T.Scene();
  const mesh = new T.Mesh(new T.PlaneGeometry(1,1), material);
  scene.add(mesh);
  const camera = new T.OrthographicCamera(-10,10,10,-10,.1,100);
  camera.position.y = 10; camera.updateMatrixWorld();
  const renderer = { shadowMap: { needsUpdate: true } };
  const focus = { x: 16, z: 16, span: 20 };
  return { material, reflection, scene, mesh, camera, renderer, focus };
}

test('lake reflection hides water from its own pass, restores state and throttles updates', () => {
  const f = reflectionFixture();
  let calls = 0;
  f.reflection.reflector.onBeforeRender = () => {
    calls++;
    assert.equal(f.mesh.visible, false);
    assert.equal(f.renderer.shadowMap.needsUpdate, false);
  };
  const run = (w, now) => f.reflection.update(f.renderer, f.scene, f.camera, w, f.focus, now);
  run(world(), 0);
  assert.equal(f.material.uniforms.reflectionReady.value, 1);
  assert.equal(f.material.uniforms.reflectionLevel.value, 2.012);
  assert.equal(f.mesh.visible, true);
  assert.equal(f.renderer.shadowMap.needsUpdate, true);
  run(world(), 50); assert.equal(calls, 1);
  run(world(), 125); assert.equal(calls, 2);
  run(world(1), 250);
  assert.equal(calls, 2, 'sea does not select a lake reflection plane');
  assert.equal(f.material.uniforms.reflectionReady.value, 0);
  f.reflection.dispose(); f.mesh.geometry.dispose(); f.material.dispose();
});

test('reflection failures restore water visibility and pending shadow updates', () => {
  const f = reflectionFixture();
  f.reflection.reflector.onBeforeRender = () => { throw new Error('render failure'); };
  assert.throws(() => f.reflection.update(f.renderer, f.scene, f.camera, world(), f.focus, 0), /render failure/);
  assert.equal(f.mesh.visible, true);
  assert.equal(f.renderer.shadowMap.needsUpdate, true);
  f.reflection.dispose(); f.mesh.geometry.dispose(); f.material.dispose();
});
