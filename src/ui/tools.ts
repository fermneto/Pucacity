import type { CityFile, LaneKind, RadicalKind, AccessKind, SignalCfg } from '../core/types';
import { LANE_KINDS } from '../core/types';
import {
  CommandStack, SPEED_RANGE_KMH, type CommandSpec, type Preview, type TransitLineSpec, type LineKind,
} from '../core/Commands';

/**
 * Ferramentas do jogador na interface (SPEC §4.7), ligadas ao CommandStack do core:
 * escolher ferramenta → clicar no mapa (via, cruzamento ou travessia) → ajustar no painel →
 * ver custo/erros/avisos (pré-visualização do core) → Aplicar. Desfazer/Refazer devolvem/cobram o custo.
 * Só apresentação + montagem de CommandSpec: as regras ficam em src/core/Commands.ts.
 */
export type ToolKey = 'lanes' | 'direction' | 'speed' | 'signal' | 'crossing' | 'line';

export const TOOL_BUTTONS: { key: ToolKey; icon: string; label: string; hint: string }[] = [
  { key: 'lanes', icon: '≡', label: 'Faixas', hint: 'Clique numa via para redistribuir as faixas' },
  { key: 'direction', icon: '⇄', label: 'Sentido', hint: 'Clique numa via para mudar o sentido' },
  { key: 'speed', icon: '⌁', label: 'Velocidade', hint: 'Clique numa via para mudar o limite' },
  { key: 'signal', icon: '●', label: 'Semáforo', hint: 'Clique num cruzamento' },
  { key: 'crossing', icon: '∩', label: 'Travessia', hint: 'Clique numa travessia do canal' },
  { key: 'line', icon: 'T', label: 'Linha', hint: 'Clique nos cruzamentos em ordem para criar as paradas' },
];

export interface PickTarget { edge?: number; node?: number; crossing?: number }

export interface ToolHooks {
  /** A cidade ou as linhas mudaram: o jogo redesenha. */
  onChange(city: CityFile, lines: readonly TransitLineSpec[]): void;
  /** Mensagem curta no estilo "texto de manobra". */
  toast(text: string, good: boolean): void;
  /** Ferramenta ativa mudou (para destacar o botão). */
  onActive(key: ToolKey | null): void;
  /** Dia atual do jogo (para obras). */
  day(): number;
}

const LANE_NAMES: Record<LaneKind, string> = { sidewalk: 'Calçada', slow: 'Rodinha lenta', fast: 'Rodinha rápida', transit: 'Coletiva' };
const RADICAL_NAMES: Record<RadicalKind, string> = {
  ramp_bridge: 'Rampa-Ponte', death_jump: 'Salto Mortal', rail_walkway: 'Rail-Passarela', air_loop: 'Loop Aéreo',
};
const ACCESS_NAMES: Record<AccessKind | 'none', string> = {
  bubble_lift: 'Elevador de Bolha', glass_walkway: 'Passarela de vidro', transit_only: 'Só coletivo', none: 'Nenhuma',
};

