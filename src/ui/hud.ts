import './hud.css';

/** HUD de gestão (SPEC §8) com linguagem Frutiger Aero. Só apresentação: os dados vêm de fora. */

export type OverlayMode = 'none' | 'traffic' | 'access';

export interface HudKpis {
  money: number;
  clock: string;
  travelMin: number;
  congestion: number;
  access: number;
  radical: number;
  satisfaction: number;
}

const TOOLS: [string, string][] = [
  ['≡', 'Faixas'], ['⇄', 'Sentido'], ['●', 'Semáforo'], ['T', 'Tuk-tuk'],
  ['∩', 'Travessia'], ['⚡', 'Compart.'], ['$', 'Tarifa'],
];

export class Hud {
  readonly root: HTMLElement;
  private kpiEls = new Map<string, HTMLElement>();
  private tricks: HTMLElement;
  private panel: HTMLElement;
  private legend: HTMLElement;
  private tabs: HTMLElement[] = [];
  private badge: HTMLElement;
  onOverlay?: (m: OverlayMode) => void;
  onSpeed?: (s: number) => void;

  constructor() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div class="topbar">
        <div class="gel logo"><span>PUCACITY</span></div>
        ${this.pill('money', 'Saldo')}${this.pill('clock', 'Dia / hora')}
        <div class="spacer"></div>
        ${this.pill('travel', 'Tempo médio')}${this.pill('congestion', 'Congestion.')}
        ${this.pill('access', 'Acessibilid.')}${this.pill('radical', 'Radicalidade')}${this.pill('satisfaction', 'Satisfação')}
        <div class="speed interactive">
          <button class="gel on" data-s="1"><span>▶</span></button><button class="gel" data-s="2"><span>▶▶</span></button><button class="gel" data-s="3"><span>▶▶▶</span></button>
        </div>
      </div>
      <div class="gel keys">
        <div><b>Arrastar</b> mover · <b>Roda</b> zoom · <b>Q/E</b> girar</div>
        <div><b>T</b> tráfego · <b>A</b> acessib. · <b>P</b> PS1 liga/desliga</div>
        <div><b>Espaço</b> pausa · <b>H</b> esconde HUD · <b>G</b> painel visual</div>
      </div>
      <div class="gel lime badge"><span>Vitrine visual · trânsito de demonstração</span></div>
      <div class="gel panel"></div>
      <div class="gel legend"><span>Ocupação da faixa</span><div class="bar"></div></div>
      <div class="tricks"></div>
      <div class="toolbar interactive">
        ${TOOLS.map(([i, l], k) => `<button class="tool"><div class="gel orb ${k % 3 === 1 ? 'lime' : k % 3 === 2 ? 'rosa' : ''}"><span>${i}</span></div><div class="lbl">${l}</div></button>`).join('')}
      </div>
      <div class="tabs interactive">
        <button class="gel tab on" data-m="none"><span>Normal</span></button>
        <button class="gel tab" data-m="traffic"><span>Tráfego <kbd>T</kbd></span></button>
        <button class="gel tab" data-m="access"><span>Acessibilidade <kbd>A</kbd></span></button>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    for (const el of root.querySelectorAll<HTMLElement>('[data-kpi]')) this.kpiEls.set(el.dataset.kpi!, el);
    this.tricks = root.querySelector('.tricks')!;
    this.panel = root.querySelector('.panel')!;
    this.legend = root.querySelector('.legend')!;
    this.badge = root.querySelector('.badge')!;
    this.tabs = [...root.querySelectorAll<HTMLElement>('.tab')];
    for (const t of this.tabs) t.addEventListener('click', () => this.onOverlay?.(t.dataset.m as OverlayMode));
    for (const b of root.querySelectorAll<HTMLElement>('.speed button')) {
      b.addEventListener('click', () => {
        root.querySelectorAll('.speed button').forEach((x) => x.classList.toggle('on', x === b));
        this.onSpeed?.(Number(b.dataset.s));
      });
    }
    for (const b of root.querySelectorAll<HTMLElement>('.tool')) {
      b.addEventListener('click', () => this.trick('FERRAMENTA EM BREVE', true));
    }
  }

  private pill(id: string, label: string) {
    return `<div class="gel pill" data-pill="${id}"><span class="k">${label}</span><span class="v" data-kpi="${id}">—</span></div>`;
  }

  setKpis(k: HudKpis) {
    const set = (id: string, html: string, warn = false) => {
      const el = this.kpiEls.get(id);
      if (!el) return;
      el.innerHTML = html;
      el.parentElement!.classList.toggle('warn', warn);
    };
    set('money', `$ ${k.money.toLocaleString('pt-BR')}`);
    set('clock', k.clock);
    set('travel', `${k.travelMin.toFixed(0)}<small> min</small>`);
    set('congestion', `${Math.round(k.congestion * 100)}<small>%</small>`, k.congestion > 0.3);
    set('access', `${Math.round(k.access * 100)}<small>%</small>`, k.access < 0.95);
    set('radical', `${Math.round(k.radical * 100)}<small>%</small>`);
    set('satisfaction', `${Math.round(k.satisfaction * 100)}<small>%</small>`);
  }

  setOverlay(m: OverlayMode) {
    for (const t of this.tabs) t.classList.toggle('on', t.dataset.m === m);
    this.legend.classList.toggle('show', m === 'traffic');
  }

  setBadge(on: boolean) {
    this.badge.classList.toggle('show', on);
  }

  trick(text: string, combo = false) {
    const el = document.createElement('div');
    el.className = `trick${combo ? ' combo' : ''}`;
    el.textContent = text;
    this.tricks.appendChild(el);
    while (this.tricks.children.length > 3) this.tricks.firstChild!.remove();
    setTimeout(() => el.remove(), 2300);
  }

  showPanel(title: string | null, rows: [string, string, boolean?][] = []) {
    this.panel.classList.toggle('show', !!title);
    if (!title) return;
    this.panel.innerHTML = `<h3>${title}</h3>` + rows.map(([k, v, bad]) => `<div class="row"><span>${k}</span><b class="${bad ? 'bad' : ''}">${v}</b></div>`).join('');
  }

  toggle(force?: boolean) {
    this.root.classList.toggle('hidden', force === undefined ? undefined : !force);
  }
}
