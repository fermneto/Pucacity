// Gera src/assets/cities/vitrine.json: cidade de teste VISUAL (não é cenário de jogo).
// Mostra todos os modelos, faixas, travessias e elementos radicais numa cidade de 2 canais
// com uma ilha central (Orla Bolha) entre eles.
// Uso: node scripts/gen-vitrine.mjs
//
// Contrato (src/core/types.ts): 1 tile = 10 m; edge.width em metros; edge.speed em km/h;
// ownership em %; água em `areas` (kind 'water'); travessias vão de `from` (norte) para `to` (sul).
//
// Geometria que o render supõe (CityView/DemoTraffic):
// - o link da travessia mede 6 tiles e o canal (2,4 tiles) fica exatamente no meio dele;
// - a água cobre a largura toda da cidade;
// - nada (prédio ou feature) em cima de vias, travessias, rampas ou do Elevador de Bolha.
// O gerador confere essas regras e FALHA se algo se sobrepõe.
import { writeFileSync } from 'node:fs';

// ---------- grade ----------
const XS = [1, 6, 11, 16, 21, 26, 31]; // colunas a cada 5 tiles
const BANDS = [
  { name: 'norte', rows: [1, 5] },
  { name: 'ilha', rows: [11, 15] },
  { name: 'sul', rows: [21, 25] },
];
const W = 33;
const H = 27;
const CANAL_H = 2.4;
// canal centrado entre a última linha de uma faixa e a primeira da seguinte (link de 6 tiles)
const CANALS = [0, 1].map((k) => {
  const a = BANDS[k].rows[1], b = BANDS[k + 1].rows[0];
  return { y0: (a + b) / 2 - CANAL_H / 2, y1: (a + b) / 2 + CANAL_H / 2, a, b };
});

const nodes = [];
const nodeAt = new Map();
let nid = 0;
for (const band of BANDS) for (const y of band.rows) for (const x of XS) {
  nodes.push({ id: nid, x, y });
  nodeAt.set(`${x},${y}`, nid++);
}
const N = (x, y) => {
  const id = nodeAt.get(`${x},${y}`);
  if (id === undefined) throw new Error(`nó ${x},${y} não existe`);
  return id;
};

// ---------- vias ----------
const FULL = { sidewalk: 2, slow: 2, fast: 2, transit: 1 };
const NO_TRANSIT = { sidewalk: 2, slow: 2, fast: 2 };
const NO_FAST = { sidewalk: 2, slow: 2, transit: 1 };
const ROW_KIND = { 1: 'avenue', 5: 'boulevard', 11: 'boulevard', 15: 'street', 21: 'boulevard', 25: 'avenue' };
const SPEED = { avenue: 30, boulevard: 25, street: 20 };

const edges = [];
let eid = 0;
function edge(a, b, kind, lanes) {
  edges.push({ id: eid++, from: a, to: b, width: 10, speed: SPEED[kind], oneWay: false, kind, lanes });
}
for (const band of BANDS) {
  for (const y of band.rows) for (let i = 0; i < XS.length - 1; i++) {
    const kind = ROW_KIND[y];
    edge(N(XS[i], y), N(XS[i + 1], y), kind, kind === 'street' && i % 3 === 2 ? NO_TRANSIT : FULL);
  }
  for (const [i, x] of XS.entries()) {
    edge(N(x, band.rows[0]), N(x, band.rows[1]), 'street', i === XS.length - 1 || i === 3 ? NO_FAST : FULL);
  }
}

