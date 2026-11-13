// Gera src/assets/cities/vitrine.json: cidade de teste VISUAL (não é cenário de jogo).
// Mostra, num mapa pequeno, todos os modelos, faixas, travessias e elementos radicais.
// Uso: node scripts/gen-vitrine.mjs
import { writeFileSync } from 'node:fs';

const XS = [1, 6, 11, 16];
const NORTH = [1, 5];
const SOUTH = [11, 15];

const nodes = [];
const nodeAt = new Map();
let nid = 0;
for (const y of [...NORTH, ...SOUTH]) for (const x of XS) {
  const signal = undefined; // fases por aresta são preenchidas abaixo
  nodes.push({ id: nid, x, y, ...(signal ? { signal } : {}) });
  nodeAt.set(`${x},${y}`, nid++);
}

const FULL = { sidewalk: 2, slow: 2, fast: 2, transit: 1 };
const NO_TRANSIT = { sidewalk: 2, slow: 2, fast: 2 };
const NO_FAST = { sidewalk: 2, slow: 2, transit: 1 };

const edges = [];
let eid = 0;
function edge(a, b, kind, lanes) {
  edges.push({ id: eid++, from: nodeAt.get(a), to: nodeAt.get(b), width: 10, speed: 20, oneWay: false, kind, lanes });
}
for (const rows of [NORTH, SOUTH]) {
  for (const y of rows) for (let i = 0; i < XS.length - 1; i++) {
    const kind = y === 1 ? 'avenue' : (y === 5 || y === 11) ? 'boulevard' : 'street';
    edge(`${XS[i]},${y}`, `${XS[i + 1]},${y}`, kind, kind === 'street' && i === 2 ? NO_TRANSIT : FULL);
  }
  for (const x of XS) edge(`${x},${rows[0]}`, `${x},${rows[1]}`, 'street', x === 16 ? NO_FAST : FULL);
}

// Travessias do canal (SPEC §4.5). A de x=16 está SEM rota acessível de propósito:
// serve para validar o overlay de acessibilidade (deve aparecer em vermelho).
const crossings = [
  { id: 0, from: nodeAt.get('1,5'), to: nodeAt.get('1,11'), over: 'canal', radical: 'ramp_bridge', access: 'bubble_lift' },
  { id: 1, from: nodeAt.get('6,5'), to: nodeAt.get('6,11'), over: 'canal', radical: 'rail_walkway', access: 'glass_walkway' },
  { id: 2, from: nodeAt.get('11,5'), to: nodeAt.get('11,11'), over: 'canal', radical: 'death_jump', access: 'bubble_lift' },
  { id: 3, from: nodeAt.get('16,5'), to: nodeAt.get('16,11'), over: 'canal', radical: 'ramp_bridge' },
];

const buildings = [];
let bid = 0;
function bld(x, y, kind, model, rotation = 0, capacity = 40) {
  buildings.push({ id: bid++, x, y, kind, capacity, model, rotation });
}
// Norte-oeste: Vila Concreto
bld(2, 2, 'res', 'bld_res_1', 2); bld(3, 2, 'res', 'bld_res_2', 2); bld(4, 2, 'res', 'bld_res_1', 2); bld(5, 2, 'com', 'bld_com_2', 2);
bld(2, 4, 'res', 'bld_res_2', 0); bld(3, 3.5, 'skatepark', 'bld_skatepark', 0); bld(5, 4, 'res', 'bld_res_1', 0);
// Norte-centro: Centro Gel
bld(7, 2, 'com', 'bld_com_1', 2, 200); bld(8, 2, 'com', 'bld_com_2', 2, 150); bld(9, 2, 'com', 'bld_com_1', 2, 200); bld(10, 2, 'com', 'bld_com_1', 2, 200);
bld(7, 4, 'com', 'bld_com_1', 0, 200); bld(8.5, 3.5, 'park', 'bld_park', 0, 0); bld(10, 4, 'com', 'bld_com_2', 0, 150);
// Norte-leste: misto
bld(12, 2, 'res', 'bld_res_1', 2); bld(13, 2, 'school', 'bld_school', 2, 300); bld(14, 2, 'res', 'bld_res_2', 2); bld(15, 2, 'com', 'bld_com_1', 2);
bld(12, 4, 'res', 'bld_res_1', 0); bld(13.5, 4, 'park', 'bld_park', 0, 0); bld(15, 4, 'res', 'bld_res_2', 0);
// Sul-oeste: Vila Concreto
bld(2, 12, 'res', 'bld_res_1', 2); bld(3, 12, 'hospital', 'bld_hospital', 2, 120); bld(4, 12, 'res', 'bld_res_2', 2); bld(5, 12, 'res', 'bld_res_1', 2);
bld(2, 14, 'res', 'bld_res_2', 0); bld(3.5, 13.5, 'park', 'bld_park', 0, 0); bld(5, 14, 'res', 'bld_res_1', 0);
// Sul-centro: Praça Bowl
bld(7, 12, 'res', 'bld_res_1', 2); bld(10, 12, 'skatepark', 'bld_skatepark', 2); bld(7, 14, 'com', 'bld_com_2', 0); bld(10, 14, 'res', 'bld_res_2', 0);
// Sul-leste: Pátio Industrial
for (const x of [12, 13, 14, 15]) bld(x, 12, 'ind', 'bld_ind_1', 2, 80);
bld(12, 14, 'ind', 'bld_ind_1', 0, 80); bld(13.5, 14, 'skatepark', 'bld_skatepark', 0); bld(15, 14, 'ind', 'bld_ind_1', 0, 80);

