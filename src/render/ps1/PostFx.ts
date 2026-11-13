import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uLowRes;
  uniform float uDither;
  varying vec2 vUv;

  const float BAYER[16] = float[16](
     0.,  8.,  2., 10.,
    12.,  4., 14.,  6.,
     3., 11.,  1.,  9.,
    15.,  7., 13.,  5.);

  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    if (uDither > 0.5) {
      // Índice Bayer calculado no pixel LOW-RES, não no pixel da tela.
      vec2 p = floor(vUv * uLowRes);
      int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
      float d = BAYER[i] / 16.0 - 0.5;
      c = floor((c + d / 32.0) * 31.0 + 0.5) / 31.0;   // 5 bits por canal (15-bit)
    }
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

/** Pós-processo: amplia o render target com nearest + dither Bayer 4×4 + cor 15-bit. */
export class PostFx {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly material: THREE.ShaderMaterial;

  constructor(texture: THREE.Texture) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: texture },
        uLowRes: { value: new THREE.Vector2(320, 240) },
        uDither: { value: 1 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  set texture(t: THREE.Texture) {
    this.material.uniforms.tDiffuse!.value = t;
  }

  set lowRes(v: THREE.Vector2) {
    (this.material.uniforms.uLowRes!.value as THREE.Vector2).copy(v);
  }

  get dither(): boolean {
    return this.material.uniforms.uDither!.value > 0.5;
  }

  set dither(on: boolean) {
    this.material.uniforms.uDither!.value = on ? 1 : 0;
  }
}