// ---------- travessias (SPEC §4.5) ----------
// Uma por coluna em cada canal. Duas ficam SEM rota acessível de propósito: validam o overlay
// de acessibilidade (aparecem em vermelho) e o aviso do CityLoader.
const RADICALS = ['ramp_bridge', 'death_jump', 'rail_walkway'];
const crossings = [];
let cid = 0;
for (const [k, canal] of CANALS.entries()) {
  for (const [i, x] of XS.entries()) {
    const radical = RADICALS[(i + k * 2) % RADICALS.length];
    const access = radical === 'rail_walkway' ? 'glass_walkway' : (i + k) % 2 ? 'bubble_lift' : 'glass_walkway';
    const noAccess = (k === 0 && i === XS.length - 1) || (k === 1 && i === 2);
    const c = { id: cid++, from: N(x, canal.a), to: N(x, canal.b), over: 'canal', radical };
    if (!noAccess) c.access = access;
    else if (radical === 'rail_walkway') throw new Error('rail_walkway sempre tem passarela; escolha outra sem acesso');
    crossings.push(c);
  }
}

// ---------- bairros ----------
const districts = [
  { id: 0, name: 'Vila Concreto', income: 'low', population: 4200, wheelchairShare: 0.04,
    ownership: { skate: 45, kick_scooter: 30, bmx: 20, skates: 15, e_scooter: 5 } },
  { id: 1, name: 'Centro Gel', income: 'high', population: 3600, wheelchairShare: 0.03,
    ownership: { e_scooter: 40, hoverboard: 30, e_unicycle: 15, longboard: 20 } },
  { id: 2, name: 'Orla Bolha', income: 'mid', population: 3900, wheelchairShare: 0.05,
    ownership: { longboard: 35, skates: 30, skate: 30, kick_scooter: 20 } },
  { id: 3, name: 'Pátio Industrial', income: 'low', population: 1800, wheelchairShare: 0.04,
    ownership: { bmx: 35, skate: 30, e_scooter: 10 } },
  { id: 4, name: 'Morro Alto', income: 'mid', population: 3000, wheelchairShare: 0.06,
    ownership: { e_unicycle: 20, longboard: 25, skate: 25, wheelchair_powered: 4, kick_scooter: 20 } },
];
const D = { vila: 0, centro: 1, orla: 2, patio: 3, morro: 4 };

// ---------- ocupação (anti-sobreposição) ----------
// Caixas em tiles: [x0, z0, x1, z1]. Vias e corredores de travessia são "chão reservado".
const reserved = [];
for (const e of edges) {
  const A = nodes[e.from], B = nodes[e.to];
  reserved.push({ what: `via ${e.id}`, box: [Math.min(A.x, B.x) - 0.5, Math.min(A.y, B.y) - 0.5, Math.max(A.x, B.x) + 0.5, Math.max(A.y, B.y) + 0.5] });
}
for (const c of crossings) {
  const A = nodes[c.from], B = nodes[c.to];
  // rampas, elemento radical e Elevador de Bolha (x + 0,62) entre as duas vias
  reserved.push({ what: `travessia ${c.id}`, box: [A.x - 0.5, A.y + 0.5, A.x + 0.95, B.y - 0.5] });
}
for (const c of CANALS) reserved.push({ what: 'canal', box: [-1, c.y0, W + 1, c.y1] });

// meia-extensão local [x-, z-, x+, z+] em tiles (modelo em metros / 10)
const EXTENT = {
  building: [-0.38, -0.38, 0.38, 0.38],
  bld_park: [-0.4, -0.4, 0.4, 0.4],
  bld_skatepark: [-0.4, -0.4, 0.4, 0.4],
  tree: [-0.14, -0.14, 0.14, 0.14],
  lamp: [-0.06, -0.06, 0.06, 0.06],
  bench: [-0.1, -0.04, 0.1, 0.04],
  stop_shelter: [-0.21, -0.1, 0.21, 0.1],
  share_station: [-0.16, -0.06, 0.16, 0.06],
  crt_billboard: [-0.16, -0.05, 0.16, 0.05],
  quarter: [-0.2, -0.22, 0.2, 0.06],
  bowl: [-0.72, -0.72, 0.72, 0.72],
  wallride: [-0.4, -0.42, 0.4, 0.42],
  spiral_tower: [-0.58, -0.58, 1.02, 0.58], // inclui o salto do topo (+x local)
  megapipe: [-0.82, -0.72, 0.82, 0.72],
  air_loop: [-0.45, -0.65, 0.45, 0.65],
};
const placed = [];
function box(kind, x, y, rot) {
  const e = EXTENT[kind] ?? EXTENT.building;
  const t = (rot * Math.PI) / 2, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  // mesma rotação do three (makeRotationY): x' = x cos + z sin ; z' = -x sin + z cos
  const pts = [[e[0], e[1]], [e[2], e[1]], [e[2], e[3]], [e[0], e[3]]].map(([lx, lz]) => [x + lx * c + lz * s, y - lx * s + lz * c]);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}
