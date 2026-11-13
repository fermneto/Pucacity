/**
 * PRNG determinístico (mulberry32). Toda aleatoriedade de core/ passa por aqui —
 * nunca use Math.random na simulação.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Float em [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [min, max] (inclusivo). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float em [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** true com probabilidade p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Distribuição triangular simétrica em [min, max] (soma de dois uniformes). */
  triangular(min: number, max: number): number {
    return min + ((this.next() + this.next()) / 2) * (max - min);
  }

  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error('Rng.pick: lista vazia');
    return list[Math.floor(this.next() * list.length)] as T;
  }

  /** Índice sorteado proporcionalmente aos pesos (pesos ≤ 0 nunca saem). -1 se todos forem ≤ 0. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) if (w > 0) total += w;
    if (total <= 0) return -1;
    let r = this.next() * total;
    let last = -1;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i]!;
      if (w <= 0) continue;
      last = i;
      if (r < w) return i;
      r -= w;
    }
    return last;
  }

  /** Estado atual (para save/load). */
  get state(): number {
    return this.s;
  }

  set state(v: number) {
    this.s = v >>> 0;
  }
}
