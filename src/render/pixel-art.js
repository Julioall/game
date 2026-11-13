import * as T from 'three';

/** Shared pixel grid and color steps for every object in the world. */
export class PixelArtPass {
  constructor() {
    this.target = new T.WebGLRenderTarget(1, 1, {
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
      depthBuffer: true
    });
    this.target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new T.ShaderMaterial({
      uniforms: {
        source: { value: this.target.texture },
        sceneDepth: { value: this.target.depthTexture },
        texel: { value: new T.Vector2(1, 1) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 480 },
        perspective: { value: 0 }
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `varying vec2 uvPixel; void main(){uvPixel=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `uniform sampler2D source; uniform sampler2D sceneDepth;
      uniform vec2 texel; uniform float cameraNear,cameraFar,perspective;
      varying vec2 uvPixel;
      float distanceAt(vec2 uv){
        float d=texture2D(sceneDepth,uv).x;
        if(perspective>.5)return cameraNear*cameraFar/(cameraFar-d*(cameraFar-cameraNear));
        return mix(cameraNear,cameraFar,d);
      }
      void main(){
        gl_FragColor=texture2D(source,uvPixel);
        #include <colorspace_fragment>
        float center=distanceAt(uvPixel);
        float gap=max(max(distanceAt(uvPixel+vec2(texel.x,0.)),distanceAt(uvPixel-vec2(texel.x,0.))),
                      max(distanceAt(uvPixel+vec2(0.,texel.y)),distanceAt(uvPixel-vec2(0.,texel.y))))-center;
        // A single colored edge on the foreground side; no black internal lines.
        float edge=smoothstep(max(.5,center*.018),max(.9,center*.03),gap);
        gl_FragColor.rgb *= 1.-edge*.32;
        float ranks[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
        ivec2 cell=ivec2(mod(gl_FragCoord.xy,4.));
        float threshold=(ranks[cell.y*4+cell.x]+.5)/16.-.5;
        vec3 levels=vec3(23.,27.,23.);
        gl_FragColor.rgb=clamp(floor(gl_FragColor.rgb*levels+.5+threshold*.12)/levels,0.,1.);
      }`
    });
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.quad);
  }
  resize(width, height) {
    this.target.setSize(width, height);
    this.material.uniforms.texel.value.set(1 / width, 1 / height);
  }
  render(renderer, scene, camera) {
    this.material.uniforms.cameraNear.value = camera.near;
    this.material.uniforms.cameraFar.value = camera.far;
    this.material.uniforms.perspective.value = camera.isPerspectiveCamera ? 1 : 0;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.target.dispose();
    this.quad.geometry.dispose();
    this.material.dispose();
  }
}
