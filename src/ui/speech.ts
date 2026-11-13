import './hud.css';
import './componentes.css';
import { drawPortrait, type Mood, type PortraitSpec } from './pixel';
import { el } from './kpis';

/** Personagem com nome (Dona Rita, Bia, Seu Osvaldo, Tuco…). */
export interface Speaker {
  id: string;
  name: string;
  /** Linha curta abaixo do nome ("68 · cadeira motorizada"). */
  role?: string;
  portrait: PortraitSpec;
  /** Cor do gel do balão. */
  tone?: 'aqua' | 'lime' | 'rosa';
}

/** Uma fala ancorada a um ponto da tela (em px, coordenadas da janela). */
export interface SpeechLine {
  speaker: Speaker;
  text: string;
  x: number;
  y: number;
  mood?: Mood;
  /** Tempo na tela em ms. 0 = fica até `dismiss` ou clique. Padrão: 5 s + 40 ms por letra. */
  durationMs?: number;
}

export interface SpeechQueueOptions {
  /** Balões visíveis ao mesmo tempo; o resto espera na fila. */
  maxVisible?: number;
  /** Margem em px até a borda da janela (no topo, deixe espaço para a barra do HUD). */
  margin?: number;
  marginTop?: number;
}

const TAIL = 14; // altura mínima do bico
const GAP = 8;

interface Rect { left: number; top: number; w: number; h: number }

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.w + GAP && b.left < a.left + a.w + GAP && a.top < b.top + b.h + GAP && b.top < a.top + a.h + GAP;

/** Um balão de fala com retrato pixelado (32×32 ampliado ×3), nome e texto. */
export class SpeechBubble {
  readonly el: HTMLElement;
  readonly tail: HTMLElement;
  readonly line: SpeechLine;

  constructor(line: SpeechLine) {
    this.line = line;
    const s = line.speaker;
    const portrait = drawPortrait(s.portrait, line.mood ?? 'normal', 3);
    portrait.className = 'fala-retrato';
    const body = el('span', 'fala-corpo', undefined,
      el('span', 'fala-moldura', undefined, portrait),
      el('span', 'fala-texto', undefined,
        el('span', 'fala-nome', s.name),
        s.role ? el('span', 'fala-papel', s.role) : null,
        el('span', 'fala-frase', line.text)));
    this.el = el('div', `gel fala ${s.tone ?? ''}`, undefined, body);
    this.el.setAttribute('role', 'status');
    this.tail = el('div', `fala-ponta ${s.tone ?? ''}`, undefined, el('div', 'fala-bico'), el('div', 'fala-haste'), el('div', 'fala-alvo'));
  }

  get width() { return this.el.offsetWidth; }
  get height() { return this.el.offsetHeight; }

  /** Posiciona o balão e o bico (que liga o balão ao ponto âncora). */
  place(r: Rect, ax: number, ay: number) {
    this.el.style.left = `${Math.round(r.left)}px`;
    this.el.style.top = `${Math.round(r.top)}px`;
    const above = r.top + r.h <= ay;
    const tx = Math.round(Math.min(Math.max(ax, r.left + 14), r.left + r.w - 14));
    const y0 = above ? r.top + r.h - 2 : ay;
    const y1 = above ? ay : r.top + 2;
    this.tail.classList.toggle('abaixo', !above);
    this.tail.style.left = `${tx - 9}px`;
    this.tail.style.top = `${Math.round(y0)}px`;
    this.tail.style.height = `${Math.max(TAIL, Math.round(y1 - y0))}px`;
    this.tail.style.setProperty('--desvio', `${Math.round(ax - tx)}px`);
  }
}

interface Active { id: number; bubble: SpeechBubble; timer?: number }

/**
 * Fila de balões: mostra até `maxVisible` ao mesmo tempo, sem sobreposição
 * (o balão mais novo sobe acima dos que já estão na tela), e chama o próximo
 * quando um sai.
 */