const hit = (a, b) => a[0] < b[2] - 1e-6 && b[0] < a[2] - 1e-6 && a[1] < b[3] - 1e-6 && b[1] < a[3] - 1e-6;
function occupy(what, kind, x, y, rot, onRoad = false) {
  const b = box(kind, x, y, rot);
  if (b[0] < -0.5 || b[2] > W - 1.5 || b[1] < -0.5 || b[3] > H - 0.5) throw new Error(`${what} (${x}, ${y}) sai do chão da cidade`);
  for (const r of onRoad ? reserved.filter((r) => r.what === 'canal') : reserved) {
    if (hit(b, r.box)) throw new Error(`${what} (${x}, ${y}) está em cima de ${r.what}`);
  }
  for (const p of placed) if (hit(b, p.box)) throw new Error(`${what} (${x}, ${y}) sobrepõe ${p.what}`);
  placed.push({ what, box: b });
}

// ---------- prédios ----------
const buildings = [];
let bid = 0;
const CAP = { res: 40, com: 150, ind: 80, school: 300, hospital: 120, park: 0, skatepark: 20 };
function bld(x, y, kind, model, rotation, district, capacity = CAP[kind]) {
  occupy(`${model}`, model === 'bld_park' || model === 'bld_skatepark' ? model : 'building', x, y, rotation);
  buildings.push({ id: bid++, x, y, kind, capacity, model, rotation, district });
}
const KIND_OF = (m) => m.startsWith('bld_res') ? 'res' : m.startsWith('bld_com') ? 'com' : m.startsWith('bld_ind') ? 'ind'
  : m === 'bld_park' ? 'park' : m === 'bld_skatepark' ? 'skatepark' : m === 'bld_school' ? 'school' : 'hospital';

// ---------- features ----------
const features = [];
function feat(kind, x, y, rot = 0, onRoad = false) {
  if (kind !== 'orb') occupy(kind, kind, x, y, rot, onRoad);
  features.push({ kind, x: +x.toFixed(2), y: +y.toFixed(2), rot });
}

/**
 * Quarteirão: x0 = coluna oeste, y0 = linha norte. Interior útil: x0+0.5..x0+4.5, y0+0.5..y0+3.5.
 * `top`/`bottom`: 4 modelos (ou null) nas posições x0+1..x0+4, frente para a via mais próxima.
 * `mid`: função que ocupa o miolo (praça, elemento radical etc.).
 */
function block(x0, y0, district, top, bottom, mid) {
  top.forEach((m, i) => m && bld(x0 + 1 + i, y0 + 1, KIND_OF(m), m, 2, district));
  bottom.forEach((m, i) => m && bld(x0 + 1 + i, y0 + 3, KIND_OF(m), m, 0, district));
  mid?.(x0 + 2.5, y0 + 2, district);
}
const trees = (n) => (cx, cy) => {
  for (let k = 0; k < n; k++) feat('tree', cx - (n - 1) * 0.6 + k * 1.2, cy, 0);
};
const plaza = (kind, rot = 0, extra) => (cx, cy) => { feat(kind, cx, cy, rot); extra?.(cx, cy); };
// quarter-pipes nas bordas da praça, de costas para a via
// prédio de bairro (parque/skatepark) no miolo, entre as fileiras
const midBld = (model) => (cx, cy, d) => bld(cx, cy, KIND_OF(model), model, 0, d);
const quarters = (cx, cy) => { feat('quarter', cx, cy - 1.15, 2); feat('quarter', cx, cy + 1.15, 0); };