for (const n of nodes) {
  if (n.x !== 6 && n.x !== 11) continue;
  const touching = edges.filter((e) => e.from === n.id || e.to === n.id);
  const horiz = touching.filter((e) => nodes[e.from].y === nodes[e.to].y).map((e) => e.id);
  const vert = touching.filter((e) => nodes[e.from].x === nodes[e.to].x).map((e) => e.id);
  n.signal = { cycle: 60, phases: [{ edges: horiz, green: 30 }, { edges: vert, green: 30 }] };
}

const districts = [
  { id: 0, name: 'Vila Concreto', income: 'low', population: 2400, wheelchairShare: 0.04,
    ownership: { skate: 45, kick_scooter: 30, bmx: 20, skates: 15, e_scooter: 5 } },
  { id: 1, name: 'Centro Gel', income: 'high', population: 1800, wheelchairShare: 0.03,
    ownership: { e_scooter: 40, hoverboard: 30, e_unicycle: 15, longboard: 20 } },
  { id: 2, name: 'Orla Bolha', income: 'mid', population: 1500, wheelchairShare: 0.05,
    ownership: { longboard: 35, skates: 30, skate: 30, kick_scooter: 20 } },
  { id: 3, name: 'Pátio Industrial', income: 'low', population: 900, wheelchairShare: 0.04,
    ownership: { bmx: 35, skate: 30, e_scooter: 10 } },
];

// Elementos radicais urbanos e props (proposta de extensão do contrato: `features`).
const features = [
  { kind: 'air_loop', x: 8.5, y: 1, rot: 1 },
  { kind: 'wallride', x: 3.5, y: 15, rot: 1 },
  { kind: 'bowl', x: 8.5, y: 13, rot: 0 },
  { kind: 'stop_shelter', x: 8.5, y: 5.72, rot: 2 },
  { kind: 'stop_shelter', x: 13.5, y: 10.28, rot: 0 },
  { kind: 'share_station', x: 3.5, y: 5.75, rot: 2 },
  { kind: 'crt_billboard', x: 13.5, y: 0.25, rot: 0 },
  { kind: 'crt_billboard', x: 3.5, y: 0.25, rot: 0 },
];
for (const x of XS) for (const y of [...NORTH, ...SOUTH]) {
  if ((x === 6 || x === 11) && (y === 5 || y === 11)) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      // quarter-pipes só nas quinas voltadas para dentro do quarteirão
      if ((y === 5 && sy > 0) || (y === 11 && sy < 0)) continue;
      features.push({ kind: 'quarter', x: x + sx * 0.78, y: y + sy * 0.78, rot: Math.atan2(sx, sy) / (Math.PI / 2) });
    }
  }
}
for (let x = 1.5; x <= 16; x += 2.5) {
  features.push({ kind: 'tree', x, y: 6.15, rot: 0 }, { kind: 'tree', x: x + 1, y: 9.85, rot: 0 });
  features.push({ kind: 'lamp', x: x + 0.5, y: 5.62, rot: 0 }, { kind: 'bench', x: x + 1.2, y: 6.3, rot: 2 });
}

const city = {
  name: 'Vitrine Pucacity (teste visual)',
  size: { w: 18, h: 17 },
  areas: [{ kind: 'water', x: 0, y: 6.8, w: 18, h: 2.4 }],
  nodes, edges, crossings, buildings, districts, features,
};

writeFileSync(new URL('../src/assets/cities/vitrine.json', import.meta.url), JSON.stringify(city, null, 1) + '\n');
console.log(`vitrine.json: ${nodes.length} nós, ${edges.length} vias, ${crossings.length} travessias, ${buildings.length} prédios, ${features.length} features`);
