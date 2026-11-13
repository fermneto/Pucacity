import * as THREE from 'three';

// Paleta exata: sem conversão sRGB↔linear. Precisa rodar antes de qualquer THREE.Color ser criado.
THREE.ColorManagement.enabled = false;

/**
 * Uniforms globais compartilhados por TODOS os materiais PS1.
 * Como os objetos { value } são os mesmos, mudar aqui afeta a cena inteira.
 */
export const ps1Globals = {
  /** Resolução do render target low-res (para o vertex snapping). */
  uResolution: { value: new THREE.Vector2(320, 240) },
  /** 0 = sem jitter; 1 = snap ao pixel low-res; 2+ = grade mais grossa (mais "tremido"). */
  uJitter: { value: 1 },
  /** 0 = textura correta em perspectiva; 1 = affine total (warping PS1). */
  uAffine: { value: 1 },
  uFogColor: { value: new THREE.Color(0x8c9cb0) },
  uFogNear: { value: 40 },
  uFogFar: { value: 110 },
};

const vertexShader = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uJitter;
  varying vec2 vUv;
  varying vec3 vUvAffine;   // xy = uv * w, z = w
  varying vec3 vColor;
  varying float vFogDepth;

  void main() {
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    vec4 mv = modelViewMatrix * local;
    vec4 clip = projectionMatrix * mv;

    // Vertex snapping: arredonda a posição em espaço de tela para a grade low-res.
    if (uJitter > 0.0) {
      vec2 grid = uResolution * 0.5 / uJitter;
      vec2 ndc = clip.xy / clip.w;
      ndc = floor(ndc * grid + 0.5) / grid;
      clip.xy = ndc * clip.w;
    }
    gl_Position = clip;

    vUv = uv;
    vUvAffine = vec3(uv * clip.w, clip.w);

    vColor = vec3(1.0);
    #ifdef USE_COLOR
      vColor *= color.rgb;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vColor *= instanceColor;
    #endif

    vFogDepth = -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uAffine;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying vec3 vUvAffine;
  varying vec3 vColor;
  varying float vFogDepth;

  void main() {
    // Affine warping: uv*w interpolado linearmente / w interpolado cancela a correção de perspectiva.
    vec2 uv = mix(vUv, vUvAffine.xy / vUvAffine.z, uAffine);
    vec3 col = texture2D(uMap, uv).rgb * vColor * uColor;
    float f = smoothstep(uFogNear, uFogFar, vFogDepth);
    gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  }
`;

let whiteTex: THREE.DataTexture | null = null;
function white(): THREE.DataTexture {
  if (!whiteTex) {
    whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    whiteTex.needsUpdate = true;
  }
  return whiteTex;
}

export interface Ps1MaterialOptions {
  map?: THREE.Texture;
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  side?: THREE.Side;
}

/** Material único do jogo: textura sem filtro + cor de vértice + névoa + snapping + affine. */
export function createPs1Material(opts: Ps1MaterialOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    vertexColors: opts.vertexColors ?? false,
    side: opts.side ?? THREE.FrontSide,
    uniforms: {
      ...ps1Globals,
      uMap: { value: opts.map ?? white() },
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
    },
  });
}
