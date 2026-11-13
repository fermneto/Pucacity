import './hud.css';
import './componentes.css';
import { drawPortrait, icon, type Mood } from './pixel';
import { KPI_META, el, type UiKpiId } from './kpis';
import type { Speaker } from './speech';

/** Uma linha de KPI no balanço: valor de hoje e de ontem (mesma unidade). */
export interface ReportKpi {
  kpi: UiKpiId;
  value: number;
  prev: number;
  /** Unidade exibida depois do número ("min", "%", "kWh"). */
  unit?: string;
  decimals?: number;
  /** Valor fora da meta (destaca em vermelho mesmo se melhorou). */
  alert?: boolean;
}

export interface ReportGoal {
  label: string;
  /** Quantas estrelas esta meta vale (1, 2 ou 3), como em problemas.md §5. */
  stars: 1 | 2 | 3;
  done: boolean;
  /** Progresso em texto ("−14% de 20%"). */
  progress?: string;
}

export interface DayReportData {
  day: number;
  totalDays: number;
  /** Nome da cidade/cenário ("Vila Nova"). */
  city: string;
  kpis: ReportKpi[];
  goals: ReportGoal[];
  /** Estrelas conquistadas até agora (0–3). */
  stars: 0 | 1 | 2 | 3;
  /** Receita e despesa do dia em $. */
  money?: { income: number; expenses: number };
  /** Comentários dos moradores. */
  quotes?: { speaker: Speaker; mood?: Mood; text: string }[];
  /** Texto do botão (padrão: "Próximo dia"). */
  nextLabel?: string;
}

const fmt = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Tela de balanço do dia: KPIs dos 8 problemas com setas, metas com estrelas e "Próximo dia". */
export class DayReport {
  readonly root: HTMLElement;
  private onNext?: () => void;
  private readonly keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && this.isOpen) {
      e.preventDefault();
      this.next();
    }
  };

  constructor(parent: HTMLElement = document.body) {
    this.root = el('div', 'pz-ui pz-modal balanco-fundo');
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  get isOpen() { return !this.root.hidden; }

  open(data: DayReportData, onNext: () => void) {
    this.onNext = onNext;
    this.root.replaceChildren(this.build(data));
    this.root.hidden = false;
    window.addEventListener('keydown', this.keyHandler);
    this.root.querySelector<HTMLButtonElement>('.balanco-proximo')?.focus({ preventScroll: true });
  }

  close() {
    this.root.hidden = true;
    this.root.replaceChildren();
    window.removeEventListener('keydown', this.keyHandler);
  }

  private next() {
    const cb = this.onNext;
    this.onNext = undefined;
    this.close();
    cb?.();
  }

  private build(d: DayReportData): HTMLElement {
    const starRow = el('div', 'balanco-estrelas', undefined,
      ...[1, 2, 3].map((n) => el('span', `estrela ${n <= d.stars ? 'ganha' : ''}`, undefined, icon('estrela', n <= d.stars ? '#ffe23a' : '#7f9bb8', 4))));
    starRow.setAttribute('aria-label', `${d.stars} de 3 estrelas`);

    const head = el('div', 'balanco-topo', undefined,
      el('div', '', undefined,
        el('div', 'balanco-sub', `${d.city} · Balanço do dia`),
        el('h2', 'balanco-titulo', `DIA ${d.day}`, el('small', '', ` / ${d.totalDays}`))),
      starRow);

    const kpis = el('div', 'balanco-kpis', undefined, ...d.kpis.map((k) => this.kpiRow(k)));

    const goals = el('div', 'balanco-metas', undefined,
      el('h3', '', 'Metas'),
      ...d.goals.map((g) => el('div', `balanco-meta ${g.done ? 'feita' : ''}`, undefined,
        el('span', 'meta-estrelas', undefined, ...Array.from({ length: g.stars }, () => icon('estrela', g.done ? '#ffe23a' : '#7f9bb8', 2))),
        el('span', 'meta-nome', g.label),
        el('span', 'meta-prog', g.progress ?? (g.done ? 'ok' : '…')),
        el('span', 'meta-ok', g.done ? '✓' : '·'))));

    const side = el('div', 'balanco-lado', undefined, goals);
    if (d.money) {
      const net = d.money.income - d.money.expenses;
      side.appendChild(el('div', 'balanco-caixa', undefined,
        el('div', '', undefined, el('span', '', 'Receita'), el('b', '', `+$ ${fmt(d.money.income)}`)),
        el('div', '', undefined, el('span', '', 'Despesa'), el('b', 'ruim', `−$ ${fmt(d.money.expenses)}`)),
        el('div', 'total', undefined, el('span', '', 'Resultado'), el('b', net >= 0 ? 'bom' : 'ruim', `${net >= 0 ? '+' : '−'}$ ${fmt(Math.abs(net))}`))));
    }
    if (d.quotes?.length) {
      side.appendChild(el('div', 'balanco-falas', undefined, ...d.quotes.map((q) => {
        const c = drawPortrait(q.speaker.portrait, q.mood ?? 'normal', 1);
        c.className = 'balanco-mini';
        return el('div', 'balanco-fala', undefined, el('span', 'fala-moldura mini', undefined, c),
          el('div', '', undefined, el('b', '', q.speaker.name), el('span', '', ` ${q.text}`)));
      })));
    }

    const btn = el('button', 'gel lime balanco-proximo', undefined, el('span', '', d.nextLabel ?? 'Próximo dia'), el('span', 'kbd', 'Enter'));
    btn.type = 'button';
    btn.addEventListener('click', () => this.next());

    const card = el('div', 'gel balanco-cartao', undefined,
      el('div', 'pz-corpo', undefined, head, el('div', 'balanco-grade', undefined, kpis, side), el('div', 'balanco-rodape', undefined, btn)));
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', `Balanço do dia ${d.day}`);
    return card;
  }

  private kpiRow(k: ReportKpi): HTMLElement {
    const meta = KPI_META[k.kpi];
    const d = k.decimals ?? 0;
    const diff = k.value - k.prev;
    const eps = 0.5 * Math.pow(10, -d);
    const dir = Math.abs(diff) < eps ? 0 : diff > 0 ? 1 : -1;
    const good = dir === 0 ? null : (dir > 0) === (meta.better === 'up');
    const color = good === null ? '#4a6a8a' : good ? '#1f7a1f' : '#c41f1a';
    const unit = k.unit ?? '';
    const sep = unit && unit !== '%' ? ' ' : '';
    const row = el('div', `balanco-kpi ${good === null ? 'neutro' : good ? 'bom' : 'ruim'}${k.alert ? ' alerta' : ''}`, undefined,
      el('span', 'kpi-p', meta.problem),
      icon(meta.icon, '#0b2a52', 2),
      el('span', 'kpi-nome', meta.label),
      el('b', 'kpi-valor', `${fmt(k.value, d)}${sep}`, unit ? el('small', '', unit) : null),
      el('span', 'kpi-var', undefined,
        icon(dir === 0 ? 'igual' : dir > 0 ? 'sobe' : 'desce', color, 2),
        el('span', '', dir === 0 ? '0' : `${dir > 0 ? '+' : '−'}${fmt(Math.abs(diff), d)}`)));
    row.title = `${meta.label}: ontem ${fmt(k.prev, d)}${sep}${unit}`;
    return row;
  }
}
