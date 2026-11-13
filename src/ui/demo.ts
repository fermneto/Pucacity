import '@fontsource/varela-round';
import '@fontsource/bungee';
import '@fontsource/exo-2/700.css';
import { Hud } from './hud';
import { SpeechQueue, type SpeechLine } from './speech';
import { DilemmaCard, type DilemmaData } from './dilemma';
import { RadioTicker, type RadioNews } from './radio';
import { DayReport, type DayReportData } from './report';
import { PERSONAGENS as P } from './personagens';
import { el } from './kpis';

/**
 * Página de demonstração dos componentes de interface (ui.html), com dados de exemplo
 * do cenário Vila Nova. Para capturas: ?show=bubbles|dilemma|radio|report|all (padrão all)
 * e ?hud=0 para esconder o HUD de fundo.
 */
const params = new URLSearchParams(location.search);
const show = params.get('show') ?? 'all';
const want = (k: string) => show === 'all' || show === k;

// ---------------------------------------------------------------- cenário de fundo
// Mapa pixelado de Vila Nova (só para dar contexto aos balões): canal, Rua do Mercado, bowl.
const W = 160, H = 90;
const MAP = document.createElement('canvas');
MAP.width = W;
MAP.height = H;
MAP.id = 'view';
document.body.appendChild(MAP);
const PLACES = {
  rita: [0.74, 0.6], bia: [0.24, 0.71], osvaldo: [0.44, 0.5], tuco: [0.5, 0.53],
} as const;

