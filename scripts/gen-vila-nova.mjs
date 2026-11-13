// Gerador do cenário Vila Nova -> src/assets/cities/vila-nova.json
// Uso: node scripts/gen-vila-nova.mjs
// Unidades: 1 tile = 10 m; width em metros; speed em km/h; ownership em %.
import fs from 'node:fs';

const N = [
  [1, 6, 8], [2, 16, 8], [3, 26, 8],
  [4, 6, 20], [5, 16, 20], [6, 26, 20],
  [7, 6, 32], [8, 16, 32], [9, 26, 32],
  [10, 6, 42], [11, 16, 42], [12, 26, 42],
  [13, 36, 20], [14, 44, 20],
  [15, 36, 32], [16, 44, 32],
  [17, 36, 42], [18, 44, 42],
];
const nodes = N.map(([id, x, y]) => ({ id, x, y }));

const rua = { width: 8, speed: 15, oneWay: false, kind: 'street', lanes: { sidewalk: 1, slow: 1, fast: 1 } };
// Rua do Mercado: gargalo (estreita, eixo único entre bairro, escola e comércio)
const mercado = { width: 10, speed: 30, oneWay: false, kind: 'avenue', lanes: { sidewalk: 1, slow: 1, fast: 1 } };

const E = [
  [1, 2], [2, 3], [4, 5], [5, 6, mercado], [7, 8], [8, 9], [10, 11], [11, 12],
  [1, 4], [4, 7], [7, 10], [2, 5, mercado], [5, 8], [8, 11], [3, 6], [6, 9], [9, 12],
  [13, 14], [15, 16], [17, 18], [13, 15], [15, 17], [14, 16], [16, 18],
];
const edges = E.map(([from, to, t], i) => ({ id: i + 1, from, to, ...JSON.parse(JSON.stringify(t || rua)) }));

const crossings = [
  // Rampa-Ponte + Elevador de Bolha (rota acessível, mas com fila)
  { id: 1, from: 6, to: 13, over: 'canal', radical: 'ramp_bridge', access: 'bubble_lift' },
  // Rampa-Ponte SEM rota acessível: base do dilema / meta de acessibilidade
  { id: 2, from: 12, to: 17, over: 'canal', radical: 'ramp_bridge' },
];

let bid = 0;
const B = [];
const add = (x, y, kind, model, capacity, district, rotation = 0) =>
  B.push({ id: bid++, x, y, kind, capacity, model, rotation, district });

[[3, 5], [4.5, 5], [9, 5], [10.5, 5], [13, 5], [19, 5], [21, 5], [23, 5], [9, 12], [12, 12], [19, 12], [22, 12]]
  .forEach(([x, y], i) => add(x, y, 'res', i % 2 ? 'bld_res_2' : 'bld_res_1', 60, 0, 2));
[[9, 17], [12, 17], [20, 17], [23, 17], [9, 23], [12, 23], [20, 23], [23, 23], [3, 17]]
  .forEach(([x, y], i) => add(x, y, 'com', i % 2 ? 'bld_com_2' : 'bld_com_1', 40, 1, i < 4 ? 2 : 0));
add(10, 28, 'school', 'bld_school', 200, 2);
add(10, 37, 'skatepark', 'bld_skatepark', 300, 3);
add(21, 37, 'park', 'bld_park', 100, 3);
add(4, 37, 'park', 'bld_park', 100, 3);
[[39, 24], [42, 24], [39, 28], [42, 28], [39, 36], [42, 36], [40, 40], [41.5, 40]]
  .forEach(([x, y], i) => add(x, y, 'res', i % 2 ? 'bld_res_2' : 'bld_res_1', 50, 4, i < 4 ? 0 : 2));
add(40, 45, 'ind', 'bld_ind_1', 60, 4);
add(40, 16, 'com', 'bld_com_1', 30, 4);

const districts = [
  { id: 0, name: 'Residencial Norte', income: 'mid', population: 720, wheelchairShare: 0.02, ownership: { skate: 25, kick_scooter: 35, bmx: 10, e_scooter: 10 } },
  { id: 1, name: 'Centro / Mercado', income: 'mid', population: 120, wheelchairShare: 0.03, ownership: { kick_scooter: 30, skate: 20, tandem: 10, e_scooter: 15 } },
  { id: 2, name: 'Escola Municipal', income: 'low', population: 60, wheelchairShare: 0.03, ownership: { skate: 40, kick_scooter: 40, bmx: 15 } },
  { id: 3, name: 'Praça do Bowl', income: 'low', population: 60, wheelchairShare: 0.02, ownership: { skate: 60, longboard: 25, bmx: 30, skates: 20 } },
  { id: 4, name: 'Zona Leste', income: 'low', population: 240, wheelchairShare: 0.06, ownership: { skate: 20, kick_scooter: 25, wheelchair_powered: 5, wheelchair: 3, bmx: 10 } },
];

const first = (f) => B.findIndex(f);
const resN = first((b) => b.district === 0);
const comercio = first((b) => b.district === 1);
const leste = first((b) => b.district === 4 && b.kind === 'res');
const escola = first((b) => b.kind === 'school');
const bowl = first((b) => b.kind === 'skatepark');
const characters = [
  { id: 'dona_rita', name: 'Dona Rita', group: 'Zona Leste', vehicle: 'wheelchair_powered', home: leste, work: comercio },
  { id: 'bia', name: 'Bia', group: 'Praça do Bowl', vehicle: 'skate', home: resN, work: escola },
  { id: 'seu_osvaldo', name: 'Seu Osvaldo', group: 'Centro / Mercado', vehicle: 'pedestrian', home: comercio, work: comercio },
  { id: 'tuco', name: 'Tuco', group: 'Praça do Bowl', vehicle: 'bmx', home: resN + 1, work: bowl },
];

const features = [
  { kind: 'bowl', x: 10, y: 35, rot: 0 },
  { kind: 'stop_shelter', x: 15, y: 19, rot: 0 },
  { kind: 'tree', x: 7, y: 6, rot: 0 },
  { kind: 'bench', x: 17, y: 22, rot: 0 },
  { kind: 'lamp', x: 14, y: 21, rot: 0 },
];

const city = {
  name: 'Vila Nova',
  size: { w: 48, h: 48 },
  nodes, edges, crossings, buildings: B, districts,
  areas: [{ kind: 'water', x: 29, y: 0, w: 4, h: 48 }],
  features, characters,
  scenario: {
    id: 'vila-nova',
    budget: 5000,
    durationDays: 14,
    goals: [
      // PENDENTE: Goal não expressa "−20% vs. dia 1"; valor absoluto provisório (base ~18 min).
      { kpi: 'avgTripMinutes', op: '<=', value: 14.4, stars: 1 },
      { kpi: 'accessibilityPct', op: '>=', value: 95, stars: 2 },
      { kpi: 'balance', op: '>=', value: 0, stars: 2 },
    ],
    events: ['campeonato_bowl'],
    dilemmas: ['entregas_mercado', 'elemento_travessia'],
  },
};
fs.writeFileSync('src/assets/cities/vila-nova.json', JSON.stringify(city, null, 2) + '\n');