const R1 = 'bld_res_1', R2 = 'bld_res_2', R3 = 'bld_res_3', C1 = 'bld_com_1', C2 = 'bld_com_2', C3 = 'bld_com_3';
const I1 = 'bld_ind_1', PK = 'bld_park', SK = 'bld_skatepark', SC = 'bld_school', HO = 'bld_hospital';

// Norte (linhas 1–5): Vila Concreto a oeste, Centro Gel no resto
const [n0] = BANDS[0].rows;
block(1, n0, D.vila, [R1, R2, R3, R1], [R2, null, null, R1], midBld(SK));
block(6, n0, D.vila, [R3, R1, SC, R2], [R1, null, null, R3], plaza('wallride', 1));
block(11, n0, D.centro, [C1, null, null, C1], [C3, null, null, C1], plaza('bowl', 0));
block(16, n0, D.centro, [C2, C1, C1, C3], [C1, null, PK, C2], trees(1));
block(21, n0, D.centro, [C1, C3, C1, C2], [C3, null, null, C1], trees(2));
block(26, n0, D.centro, [C3, null, null, C1], [PK, null, null, PK], plaza('spiral_tower', 0));

// Ilha (linhas 11–15): Orla Bolha
const [i0] = BANDS[1].rows;
block(1, i0, D.orla, [R3, C3, R1, R2], [R1, null, null, R3], midBld(PK));
block(6, i0, D.orla, [C2, R3, R3, C3], [R2, null, null, HO], trees(2));
block(11, i0, D.orla, [R3, null, null, PK], [C2, null, null, PK], plaza('megapipe', 0));
block(16, i0, D.orla, [C3, R1, SC, R3], [R3, null, null, C2], plaza('wallride', 1));
block(21, i0, D.orla, [R2, C2, R3, R1], [C3, null, null, R1], midBld(SK));
block(26, i0, D.orla, [R3, null, null, C3], [R1, null, null, C2], plaza('bowl', 0));

// Sul (linhas 21–25): Morro Alto a oeste, Pátio Industrial a leste
const [s0] = BANDS[2].rows;
block(1, s0, D.morro, [R2, null, null, R2], [PK, null, null, PK], plaza('spiral_tower', 0));
block(6, s0, D.morro, [R2, HO, R1, R2], [R3, null, null, R2], midBld(PK));
block(11, s0, D.morro, [R1, R2, R3, R2], [R2, null, null, SC], plaza('wallride', 1));
block(16, s0, D.patio, [I1, null, null, I1], [I1, null, null, I1], plaza('bowl', 0));
block(21, s0, D.patio, [I1, null, null, SK], [I1, null, null, SK], plaza('megapipe', 0));
block(26, s0, D.patio, [I1, I1, R1, I1], [I1, null, SK, I1], trees(1));

// ---------- Loops Aéreos nas avenidas (só a faixa rápida para leste dá a volta) ----------
for (const [x, y] of [[8.5, 1], [18.5, 1], [13.5, 25], [28.5, 25]]) feat('air_loop', x, y, 1, true);

// ---------- quarter-pipes em volta das praças radicais ----------
for (const [cx, cy] of [[13.5, 3], [28.5, 3], [13.5, 13], [28.5, 13], [18.5, 23], [23.5, 23], [3.5, 23]]) {
  // na borda norte/sul do miolo, centralizados (longe das vias e dos prédios de canto)
  quarters(cx, cy);
}