function drawMap() {
  const c = MAP.getContext('2d');
  if (!c) return;
  const px = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, 1, 1, (x + y) % 2 ? '#7ccf5a' : '#86d862');
  px(0, 46, W, 7, '#a9b4c2'); // Rua do Mercado
  for (let x = 0; x < W; x += 6) px(x, 49, 3, 1, '#f2f8fc');
  px(72, 0, 6, H, '#a9b4c2'); // rua norte-sul
  px(92, 0, 10, H, '#2e8bea'); // canal
  for (let y = 1; y < H; y += 4) px(94 + (y % 3), y, 3, 1, '#9fd4ff');
  px(90, 47, 14, 5, '#ffe23a'); // Rampa-Ponte
  px(96, 40, 3, 6, '#3fd0e8'); // Elevador de Bolha
  px(102, 46, W - 102, 7, '#a9b4c2');
  const casas: [number, number, string][] = [[8, 12, '#ff9ec8'], [24, 10, '#f2f8fc'], [40, 14, '#b2f0fa'], [56, 8, '#ffe23a'], [110, 14, '#ff9ec8'], [128, 10, '#d6ff96'], [144, 20, '#f2f8fc'], [112, 62, '#b2f0fa'], [132, 66, '#ffe23a']];
  for (const [x, y, col] of casas) { px(x, y, 12, 9, col); px(x, y, 12, 2, '#0b2a52'); px(x + 1, y + 9, 12, 1, '#5aa43f'); }
  px(40, 32, 28, 11, '#ff5fa8'); px(40, 32, 28, 2, '#0b2a52'); // Mercado
  px(14, 58, 30, 20, '#d0d8e2'); px(18, 62, 22, 12, '#9aa6b4'); px(21, 65, 16, 6, '#7a8696'); // bowl
}
drawMap();
Object.assign(MAP.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', imageRendering: 'pixelated' });

const anchor = (k: keyof typeof PLACES): [number, number] => {
  const [fx, fy] = PLACES[k];
  return [Math.round(fx * innerWidth), Math.round(fy * innerHeight)];
};

// ---------------------------------------------------------------- HUD de fundo
let topSafe = 10;
if (params.get('hud') !== '0') {
  const hud = new Hud();
  hud.setKpis({ money: 4180, clock: 'Dia 7 · 08:40', travelMin: 31.5, congestion: 0.34, access: 0.88, radical: 0.62, satisfaction: 0.71 });
  topSafe = (hud.root.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 56) + 8;
}

// ---------------------------------------------------------------- Rádio
const radio = new RadioTicker();
radio.root.style.setProperty('--radio-top', `${topSafe}px`);
// ?news=2 começa pela 2ª notícia (útil para capturar o letreiro rolando)
const NEWS: RadioNews[] = [
  { when: 'Amanhã · 17h', text: 'Campeonato no Bowl! Prepare as faixas.', kind: 'evento', durationMs: 60000 },
  { when: 'Agora', text: 'Fila no Elevador de Bolha passa de 20 minutos. Dona Rita já está reclamando no ponto da Zona Leste, e o pessoal da Associação de Cadeirantes quer conversar com a prefeitura.', kind: 'alerta' },
  { text: 'Bia acertou um gap de 4 metros na Rampa-Ponte. Novo recorde da Vila Nova!', kind: 'info' },
];
if (want('radio')) for (const n of NEWS.slice(Math.max(0, Number(params.get('news') ?? 1) - 1))) radio.announce(n);

// ---------------------------------------------------------------- Balões
const speech = new SpeechQueue(document.body, { maxVisible: 3, marginTop: topSafe + 44 });
const LINES: (Omit<SpeechLine, 'x' | 'y'> & { at: keyof typeof PLACES })[] = [
  { at: 'rita', speaker: P.rita, mood: 'bravo', text: 'Trinta e cinco minutos na fila do Elevador de Bolha! Eu só quero atravessar o canal.' },
  { at: 'osvaldo', speaker: P.osvaldo, mood: 'preocupado', text: 'Se mexerem na Rua do Mercado, quem vai entrar na minha loja?' },
  { at: 'tuco', speaker: P.tuco, mood: 'normal', text: 'Me dá uma janela de entrega cedinho e eu saio da faixa rápida.' },
  { at: 'bia', speaker: P.bia, mood: 'feliz', text: 'Abre a faixa rápida que eu chego no bowl em 3 minutos!' },
];
const lineIds = new Map<number, keyof typeof PLACES>();
function sayAll(persist: boolean) {
  for (const l of LINES) {
    const [x, y] = anchor(l.at);
    const id = speech.say({ ...l, x, y, durationMs: persist ? 0 : undefined });
    lineIds.set(id, l.at);
  }
}
addEventListener('resize', () => {
  for (const [id, k] of lineIds) speech.move(id, ...anchor(k));
});
if (want('bubbles')) sayAll(show === 'bubbles' || show === 'all');

// ---------------------------------------------------------------- Dilema e balanço
const DILEMA: DilemmaData = {
  id: 'elemento_travessia',
  tag: 'Dia 9',
  title: 'Elemento da travessia',
  context: 'Os skatistas querem trocar a Rampa-Ponte por um Salto Mortal (mais pontos de gap). A Associação de Cadeirantes quer um segundo Elevador de Bolha com a mesma verba.',
  voices: [
    { speaker: P.bia, mood: 'feliz', says: 'Salto Mortal! A galera de fora vem só pra ver.' },
    { speaker: P.rita, mood: 'preocupado', says: 'Já espero 35 minutos na fila do elevador.' },
  ],
  options: [
    {
      id: 'salto_mortal', title: 'Salto Mortal', description: 'Troca a Rampa-Ponte por um salto radical sobre o canal.',
      cost: 1800, costNote: 'obra de 2 dias',
      effects: [{ kpi: 'radical', delta: 2 }, { kpi: 'acesso', delta: -2, label: 'Acessib. (sem outra rota)' }, { kpi: 'quedas', delta: 1 }],
    },
    {
      id: 'segundo_elevador', title: '2º Elevador de Bolha', description: 'Dobra a capacidade da rota acessível do canal.',
      cost: 1800, costNote: 'manutenção diária',
      effects: [{ kpi: 'acesso', delta: 2 }, { kpi: 'fila', delta: -2 }, { kpi: 'radical', delta: 0 }],
    },
    {
      id: 'manter', title: 'Manter e economizar', description: 'Fica tudo como está e a verba volta para o caixa.',
      cost: -600, costNote: 'ninguém fica feliz',
      effects: [{ kpi: 'saldo', delta: 1 }, { kpi: 'satisfacao', delta: -1 }],
    },
  ],
};

const REPORT: DayReportData = {
  day: 7, totalDays: 14, city: 'Vila Nova', stars: 1,
  kpis: [
    { kpi: 'tempo', value: 31.5, prev: 34.0, unit: 'min', decimals: 1 },
    { kpi: 'quedas', value: 4.2, prev: 3.1, decimals: 1, alert: true },
    { kpi: 'energia', value: 92, prev: 94, unit: '%' },
    { kpi: 'ruido', value: 58, prev: 51, unit: 'dB' },
    { kpi: 'equidade', value: 18, prev: 22, unit: 'min' },
    { kpi: 'acesso', value: 88, prev: 81, unit: '%', alert: true },
    { kpi: 'resiliencia', value: 38, prev: 52, unit: 'min' },
    { kpi: 'comercio', value: 112, prev: 96, unit: '%' },
  ],
  goals: [
    { label: 'Tempo médio −20%', stars: 1, done: true, progress: '−21%' },
    { label: 'Acessibilidade ≥ 95%', stars: 2, done: false, progress: '88%' },
    { label: 'Quedas não aumentam · saldo ≥ 0', stars: 2, done: false, progress: '4,2 > 3,1' },
    { label: 'Seu Osvaldo satisfeito ≥ 60%', stars: 3, done: true, progress: '64%' },
  ],
  money: { income: 620, expenses: 845 },
  quotes: [
    { speaker: P.osvaldo, mood: 'feliz', text: 'O campeonato encheu o Mercado!' },
    { speaker: P.rita, mood: 'preocupado', text: 'A fila do elevador ainda me cansa.' },
    { speaker: P.tuco, mood: 'bravo', text: 'Faixa rápida lotada, entreguei tudo atrasado.' },
  ],
};

const dilemma = new DilemmaCard();
const report = new DayReport();
const status = el('div', 'pz-ui gel demo-status', undefined, el('span', '', '—'));
document.body.appendChild(status);
let lastMsg = '';
const say = (t: string) => {
  lastMsg = t;
  status.replaceChildren(el('span', '', `${lastMsg ? `${lastMsg} · ` : ''}Balões: ${speech.visibleCount} na tela · ${speech.queuedCount} na fila`));
};

function openDilemma() {
  dilemma.open(DILEMA, (c) => {
    say(c ? `Escolha: ${c.index + 1} (${c.id})` : 'Dilema adiado (Esc)');
    if (c && show === 'all') openReport();
  });
}
function openReport() {
  report.open(REPORT, () => say('Próximo dia → dia 8'));
}
if (show === 'dilemma' || show === 'all') openDilemma();
if (show === 'report') openReport();

// ---------------------------------------------------------------- controles da demo
const btn = (t: string, f: () => void) => {
  const b = el('button', 'gel demo-btn', undefined, el('span', '', t));
  b.addEventListener('click', f);
  return b;
};
const controls = el('div', 'pz-ui demo-controles', undefined,
  btn('Falas', () => sayAll(false)),
  btn('Rádio', () => radio.announce({ when: 'Dia 7 · 17h', text: 'Começou o Campeonato no Bowl! Evite a Rua do Mercado.', kind: 'evento' })),
  btn('Dilema', openDilemma),
  btn('Balanço', openReport));
document.body.appendChild(controls);
controls.style.top = `${topSafe + 44}px`;
say('');
setInterval(() => say(lastMsg), 500);

const style = document.createElement('style');
style.textContent = `
  .demo-controles { position: fixed; right: 10px; z-index: 16; display: flex; flex-direction: column; gap: 6px; }
  .demo-btn { padding: 4px 10px; font-size: 12px; }
  .demo-status { position: fixed; left: 50%; bottom: 82px; transform: translateX(-50%); padding: 3px 10px; font-size: 11px; z-index: 16; }
`;
document.head.appendChild(style);
