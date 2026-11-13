import {
  BufferGeometry, Float32BufferAttribute, Mesh, NearestFilter, OrthographicCamera, Scene, ShaderMaterial,
  Vector2, type Texture,
} from 'three';

/**
 * Pós-processo (SPEC §7.10): amplia a imagem de baixa resolução com nearest,
 * aplica dither Bayer 4×4 e quantiza para 15 bits (5-5-5), como no PS1.
 */
export class PostFx {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly material: ShaderMaterial;

  constructor(source: Texture) {
    source.magFilter = NearestFilter;
    source.minFilter = NearestFilter;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.material = new ShaderMaterial({
      uniforms: {
        tScene: { value: source },
        uLowRes: { value: new Vector2(320, 240) },
        uDither: { value: 1 },
        uQuant: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform vec2 uLowRes;
        uniform float uDither;
        uniform float uQuant;
        varying vec2 vUv;
        float b2(vec2 p) {
          p = floor(mod(p, 2.0));
          return p.x < 0.5 ? (p.y < 0.5 ? 0.0 : 3.0) : (p.y < 0.5 ? 2.0 : 1.0);
        }
        float bayer4(vec2 p) { return (4.0 * b2(p) + b2(floor(p / 2.0))) / 16.0; }
        void main() {
          vec3 c = texture2D(tScene, vUv).rgb;
          if (uQuant > 0.5) {
            vec2 px = floor(vUv * uLowRes);
            float d = (bayer4(px) - 0.5) * uDither;
            c = floor((c + d / 31.0) * 31.0 + 0.5) / 31.0;
          }
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(geo, this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }
}