const money = (v: number) => `$ ${Math.round(v).toLocaleString('pt-BR')}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export class ToolController {
  active: ToolKey | null = null;
  private panel: HTMLElement;
  private spec: CommandSpec | null = null;
  private lineStops: number[] = [];
  private lineCount = 0;

  constructor(readonly stack: CommandStack, private hooks: ToolHooks, parent: HTMLElement = document.body) {
    this.panel = document.createElement('div');
    this.panel.className = 'gel tool-panel interactive';
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    parent.appendChild(this.panel);
  }

  get city(): CityFile {
    return this.stack.city;
  }

  /** Liga/desliga uma ferramenta. */
  activate(key: ToolKey | null) {
    this.active = this.active === key ? null : key;
    this.spec = null;
    this.lineStops = [];
    this.hooks.onActive(this.active);
    if (!this.active) return this.close();
    const t = TOOL_BUTTONS.find((b) => b.key === this.active);
    this.render(`<h3><span>${t?.label ?? ''}</span></h3><p class="tp-hint"><span>${t?.hint ?? ''}</span></p>`);
  }

  close() {
    this.panel.classList.remove('show');
    this.spec = null;
  }

  undo() {
    const e = this.stack.undo();
    if (!e) return this.hooks.toast('NADA PARA DESFAZER', false);
    this.hooks.toast(`DESFEITO: ${e.label.toUpperCase()} +${money(e.cost)}`, true);
    this.changed();
  }

  redo() {
    const e = this.stack.redo();
    if (!e) return this.hooks.toast('NADA PARA REFAZER', false);
    this.hooks.toast(`REFEITO: ${e.label.toUpperCase()} −${money(e.cost)}`, true);
    this.changed();
  }

  /** Clique no mapa com uma ferramenta ativa. */
  pick(t: PickTarget) {
    switch (this.active) {
      case 'lanes': case 'direction': case 'speed':
        if (t.edge !== undefined) return this.openEdge(this.active, t.edge);
        return this.hint('Clique em cima de uma via.');
      case 'signal':
        if (t.node !== undefined) return this.openSignal(t.node);
        return this.hint('Clique num cruzamento.');
      case 'crossing':
        if (t.crossing !== undefined) return this.openCrossing(t.crossing);
        return this.hint('Clique numa travessia sobre o canal.');
      case 'line':
        if (t.node !== undefined) return this.addStop(t.node);
        return this.hint('Clique num cruzamento para adicionar uma parada.');
      default:
    }
  }

  // ---------------------------------------------------------------- painéis

  private openEdge(tool: 'lanes' | 'direction' | 'speed', edgeId: number) {
    const e = this.city.edges.find((x) => x.id === edgeId);
    if (!e) return;
    const head = `<h3><span>Via ${e.id} · ${e.kind}</span></h3><p class="tp-sub"><span>${e.width} m · ${e.oneWay ? 'mão única' : 'mão dupla'} · ${e.speed} km/h</span></p>`;
    if (tool === 'lanes') {
      const lanes = { ...e.lanes };
      const row = (k: LaneKind) => `<div class="tp-row"><span>${LANE_NAMES[k]}</span>
        <span class="tp-step"><button data-lane="${k}" data-d="-1">−</button><b data-v="${k}">${lanes[k] ?? 0}</b><button data-lane="${k}" data-d="1">+</button></span></div>`;
      this.render(head + `<p class="tp-sub"><span>Faixas por sentido</span></p>` + LANE_KINDS.map(row).join('') + this.footer());
      this.panel.querySelectorAll<HTMLButtonElement>('[data-lane]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.lane as LaneKind;
        lanes[k] = Math.max(0, Math.min(4, (lanes[k] ?? 0) + Number(b.dataset.d)));
        const v = this.panel.querySelector(`[data-v="${k}"]`);
        if (v) v.textContent = String(lanes[k]);
        this.setSpec({ type: 'lanes', edgeId, lanes: { ...lanes } });
      }));
      this.setSpec({ type: 'lanes', edgeId, lanes: { ...lanes } });
    } else if (tool === 'direction') {
      const opts: [string, 'twoWay' | 'oneWay' | 'reverse'][] = [['Mão dupla', 'twoWay'], ['Mão única', 'oneWay'], ['Inverter sentido', 'reverse']];
      this.render(head + `<div class="tp-choices">${opts.map(([l, m]) => `<button class="gel" data-mode="${m}"><span>${l}</span></button>`).join('')}</div>` + this.footer());
      this.choices('[data-mode]', (b) => this.setSpec({ type: 'direction', edgeId, mode: b.dataset.mode as 'twoWay' | 'oneWay' | 'reverse' }));
      this.setSpec(null);
    } else {
      this.render(head + `<div class="tp-row"><span>Limite</span><b data-speed>${e.speed} km/h</b></div>
        <input type="range" min="${SPEED_RANGE_KMH.min}" max="${SPEED_RANGE_KMH.max}" step="5" value="${e.speed}" data-range>` + this.footer());
      const r = this.panel.querySelector<HTMLInputElement>('[data-range]');
      r?.addEventListener('input', () => {
        const v = Number(r.value);
        const lbl = this.panel.querySelector('[data-speed]');
        if (lbl) lbl.textContent = `${v} km/h`;
        this.setSpec({ type: 'speed', edgeId, speed: v });
      });
      this.setSpec(null);
    }
  }

  private openSignal(nodeId: number) {
    const n = this.city.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    const touching = this.city.edges.filter((e) => e.from === nodeId || e.to === nodeId);
    const other = (e: (typeof touching)[number]) => this.city.nodes.find((x) => x.id === (e.from === nodeId ? e.to : e.from));
    const horiz = touching.filter((e) => Math.abs((other(e)?.y ?? n.y) - n.y) < 1e-6).map((e) => e.id);
    const vert = touching.filter((e) => !horiz.includes(e.id)).map((e) => e.id);
    const make = (split: number): SignalCfg => ({
      cycle: 60,
      phases: [horiz, vert].filter((p) => p.length).map((edges, i) => ({ edges, green: i === 0 ? split : 60 - split })),
    });
    const has = !!n.signal;
    this.render(`<h3><span>Cruzamento ${n.id}</span></h3><p class="tp-sub"><span>${has ? 'Com semáforo' : 'Sem semáforo'} · ${touching.length} vias</span></p>
      <div class="tp-choices">
        <button class="gel" data-sig="add"><span>${has ? 'Reprogramar' : 'Instalar semáforo'}</span></button>
        ${has ? '<button class="gel" data-sig="remove"><span>Remover</span></button>' : ''}
      </div>
      <div class="tp-row"><span>Verde leste-oeste</span><b data-split>30 s</b></div>
      <input type="range" min="10" max="50" step="5" value="30" data-range>` + this.footer());
    const r = this.panel.querySelector<HTMLInputElement>('[data-range]');
    let mode: 'add' | 'remove' = 'add';
    const update = () => {
      const split = Number(r?.value ?? 30);
      const lbl = this.panel.querySelector('[data-split]');
      if (lbl) lbl.textContent = `${split} s · norte-sul ${60 - split} s`;
      this.setSpec({ type: 'signal', nodeId, signal: mode === 'remove' ? null : make(split) });
    };
    r?.addEventListener('input', update);
    this.choices('[data-sig]', (b) => { mode = b.dataset.sig as 'add' | 'remove'; update(); });
    this.setSpec(null);
  }

  private openCrossing(crossingId: number) {
    const c = this.city.crossings.find((x) => x.id === crossingId);
    if (!c) return;
    let radical: RadicalKind = c.radical;
    let access: AccessKind | 'none' = c.access ?? 'none';
    const radicals: RadicalKind[] = ['ramp_bridge', 'death_jump', 'rail_walkway'];
    const accesses: (AccessKind | 'none')[] = ['bubble_lift', 'glass_walkway', 'transit_only', 'none'];
    this.render(`<h3><span>Travessia ${c.id}</span></h3><p class="tp-sub"><span>Sobre ${c.over === 'canal' ? 'o canal' : c.over}${c.locked ? ' · protegida' : ''}</span></p>
      <p class="tp-sub"><span>Elemento radical</span></p>
      <div class="tp-choices">${radicals.map((k) => `<button class="gel${k === radical ? ' on' : ''}" data-rad="${k}"><span>${RADICAL_NAMES[k]}</span></button>`).join('')}</div>
      <p class="tp-sub"><span>Rota acessível</span></p>
      <div class="tp-choices">${accesses.map((k) => `<button class="gel${k === access ? ' on' : ''}" data-acc="${k}"><span>${ACCESS_NAMES[k]}</span></button>`).join('')}</div>` + this.footer());
    const update = () => this.setSpec({ type: 'crossing', crossingId, radical, access: access === 'none' ? null : access });
    this.choices('[data-rad]', (b) => { radical = b.dataset.rad as RadicalKind; update(); });
    this.choices('[data-acc]', (b) => { access = b.dataset.acc as AccessKind | 'none'; update(); });
    this.setSpec(null);
  }

  private addStop(nodeId: number) {
    if (this.lineStops[this.lineStops.length - 1] !== nodeId) this.lineStops.push(nodeId);
    this.openLine();
  }

  private openLine() {
    const stops = this.lineStops;
    let kind: LineKind = 'tuktuk';
    let headway = 10, fleet = 3;
    this.render(`<h3><span>Nova linha</span></h3>
      <p class="tp-sub"><span>Paradas: ${stops.length ? stops.join(' → ') : '— clique nos cruzamentos —'}</span></p>
      <div class="tp-choices"><button class="gel on" data-kind="tuktuk"><span>Tuk-tuk</span></button><button class="gel" data-kind="tandem"><span>Tandem</span></button></div>
      <div class="tp-row"><span>Intervalo</span><span class="tp-step"><button data-h="-2">−</button><b data-hv>${headway} min</b><button data-h="2">+</button></span></div>
      <div class="tp-row"><span>Frota</span><span class="tp-step"><button data-f="-1">−</button><b data-fv>${fleet}</b><button data-f="1">+</button></span></div>
      <div class="tp-choices"><button class="gel" data-clear><span>Limpar paradas</span></button></div>` + this.footer());
    const id = () => `L${this.stack.lines.length + this.lineCount + 1}`;
    const update = () => {
      this.setSpec(stops.length >= 1 ? { type: 'addLine', line: { id: id(), kind, stops: [...stops], headwayMinutes: headway, fleet } } : null);
    };
    this.choices('[data-kind]', (b) => { kind = b.dataset.kind as LineKind; update(); });
    this.panel.querySelectorAll<HTMLButtonElement>('[data-h]').forEach((b) => b.addEventListener('click', () => {
      headway = Math.max(2, Math.min(30, headway + Number(b.dataset.h)));
      const v = this.panel.querySelector('[data-hv]');
      if (v) v.textContent = `${headway} min`;
      update();
    }));
    this.panel.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) => b.addEventListener('click', () => {
      fleet = Math.max(1, Math.min(12, fleet + Number(b.dataset.f)));
      const v = this.panel.querySelector('[data-fv]');
      if (v) v.textContent = String(fleet);
      update();
    }));
    this.panel.querySelector('[data-clear]')?.addEventListener('click', () => { this.lineStops = []; this.openLine(); });
    update();
  }

  // ---------------------------------------------------------------- utilidades

  private footer(): string {
    return `<div class="tp-preview" data-preview></div>
      <div class="tp-actions"><button class="gel lime" data-apply disabled><span>Aplicar</span></button><button class="gel" data-cancel><span>Fechar</span></button></div>`;
  }

  private render(html: string) {
    this.panel.innerHTML = html;
    this.panel.classList.add('show');
    this.panel.querySelector('[data-cancel]')?.addEventListener('click', () => this.activate(null));
    this.panel.querySelector('[data-apply]')?.addEventListener('click', () => this.apply());
  }

  private hint(text: string) {
    this.hooks.toast(text.toUpperCase(), false);
  }

  /** Grupo de botões de escolha única: marca o clicado e chama fn. */
  private choices(sel: string, fn: (b: HTMLButtonElement) => void) {
    const bs = [...this.panel.querySelectorAll<HTMLButtonElement>(sel)];
    for (const b of bs) b.addEventListener('click', () => {
      bs.forEach((x) => x.classList.toggle('on', x === b));
      fn(b);
    });
  }

  private setSpec(spec: CommandSpec | null) {
    this.spec = spec;
    const box = this.panel.querySelector<HTMLElement>('[data-preview]');
    const btn = this.panel.querySelector<HTMLButtonElement>('[data-apply]');
    if (!box || !btn) return;
    if (!spec) {
      box.innerHTML = '<p class="tp-sub"><span>Escolha uma opção para ver custo e efeitos.</span></p>';
      btn.disabled = true;
      return;
    }
    const p: Preview = this.stack.preview(spec);
    const lines = [
      `<div class="tp-row"><span>Custo</span><b class="${p.cost > this.stack.money ? 'bad' : ''}">${money(p.cost)}</b></div>`,
      p.buildDays ? `<div class="tp-row"><span>Obra</span><b>${p.buildDays} dia(s)${p.blocksTraffic ? ' · fecha a ligação' : ''}</b></div>` : '',
      `<div class="tp-row"><span>Saldo depois</span><b>${money(this.stack.money - p.cost)}</b></div>`,
      ...p.errors.map((e) => `<p class="tp-err"><span>✗ ${esc(e)}</span></p>`),
      ...p.warnings.map((w) => `<p class="tp-warn"><span>⚠ ${esc(w)}</span></p>`),
    ];
    box.innerHTML = lines.join('');
    btn.disabled = !p.ok;
  }

  private apply() {
    if (!this.spec) return;
    const r = this.stack.execute(this.spec, this.hooks.day());
    if (!r.ok || !r.entry) {
      this.hooks.toast(r.errors[0]?.toUpperCase() ?? 'NÃO DEU', false);
      return this.setSpec(this.spec);
    }
    if (this.spec.type === 'addLine') { this.lineCount++; this.lineStops = []; }
    this.hooks.toast(`${r.label.toUpperCase()}! −${money(r.cost)}`, true);
    this.changed();
    const tool = this.active;
    this.close();
    this.active = null;
    this.activate(tool); // continua com a mesma ferramenta, pronta para o próximo clique
  }

  private changed() {
    this.hooks.onChange(this.stack.city, this.stack.lines);
  }
}
