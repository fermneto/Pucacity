import './hud.css';
import './componentes.css';
import { icon } from './pixel';
import { el } from './kpis';

/** Uma notícia da Rádio Pucacity. */
export interface RadioNews {
  text: string;
  /** Quando o evento acontece ("Amanhã · 17h"); aparece num selo amarelo-grip. */
  when?: string;
  /** `alerta` pisca o selo em vermelho; `evento` é o padrão. */
  kind?: 'evento' | 'alerta' | 'info';
  /** Tempo da notícia no ar em ms (padrão: 8 s, mais o tempo de rolar se não couber). */
  durationMs?: number;
}

/**
 * Faixa "Rádio Pucacity": anuncia eventos com antecedência, uma notícia por vez.
 * Texto longo rola como letreiro; a última notícia fica no ar até chegar outra.
 */
export class RadioTicker {
  readonly root: HTMLElement;
  /** Chamado quando uma notícia termina o tempo no ar. */
  onEnd?: (n: RadioNews) => void;
  private queue: RadioNews[] = [];
  private current: RadioNews | null = null;
  private timer?: number;
  private readonly when: HTMLElement;
  private readonly win: HTMLElement;
  private readonly text: HTMLElement;

  constructor(parent: HTMLElement = document.body) {
    this.when = el('span', 'radio-quando');
    this.text = el('span', 'radio-texto');
    this.win = el('span', 'radio-janela', undefined, this.text);
    const bars = el('span', 'radio-barras', undefined, el('i'), el('i'), el('i'), el('i'));
    this.root = el('div', 'pz-ui gel dark radio', undefined,
      el('span', 'radio-corpo', undefined,
        el('span', 'radio-marca', undefined, icon('onda', '#3fd0e8', 2), bars,
          el('span', 'radio-nome', undefined, el('b', '', 'RÁDIO PUCACITY'), el('small', '', 'FM 88.5'))),
        this.when,
        this.win));
    this.root.setAttribute('role', 'log');
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  /** Enfileira uma notícia (vai ao ar já, se nada estiver tocando). */
  announce(n: RadioNews) {
    this.queue.push(n);
    if (!this.timer) this.next();
  }

  /** Tira tudo do ar. */
  clear() {
    this.queue = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.current = null;
    this.root.hidden = true;
  }

  setVisible(on: boolean) {
    this.root.hidden = !on || !this.current;
  }

  get nowPlaying(): RadioNews | null { return this.current; }
  get queued(): number { return this.queue.length; }

  private next() {
    const n = this.queue.shift();
    this.timer = undefined;
    if (!n) return; // a última notícia continua no ar
    this.current = n;
    this.root.hidden = false;
    this.root.dataset.kind = n.kind ?? 'evento';
    this.when.textContent = n.when ?? '';
    this.when.hidden = !n.when;
    this.text.textContent = n.text;
    // reinicia a animação de entrada
    this.root.classList.remove('nova');
    void this.root.offsetWidth;
    this.root.classList.add('nova');
    // letreiro só se o texto não couber
    this.text.classList.remove('rolando');
    const over = this.text.scrollWidth - this.win.clientWidth;
    let roll = 0;
    if (over > 4) {
      // 18% parado no começo, 64% rolando a ~40 px/s, 18% parado no fim
      roll = Math.max(5000, Math.round((over / 40) * 1000 / 0.64));
      this.text.style.setProperty('--ate', `${-over - 8}px`);
      this.text.style.setProperty('--dur', `${roll}ms`);
      this.text.classList.add('rolando');
    }
    const ms = n.durationMs ?? 8000 + roll;
    this.timer = window.setTimeout(() => {
      this.onEnd?.(n);
      this.next();
    }, ms);
  }
}
