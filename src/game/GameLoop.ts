/**
 * Relógio do jogo com PASSO FIXO e acumulador (docs/engineering.md §0):
 * 1 tick = 1 minuto de jogo; a velocidade só muda quantos ticks cabem em cada segundo real.
 * Sem DOM e sem three: dá para testar e reaproveitar num Web Worker.
 */

/** Velocidades do SPEC §8: pausa (0), 1×, 2×, 4× (teclas Espaço, 1, 2, 3). */
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface GameLoopOptions {
  /** Ticks por segundo real em 1× (padrão 1: um dia de jogo = 24 min reais). */
  ticksPerSecond: number;
  /** Teto de ticks por quadro, para não travar depois de uma aba em segundo plano. */
  maxTicksPerFrame: number;
}

export class GameLoop {
  speed: Speed = 1;
  paused = false;
  /** Fração [0, 1) do próximo tick já "vencida": use para interpolar o desenho. */
  alpha = 0;
  private acc = 0;
  /** Total de ticks executados por este loop. */
  ticks = 0;

  constructor(
    private readonly tick: () => void,
    readonly opts: GameLoopOptions = { ticksPerSecond: 1, maxTicksPerFrame: 32 },
  ) {}

  togglePause(): void {
    this.paused = !this.paused;
  }

  setSpeed(s: Speed): void {
    this.speed = s;
    this.paused = false;
  }

  /** Avança o relógio em `dtSeconds` reais; devolve quantos ticks rodaram. */
  advance(dtSeconds: number): number {
    if (this.paused || dtSeconds <= 0) return 0;
    this.acc += dtSeconds * this.opts.ticksPerSecond * this.speed;
    let n = 0;
    while (this.acc >= 1 && n < this.opts.maxTicksPerFrame) {
      this.tick();
      this.acc -= 1;
      n++;
    }
    if (this.acc >= 1) this.acc = 0.999; // descarta o atraso acumulado em vez de "espiral da morte"
    this.ticks += n;
    this.alpha = this.acc;
    return n;
  }
}