// ---------- beira-canal: postes, árvores, bancos, paradas e estações ----------
for (const canal of CANALS) {
  for (const [side, roadY] of [[-1, canal.a], [1, canal.b]]) {
    const yLamp = roadY - side * 0.62, yTree = side < 0 ? (roadY + 0.5 + canal.y0) / 2 : (canal.y1 + roadY - 0.5) / 2;
    for (const [i, x] of XS.slice(0, -1).entries()) {
      const stop = (i + (side > 0 ? 1 : 0)) % 2 === 0;
      feat('lamp', x + 1.4, yLamp, 0);
      feat('tree', x + 2.2, yTree, 0);
      if (stop) feat('stop_shelter', x + 3.0, roadY - side * 0.72, side < 0 ? 2 : 0);
      else feat('bench', x + 3.0, yTree + side * 0.05, side < 0 ? 2 : 0);
      feat('tree', x + 3.8, yTree, 0);
      feat('lamp', x + 4.35, yLamp, 0);
    }
  }
}
// estações de compartilhamento e painéis CRT nas bordas da cidade
for (const x of [3.5, 18.5, 28.5]) feat('share_station', x, 0.0, 2);
for (const x of [6.5, 23.5]) feat('crt_billboard', x, 0.1, 0);
for (const x of [8.5, 21.5]) feat('crt_billboard', x, H - 0.85, 2);
for (const x of [3, 19]) feat('share_station', x, H - 0.85, 0);
// árvores na margem oeste
for (let y = 2; y < H - 1; y += 2.5) {
  if (CANALS.some((c) => y > c.y0 - 0.3 && y < c.y1 + 0.3)) continue;
  if (BANDS.some((b) => b.rows.some((r) => Math.abs(r - y) < 0.7))) continue;
  feat('tree', 0, y, 0);
}

// ---------- bolhas gigantes flutuantes (Atmosphere) ----------
// x, y em tiles; `rot` (0–3) só varia o tamanho/fase. Não colidem com nada: flutuam no alto
// (60–90 m, acima das torres), longe dos alvos das câmeras de perto.
for (const [x, y, r] of [
  [4, 7.5, 0], [12.5, 3, 2], [24, 6, 1], [30, 12.5, 3], [17, 13, 0],
  [7, 18.5, 1], [21.5, 18, 2], [3, 26, 3], [14, 23, 1], [27.5, 22.5, 0], [10, 13.5, 2],
]) feat('orb', Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y)), r);

// ---------- semáforos: colunas internas ----------
for (const n of nodes) {
  if (n.x === XS[0] || n.x === XS[XS.length - 1]) continue;
  const touching = edges.filter((e) => e.from === n.id || e.to === n.id);
  const horiz = touching.filter((e) => nodes[e.from].y === nodes[e.to].y).map((e) => e.id);
  const vert = touching.filter((e) => nodes[e.from].x === nodes[e.to].x).map((e) => e.id);
  const main = ROW_KIND[n.y] === 'avenue' ? 36 : 30;
  n.signal = { cycle: 60, phases: [{ edges: horiz, green: main }, { edges: vert, green: 60 - main }] };
}

const city = {
  name: 'Vitrine Pucacity (teste visual)',
  size: { w: W, h: H },
  // a água cobre a largura toda da cidade
  areas: CANALS.map((c) => ({ kind: 'water', x: 0, y: +c.y0.toFixed(2), w: W, h: CANAL_H })),
  nodes, edges, crossings, buildings, districts, features,
};

writeFileSync(new URL('../src/assets/cities/vitrine.json', import.meta.url), JSON.stringify(city, null, 1) + '\n');
const count = (k) => features.filter((f) => f.kind === k).length;
console.log(`vitrine.json: ${W}×${H} tiles · ${nodes.length} nós, ${edges.length} vias, ${crossings.length} travessias ` +
  `(${crossings.filter((c) => !c.access).length} sem acesso), ${buildings.length} prédios, ${features.length} features ` +
  `(${count('air_loop')} loops, ${count('spiral_tower')} espirais, ${count('megapipe')} megapipes, ${count('bowl')} bowls, ` +
  `${count('wallride')} wallrides, ${count('quarter')} quarters, ${count('orb')} bolhas)`);
