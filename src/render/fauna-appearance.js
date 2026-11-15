// Screen-door arrival avoids transparent sorting and keeps normal depth testing.
// Materials belong to the animal and are disposed by its existing lifecycle.
export function animalArrival(object) {
  const arrival = { value: 0 };
  const materials = new Set();
  object.traverse?.(part => {
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      const compile = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey?.();
      material.onBeforeCompile = function(shader, renderer) {
        compile?.call(this, shader, renderer);
        shader.uniforms.faunaArrival = arrival;
        shader.fragmentShader = 'uniform float faunaArrival;\n' + shader.fragmentShader.replace(
          /void\s+main\s*\(\s*\)\s*\{/,
          `$&
          if (faunaArrival < 1.) {
            vec2 cell = mod(floor(gl_FragCoord.xy), 4.);
            float rank = mod(cell.x, 2.) * 8. + mod(cell.y, 2.) * 12.;
            rank = mod(rank, 16.) + floor(cell.x / 2.) * 2. + floor(cell.y / 2.) * 3.;
            if ((mod(rank, 16.) + .5) / 16. > faunaArrival) discard;
          }`);
      };
      material.customProgramCacheKey = () => (cacheKey ?? '') + ':fauna-arrival-v1';
      material.needsUpdate = true;
    }
  });
  return arrival;
}
