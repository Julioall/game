import * as T from 'three';

export function travelerModel() {
  const actor = new T.Group();
  const cube = new T.BoxGeometry(1, 1, 1);
  const coat = new T.MeshStandardMaterial({ color: '#a64b32', roughness: 1 });
  const skin = new T.MeshStandardMaterial({ color: '#dca976', roughness: 1 });
  const boots = new T.MeshStandardMaterial({ color: '#40302a', roughness: 1 });
  function part(material, x, y, width, height, depth) {
    const mesh = new T.Mesh(cube, material);
    mesh.position.set(x, y, 0);
    mesh.scale.set(width, height, depth);
    actor.add(mesh);
  }
  part(boots, -.12, .32, .20, .64, .28);
  part(boots, .12, .32, .20, .64, .28);
  part(coat, 0, .97, .54, .68, .34);
  part(skin, 0, 1.47, .33, .34, .32);
  part(boots, 0, 1.66, .38, .13, .37);
  actor.visible = false;
  actor.userData.dispose = () => {
    cube.dispose();
    for (const material of [coat, skin, boots]) material.dispose();
  };
  return actor;
}
