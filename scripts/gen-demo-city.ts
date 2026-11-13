/**
 * Gera public/cities/demo.json: cidade-demo 48×48 cortada por um canal, para a Engenharia
 * testar o pipeline até o Design entregar a primeira cidade de verdade.
 *
 *   node scripts/gen-demo-city.ts      (Node 23.6+ roda TypeScript direto)
 *
 * Pontos de dor de propósito:
 * - travessia da coluna 1 sem rota acessível;
 * - rua do topo só com faixa rápida (patinetes caem na calçada);
 * - coluna 1 sem calçada;
 * - avenida (linha 2 / coluna 3) é a única com faixa coletiva.
 */
import { writeFileSync } from 'node:fs';

type Lanes = { sidewalk?: number; slow?: number; fast?: number; transit?: number };

const N = 6;
const STEP = 8;
const OFF = 4;
const xs = Array.from({ length: N }, (_, i) => OFF + i * STEP); // 4..44
const ys = [4, 12, 20, 28, 36, 44];
const CANAL = { y: 23, h: 2 }; // entre as linhas 2 (y=20) e 3 (y=28)
const AV_ROW = 2;
const AV_COL = 3;

const gridId = (i: number, j: number) => j * N + i + 1;
const northBank = (i: number) => 101 + i;
const southBank = (i: number) => 111 + i;

const nodes: { id: number; x: number; y: number; signal?: unknown }[] = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) nodes.push({ id: gridId(i, j), x: xs[i]!, y: ys[j]! });
for (let i = 0; i < N; i++) {
  nodes.push({ id: northBank(i), x: xs[i]!, y: CANAL.y });
  nodes.push({ id: southBank(i), x: xs[i]!, y: CANAL.y + CANAL.h });
}

const AVENUE = { kind: 'avenue', width: 14, speed: 30, lanes: { sidewalk: 1, slow: 1, fast: 1, transit: 1 } as Lanes };
const BOULEVARD = { kind: 'boulevard', width: 12, speed: 25, lanes: { sidewalk: 2, slow: 1, fast: 1 } as Lanes };
const STREET = { kind: 'street', width: 7, speed: 25, lanes: { sidewalk: 1, slow: 1 } as Lanes };
const SKATE_STREET = { kind: 'street', width: 7, speed: 25, lanes: { sidewalk: 1, fast: 1 } as Lanes };
const NO_SIDEWALK = { kind: 'street', width: 6, speed: 25, lanes: { slow: 1, fast: 1 } as Lanes };

const edges: Record<string, unknown>[] = [];
let eid = 1;
const addEdge = (from: number, to: number, profile: typeof STREET, oneWay = false) => {
  edges.push({ id: eid, from, to, width: profile.width, speed: profile.speed, oneWay, kind: profile.kind, lanes: profile.lanes });
  return eid++;
};

// horizontais
const avH: number[] = [];
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N - 1; i++) {
    const profile = j === AV_ROW ? AVENUE : j === 5 ? BOULEVARD : j === 0 ? SKATE_STREET : STREET;
    let a = gridId(i, j);
    let b = gridId(i + 1, j);
    if (j === 4) [a, b] = [b, a]; // mão única para oeste
    const id = addEdge(a, b, profile, j === 1 || j === 4);
    if (j === AV_ROW && (i === AV_COL || i === AV_COL - 1)) avH.push(id);
  }
}
// verticais (o trecho 2→3 vira via → margem norte, travessia, margem sul → via)
const avV: number[] = [];
for (let i = 0; i < N; i++) {
  const profile = i === AV_COL ? AVENUE : i === 1 ? NO_SIDEWALK : STREET;
  for (let j = 0; j < N - 1; j++) {
    if (j === 2) {
      const id = addEdge(gridId(i, 2), northBank(i), profile);
      if (i === AV_COL) avV.push(id);
      addEdge(southBank(i), gridId(i, 3), profile);
    } else {
      const id = addEdge(gridId(i, j), gridId(i, j + 1), profile);
      if (i === AV_COL && j === 1) avV.push(id);
    }
  }
}

