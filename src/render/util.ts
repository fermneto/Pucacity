/** Utilidades determinísticas (a simulação e as capturas precisam ser reproduzíveis por seed). */

export type Rng = () => number;

/** Gerador mulberry32: rápido, determinístico, suficiente para visual. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick: lista vazia');
  return item;
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rng() * total;
  for (const i of items) {
    r -= weight(i);
    if (r <= 0) return i;
  }
  const last = items[items.length - 1];
  if (last === undefined) throw new Error('pickWeighted: lista vazia');
  return last;
}

/** Parâmetros de URL usados pelo jogo e pelo script de capturas. */
export const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
export function numParam(name: string, fallback: number): number {
  const v = params.get(name);
  return v === null || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v);
}

/** 1 tile = 1 unidade do mundo = 10 metros (contrato em src/core/types.ts). */
export const TILE_M = 10;
/** Cidadãos e veículos são exagerados para a câmera aérea (legibilidade). */
export const AGENT_SCALE = 2.0;
