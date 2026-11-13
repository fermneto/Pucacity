import './hud.css';
import './componentes.css';
import { drawPortrait, icon, type Mood } from './pixel';
import { KPI_META, el, type UiKpiId } from './kpis';
import type { Speaker } from './speech';

/** Efeito previsto de uma opção sobre um KPI. */
export interface DilemmaEffect {
  kpi: UiKpiId;
  /** Intensidade e direção: −2 (↓↓) … +2 (↑↑); 0 = estável. */
  delta: -2 | -1 | 0 | 1 | 2;
  /** Texto opcional no lugar do rótulo padrão do KPI. */
  label?: string;
}

export interface DilemmaOption {
  id: string;
  title: string;
  description: string;
  /** Custo em $ (0 = grátis; negativo = economiza/entra dinheiro). */
  cost: number;
  /** Observação de custo não monetário ("fiscalização", "Osvaldo perde clientes"). */
  costNote?: string;
  effects: DilemmaEffect[];
}

export interface DilemmaData {
  id: string;
  /** Selo do topo, ex.: "Dia 9". */
  tag?: string;
  title: string;
  context: string;
  /** Quem está pedindo o quê (retratos pequenos acima do contexto). */
  voices?: { speaker: Speaker; mood?: Mood; says: string }[];
  /** 2 ou 3 opções; os atalhos 1–3 seguem a ordem. */
  options: DilemmaOption[];
}

/** O que o callback recebe: a opção escolhida, ou `null` se fechou com Esc. */
export type DilemmaChoice = { id: string; index: number } | null;

const TONES = ['', 'lime', 'rosa'];

/**
 * Cartão modal de dilema em gel. Escolha por clique ou teclado (1, 2, 3; Esc fecha
 * sem decidir, se `allowEscape`).
 */
export class DilemmaCard {
  readonly root: HTMLElement;
  private onChoose?: (c: DilemmaChoice) => void;
  private data?: DilemmaData;
  private allowEscape = true;
  private buttons: HTMLButtonElement[] = [];
  private readonly keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(parent: HTMLElement = document.body) {
    this.root = el('div', 'pz-ui pz-modal dilema-fundo');
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  get isOpen() { return !this.root.hidden; }

  open(data: DilemmaData, onChoose: (c: DilemmaChoice) => void, opts: { allowEscape?: boolean } = {}) {
    this.data = data;
    this.onChoose = onChoose;
    this.allowEscape = opts.allowEscape ?? true;
    this.root.replaceChildren(this.build(data));
    this.root.hidden = false;
    window.addEventListener('keydown', this.keyHandler);
    this.buttons[0]?.focus({ preventScroll: true });
  }

  close() {
    this.root.hidden = true;
    this.root.replaceChildren();
    this.buttons = [];
    window.removeEventListener('keydown', this.keyHandler);
  }

  private choose(index: number | null) {
    const cb = this.onChoose;
    const opt = index === null ? undefined : this.data?.options[index];
    if (index !== null && !opt) return;
    if (opt && index !== null) {
      const b = this.buttons[index];
      b?.classList.add('escolhida');
    }
    this.onChoose = undefined;
    // pequena pausa para o "clique" do gel aparecer antes de fechar
    window.setTimeout(() => {
      this.close();
      cb?.(opt && index !== null ? { id: opt.id, index } : null);
    }, opt ? 140 : 0);
  }

  private onKey(e: KeyboardEvent) {
    if (!this.isOpen || !this.onChoose) return;
    if (e.key === 'Escape' && this.allowEscape) {
      e.preventDefault();
      this.choose(null);
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= (this.data?.options.length ?? 0)) {
      e.preventDefault();
      this.choose(n - 1);
    }
  }

  private build(d: DilemmaData): HTMLElement {
    const head = el('div', 'dilema-topo', undefined,
      d.tag ? el('span', 'pz-selo', d.tag) : null,
      el('span', 'pz-selo rosa', 'Dilema'),
    );
    const voices = d.voices?.length
      ? el('div', 'dilema-vozes', undefined, ...d.voices.map((v) => {
        const c = drawPortrait(v.speaker.portrait, v.mood ?? 'normal', 2);
        c.className = 'dilema-mini';
        return el('div', 'dilema-voz', undefined, el('span', 'fala-moldura mini', undefined, c),
          el('div', '', undefined, el('b', '', v.speaker.name), el('span', '', ` “${v.says}”`)));
      }))
      : null;

    this.buttons = d.options.map((o, i) => {
      const costTxt = o.cost === 0 ? 'Grátis' : o.cost < 0 ? `+$ ${Math.abs(o.cost).toLocaleString('pt-BR')}` : `−$ ${o.cost.toLocaleString('pt-BR')}`;
      const effects = el('span', 'dilema-efeitos', undefined, ...o.effects.map((ef) => this.effect(ef)));
      const btn = el('button', `gel dilema-opcao ${TONES[i] ?? ''}`, undefined,
        el('span', 'dilema-opcao-corpo', undefined,
          el('span', 'dilema-tecla', String(i + 1)),
          el('span', 'dilema-opcao-titulo', o.title),
          el('span', 'dilema-opcao-desc', o.description),
          effects,
          el('span', `dilema-custo ${o.cost < 0 ? 'ganho' : ''}`, undefined, icon('saldo', '#0b2a52', 2), el('b', '', costTxt),
            o.costNote ? el('small', '', ` · ${o.costNote}`) : null),
        ));
      btn.type = 'button';
      btn.setAttribute('aria-keyshortcuts', String(i + 1));
      btn.addEventListener('click', () => this.choose(i));
      return btn;
    });

    const card = el('div', 'gel dilema-cartao', undefined,
      el('div', 'pz-corpo dilema-corpo', undefined,
        head,
        el('h2', 'dilema-titulo', d.title),
        el('p', 'dilema-contexto', d.context),
        voices,
        el('div', `dilema-opcoes n${d.options.length}`, undefined, ...this.buttons),
        el('div', 'dilema-rodape', this.allowEscape
          ? `Teclas 1–${d.options.length} escolhem · Esc adia a decisão`
          : `Teclas 1–${d.options.length} escolhem`),
      ));
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', d.title);
    return card;
  }

  private effect(ef: DilemmaEffect): HTMLElement {
    const meta = KPI_META[ef.kpi];
    const good = ef.delta === 0 ? null : (ef.delta > 0) === (meta.better === 'up');
    const color = good === null ? '#4a6a8a' : good ? '#1f7a1f' : '#c41f1a';
    const arrows = ef.delta === 0 ? [icon('igual', color, 2)] : Array.from({ length: Math.abs(ef.delta) }, () => icon(ef.delta > 0 ? 'sobe' : 'desce', color, 2));
    const chip = el('span', `dilema-efeito ${good === null ? 'neutro' : good ? 'bom' : 'ruim'}`, undefined,
      icon(meta.icon, '#0b2a52', 2),
      el('span', '', ef.label ?? meta.label),
      el('span', 'setas', undefined, ...arrows));
    chip.title = `${ef.label ?? meta.label}: ${good === null ? 'estável' : good ? 'melhora' : 'piora'}`;
    return chip;
  }
}
