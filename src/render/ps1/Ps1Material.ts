import { Color, DoubleSide, FrontSide, ShaderMaterial, Vector2, type Texture } from 'three';
import { WORLD } from '../palette';
import { TILE_UV } from '../textures/Atlas';

/**
 * Material único PS1 (SPEC §7.4): textura do atlas sem filtro, cor de vértice com luz baked,
 * vertex snapping, affine warping, névoa curta e reflexo Aero falso para vidro/cromo.
 *
 * Atributos esperados na geometria (gerados por MeshBuilder):
 *   color (vec3)  cor baked;  uv  UV local que repete;  aTile (vec2) canto do tile no atlas;
 *   aTint (float) 0 = fixo, 1 = cor do veículo, 2 = cor da roupa, 3 = cor da pele;
 *   aGloss (float) 0..1 intensidade do reflexo Aero.
 * Instâncias (PS1_INSTANCED): instanceColor (veículo), iColor2 (roupa), iColor3 (pele).
 */

/** Uniforms compartilhados por todos os materiais: os toggles mudam tudo de uma vez. */
export const ps1Shared = {
  uSnapRes: { value: new Vector2(320, 240) },
  uJitter: { value: 1.0 },
  uAffine: { value: 0.6 },
  uFogColor: { value: new Color(WORLD.ceu_horizonte) },
  uFogNear: { value: 18 },
  uFogFar: { value: 42 },
  uTime: { value: 0 },
  uDesat: { value: 0 },
  uSkyTop: { value: new Color(WORLD.ceu_topo) },
  uSkyHorizon: { value: new Color(WORLD.ceu_horizonte) },
};

const vertex = /* glsl */ `
attribute vec2 aTile;
attribute float aTint;
attribute float aGloss;
#ifdef PS1_INSTANCED
attribute vec3 iColor2;
attribute vec3 iColor3;
#endif
uniform vec2 uSnapRes;
uniform float uJitter;
uniform float uTime;
uniform vec2 uScroll;
varying vec2 vUvA;
varying float vW;
varying vec2 vUvP;
varying vec2 vTile;
varying vec3 vColor;
varying float vFogDepth;
varying float vGloss;
varying vec3 vViewN;
varying float vTinted;

void main() {
  vec3 tint = vec3(1.0);
#ifdef PS1_INSTANCED
  #ifdef USE_INSTANCING_COLOR
  if (aTint > 0.5 && aTint < 1.5) tint = instanceColor;
  #endif
  if (aTint > 1.5 && aTint < 2.5) tint = iColor2;
  if (aTint > 2.5) tint = iColor3;
#endif
  vColor = color * tint;
  vTinted = step(0.5, aTint) * (1.0 - step(2.5, aTint));

  vec4 local = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  local = instanceMatrix * local;
  n = mat3(instanceMatrix) * n;
#endif
  vec4 mv = modelViewMatrix * local;
  vec4 clip = projectionMatrix * mv;

  // Vertex snapping: arredonda a posição na grade de pixels da resolução interna.
  if (uJitter > 0.001) {
    vec2 grid = uSnapRes * 0.5 / uJitter;
    vec3 ndc = clip.xyz / clip.w;
    ndc.xy = floor(ndc.xy * grid + 0.5) / grid;
    clip.xyz = ndc * clip.w;
  }
  gl_Position = clip;

  vec2 uvv = uv + uScroll * uTime;
  vW = clip.w;
  vUvA = uvv * clip.w;   // affine: interpolado "errado" de propósito
  vUvP = uvv;
  vTile = aTile;
  vFogDepth = -mv.z;
  vGloss = aGloss;
  vViewN = normalize(normalMatrix * n);
}
`;

const fragment = /* glsl */ `
uniform sampler2D map;
uniform float uAffine;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uDesat;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uOpacity;
varying vec2 vUvA;
varying float vW;
varying vec2 vUvP;
varying vec2 vTile;
varying vec3 vColor;
varying float vFogDepth;
varying float vGloss;
varying vec3 vViewN;
varying float vTinted;

void main() {
  vec2 uv = mix(vUvP, vUvA / vW, uAffine);
  vec2 tuv = vTile + fract(uv) * ${(TILE_UV * 0.996).toFixed(4)} + ${(TILE_UV * 0.002).toFixed(4)};
  vec4 tex = texture2D(map, tuv);
  vec3 col = tex.rgb * vColor;

  // Reflexo Aero falso: gradiente do céu pela normal + faixa de brilho "botão do XP".
  if (vGloss > 0.0) {
    vec3 n = normalize(vViewN);
    float t = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 env = mix(uSkyHorizon, uSkyTop, t);
    float band = smoothstep(0.62, 0.66, t) * (1.0 - smoothstep(0.78, 0.82, t));
    col = mix(col, col * 0.45 + env * 0.65, vGloss * 0.7) + band * vGloss * 0.45;
  }

  // Overlays ligados: veículos perdem saturação para os dados ficarem legíveis.
  if (uDesat > 0.0 && vTinted > 0.5) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(l * 0.7 + 0.2), uDesat);
  }

#ifndef PS1_NO_FOG
  float f = smoothstep(uFogNear, uFogFar, vFogDepth);
  col = mix(col, uFogColor, f);
#endif
  gl_FragColor = vec4(col, uOpacity * tex.a);
}
`;

export interface Ps1MaterialOptions {
  map: Texture;
  instanced?: boolean;
  scroll?: [number, number];
  opacity?: number;
  doubleSide?: boolean;
  noFog?: boolean;
}

export const allPs1Materials: ShaderMaterial[] = [];

export function createPs1Material(o: Ps1MaterialOptions): ShaderMaterial {
  const transparent = (o.opacity ?? 1) < 1;
  const m = new ShaderMaterial({
    uniforms: {
      ...ps1Shared,
      map: { value: o.map },
      uScroll: { value: new Vector2(...(o.scroll ?? [0, 0])) },
      uOpacity: { value: o.opacity ?? 1 },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    vertexColors: true,
    transparent,
    depthWrite: !transparent,
    side: o.doubleSide || transparent ? DoubleSide : FrontSide,
    defines: {
      ...(o.instanced ? { PS1_INSTANCED: '' } : {}),
      ...(o.noFog ? { PS1_NO_FOG: '' } : {}),
    },
  });
  allPs1Materials.push(m);
  return m;
}

export function setWireframe(on: boolean) {
  for (const m of allPs1Materials) m.wireframe = on;
}