export class SpeechQueue {
  readonly root: HTMLElement;
  /** Chamado quando um balão sai da tela (tempo, clique ou `dismiss`). */
  onDismiss?: (id: number) => void;
  private active: Active[] = [];
  private pending: { id: number; line: SpeechLine }[] = [];
  private nextId = 1;
  private readonly max: number;
  private readonly margin: number;
  private readonly marginTop: number;

  constructor(parent: HTMLElement = document.body, opts: SpeechQueueOptions = {}) {
    this.max = opts.maxVisible ?? 3;
    this.margin = opts.margin ?? 10;
    this.marginTop = opts.marginTop ?? 64;
    this.root = el('div', 'pz-ui fala-camada');
    parent.appendChild(this.root);
    window.addEventListener('resize', () => this.layout());
  }

  /** Enfileira uma fala e devolve o id (para `move`/`dismiss`). */
  say(line: SpeechLine): number {
    const id = this.nextId++;
    if (this.active.length < this.max) this.show(id, line);
    else this.pending.push({ id, line });
    return id;
  }

  /** Atualiza o ponto âncora (ex.: o personagem andou ou a câmera mexeu). */
  move(id: number, x: number, y: number) {
    const a = this.active.find((b) => b.id === id);
    if (a) { a.bubble.line.x = x; a.bubble.line.y = y; this.layout(); return; }
    const p = this.pending.find((b) => b.id === id);
    if (p) { p.line.x = x; p.line.y = y; }
  }

  dismiss(id: number) {
    const i = this.active.findIndex((b) => b.id === id);
    if (i < 0) {
      this.pending = this.pending.filter((p) => p.id !== id);
      return;
    }
    const [a] = this.active.splice(i, 1);
    if (!a) return;
    if (a.timer !== undefined) clearTimeout(a.timer);
    a.bubble.el.remove();
    a.bubble.tail.remove();
    this.onDismiss?.(id);
    const next = this.pending.shift();
    if (next) this.show(next.id, next.line);
    this.layout();
  }

  clear() {
    this.pending = [];
    for (const a of [...this.active]) this.dismiss(a.id);
  }

  get visibleCount() { return this.active.length; }
  get queuedCount() { return this.pending.length; }

  private show(id: number, line: SpeechLine) {
    const bubble = new SpeechBubble(line);
    this.root.append(bubble.tail, bubble.el);
    bubble.el.addEventListener('click', () => this.dismiss(id));
    const ms = line.durationMs ?? 5000 + line.text.length * 40;
    const a: Active = { id, bubble };
    if (ms > 0) a.timer = window.setTimeout(() => this.dismiss(id), ms);
    this.active.push(a);
    this.layout();
  }

  /** Recalcula as posições: balão acima do ponto, empurrado para cima até não sobrepor. */
  layout() {
    const vw = window.innerWidth, vh = window.innerHeight, m = this.margin;
    const placed: Rect[] = [];
    for (const { bubble } of this.active) {
      const { x, y } = bubble.line;
      const w = bubble.width, h = bubble.height;
      const left = Math.min(Math.max(x - 34, m), vw - w - m);
      let r: Rect = { left, top: y - TAIL - h, w, h };
      // sobe até achar espaço livre
      for (let guard = 0; guard < 8; guard++) {
        const hit = placed.find((p) => overlaps(p, r));
        if (!hit) break;
        r = { ...r, top: hit.top - h - GAP };
      }
      // sem espaço no topo: tenta abaixo do ponto
      if (r.top < this.marginTop) {
        r = { ...r, top: y + TAIL };
        for (let guard = 0; guard < 8; guard++) {
          const hit = placed.find((p) => overlaps(p, r));
          if (!hit) break;
          r = { ...r, top: hit.top + hit.h + GAP };
        }
        r.top = Math.min(r.top, vh - h - m);
      }
      placed.push(r);
      bubble.place(r, x, y);
    }
  }
}
