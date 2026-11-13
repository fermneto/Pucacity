import * as THREE from 'three';
import { Rng } from '../core/Rng';

type Rgb = [number, number, number];

/** Textura procedural pequena, sem filtro e sem mipmaps (placeholder até o atlas da Arte). */
export function makeTexture(size: number, paint: (x: number, y: number, rng: Rng) => Rgb, seed = 1): THREE.DataTexture {
  const rng = new Rng(seed);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x, y, rng);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const noise = (base: Rgb, amp: number, rng: Rng): Rgb => {
  const n = (rng.next() - 0.5) * amp;
  return [base[0] + n, base[1] + n, base[2] + n].map((v) => Math.max(0, Math.min(255, v))) as Rgb;
};

/** Asfalto 16×16: u atravessa a via (0..1), v corre ao longo dela. Faixa central tracejada e bordas. */
export function asphaltTexture(): THREE.DataTexture {
  return makeTexture(16, (x, y, rng) => {
    if (x === 0 || x === 15) return [150, 150, 140];
    if ((x === 7 || x === 8) && y < 8) return [220, 190, 60];
    return noise([62, 62, 68], 18, rng);
  }, 7);
}

/** Gramado verde-limão Aero (paleta.mundo.grama #7BD13A) com pontinhos mais claros. */
export function grassTexture(): THREE.DataTexture {
  return makeTexture(32, (_x, _y, rng) => {
    if (rng.next() < 0.05) return [160, 232, 96];
    return noise([123, 209, 58], 22, rng);
  }, 3);
}

/** Piso neutro claro, tingido pela cor de vértice (faixas, cruzamentos). */
export function plainTexture(): THREE.DataTexture {
  return makeTexture(8, (_x, _y, rng) => noise([240, 240, 240], 22, rng), 11);
}

/** Água turquesa (paleta.mundo.agua #1FB5A6) com "bolhas" claras. */
export function waterTexture(): THREE.DataTexture {
  return makeTexture(16, (x, y, rng) => {
    if ((x + y * 3) % 11 === 0 && rng.next() < 0.6) return [190, 250, 245];
    return noise([31, 181, 166], 16, rng);
  }, 5);
}

/** Céu Frutiger Aero: gradiente vertical (paleta.mundo.ceu_topo → ceu_horizonte), usado como fundo de tela. */
export function skyTexture(top: string, horizon: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, top);
  grad.addColorStop(1, horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
