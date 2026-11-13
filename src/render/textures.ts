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

export function grassTexture(): THREE.DataTexture {
  return makeTexture(32, (_x, _y, rng) => {
    const r = rng.next();
    if (r < 0.06) return [96, 120, 64];
    return noise([70, 98, 56], 20, rng);
  }, 3);
}

export function plainTexture(): THREE.DataTexture {
  return makeTexture(8, (_x, _y, rng) => noise([200, 200, 200], 24, rng), 11);
}