const crossingPlan = [
  { radical: 'ramp_bridge', access: 'bubble_lift' },
  { radical: 'ramp_bridge' }, // sem rota acessível: ponto de dor
  { radical: 'death_jump', access: 'bubble_lift' },
  { radical: 'air_loop', access: 'transit_only' },
  { radical: 'rail_walkway', access: 'glass_walkway' },
  { radical: 'ramp_bridge', access: 'bubble_lift', locked: true },
];
const crossings = crossingPlan.map((c, i) => ({ id: 201 + i, from: northBank(i), to: southBank(i), over: 'canal', ...c }));

// semáforo no cruzamento das avenidas
const center = nodes.find((n) => n.id === gridId(AV_COL, AV_ROW))!;
center.signal = { cycle: 90, phases: [{ edges: avH, green: 40 }, { edges: avV, green: 40 }] };

const districts = [
  { id: 1, name: 'Vila Concreto', income: 'low', population: 2400, wheelchairShare: 0.05,
    ownership: { pedestrian: 100, skate: 35, kick_scooter: 30, skates: 10, bmx: 15, wheelchair: 4 } },
  { id: 2, name: 'Centro Gel', income: 'mid', population: 700, wheelchairShare: 0.04,
    ownership: { pedestrian: 100, skate: 20, e_scooter: 30, hoverboard: 20, kick_scooter: 15, wheelchair_powered: 3 } },
  { id: 3, name: 'Orla Bolha', income: 'high', population: 1100, wheelchairShare: 0.06,
    ownership: { pedestrian: 100, longboard: 30, e_scooter: 35, e_unicycle: 15, hoverboard: 25, wheelchair_powered: 5 } },
  { id: 4, name: 'Pátio Industrial', income: 'low', population: 400, wheelchairShare: 0.03,
    ownership: { pedestrian: 100, skate: 40, bmx: 30, kick_scooter: 20, wheelchair: 3 } },
];

const CAPACITY: Record<string, number> = { res: 40, com: 80, ind: 120, school: 300, hospital: 200, park: 0, skatepark: 60 };
const buildings: Record<string, unknown>[] = [];
let bid = 1;
// quarteirões: bj 0–1 ao norte do canal, bj 3–4 ao sul (bj 2 é a orla do canal, sem prédios)
for (const bj of [0, 1, 3, 4]) {
  for (let bi = 0; bi < N - 1; bi++) {
    const north = bj <= 1;
    let kind = 'res';
    let district = 1;
    if (north) {
      if (bi >= 2 && bi <= 3) [kind, district] = ['com', 2];
      else if (bi === 4) [kind, district] = ['res', 3];
    } else {
      if (bi <= 1) [kind, district] = ['ind', 4];
      else if (bi >= 3) [kind, district] = ['res', 3];
    }
    if (bi === 1 && bj === 3) kind = 'school';
    if (bi === 3 && bj === 0) kind = 'hospital';
    if (bi === 4 && bj === 1) kind = 'park';
    if (bi === 2 && bj === 4) kind = 'skatepark';
    for (const [ox, oy] of [[2.5, 2.5], [5.5, 2.5], [2.5, 5.5], [5.5, 5.5]] as const) {
      buildings.push({
        id: bid, x: xs[bi]! + ox, y: ys[bj]! + oy, kind, capacity: CAPACITY[kind], model: `bld_${kind}_1`,
        rotation: bid % 4, district,
      });
      bid++;
    }
  }
}

const city = {
  name: 'Pucacity Demo',
  size: { w: 48, h: 48 },
  nodes,
  edges,
  crossings,
  buildings,
  districts,
  areas: [{ kind: 'water', x: 0, y: CANAL.y, w: 48, h: CANAL.h }],
  scenario: {
    budget: 500000,
    durationDays: 30,
    goals: [
      { kpi: 'avgTripMinutes', op: '<=', value: 20, stars: 1 },
      { kpi: 'accessibilityPct', op: '>=', value: 95, stars: 2 },
      { kpi: 'congestionPct', op: '<=', value: 15, stars: 3 },
    ],
  },
};

writeFileSync(new URL('../public/cities/demo.json', import.meta.url), JSON.stringify(city, null, 1) + '\n');
console.log(`demo.json: ${nodes.length} nós, ${edges.length} vias, ${crossings.length} travessias, ${buildings.length} prédios`);
