// Gera src/assets/cities/vitrine.json: cidade de teste VISUAL (não é cenário de jogo).
// "Metrópole Aero": 4 faixas de cidade separadas por 3 canais. De norte a sul: Vila Concreto +
// Centro Gel, a ilha da Orla Bolha, Morro Alto + Pátio Industrial e, na faixa sul (mais alta,
// sem ruas internas), o Parque Aero e o Distrito Eólico com os marcos gigantes (landmarks.ts).
// Uso: node scripts/gen-vitrine.mjs
//
// Contrato (src/core/types.ts): 1 tile = 10 m; edge.width em metros; edge.speed em km/h;
// ownership em %; água em `areas` (kind 'water'); travessias vão de `from` (norte) para `to` (sul).
// Prédios: `model` é livre; aqui também usamos marcos (lmk_*), o Vulcão de Gel (rad_volcano) e
// os dinossauros (prop_dino_*) como `buildings` de `kind: 'park'` (o CityView desenha qualquer
// id do catálogo).
//
// Geometria que o render supõe (CityView/DemoTraffic):
// - o link da travessia mede 6 tiles e o canal (2,4 tiles) fica exatamente no meio dele;
// - a água cobre a largura toda da cidade;
// - nada (prédio, marco ou feature) em cima de vias, travessias, rampas, canais ou do Elevador de Bolha.
// O gerador confere essas regras e FALHA se algo se sobrepõe.
import { writeFileSync } from 'node:fs';

// ---------- grade ----------
const XS = [1, 6, 11, 16, 21, 26, 31, 36, 41, 46]; // colunas a cada 5 tiles
const BANDS = [
  { name: 'norte', rows: [1, 5] },
  { name: 'ilha', rows: [11, 15] },
  { name: 'sul', rows: [21, 25] },
  // faixa dos marcos: 8 tiles de altura e ruas verticais só em algumas colunas (superquadras)
  { name: 'marcos', rows: [31, 39], cols: [1, 21, 36, 46] },
];
const W = 48;
const H = 41;
const CANAL_H = 2.4;
const last = (a) => a[a.length - 1];
// canal centrado entre a última linha de uma faixa e a primeira da seguinte (link de 6 tiles)
const CANALS = BANDS.slice(0, -1).map((band, k) => {
  const a = last(band.rows), b = BANDS[k + 1].rows[0];
  if (b - a !== 6) throw new Error('o link da travessia precisa medir 6 tiles');
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
const ROW_KIND = { 1: 'avenue', 5: 'boulevard', 11: 'boulevard', 15: 'street', 21: 'boulevard', 25: 'avenue', 31: 'boulevard', 39: 'avenue' };
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
    if (band.cols && !band.cols.includes(x)) continue;
    edge(N(x, band.rows[0]), N(x, last(band.rows)), 'street', !band.cols && (i === XS.length - 1 || i === 3) ? NO_FAST : FULL);
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
    const noAccess = (k === 0 && i === 6) || (k === 1 && i === 2);
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
  { id: 1, name: 'Centro Gel', income: 'high', population: 5200, wheelchairShare: 0.03,
    ownership: { e_scooter: 40, hoverboard: 30, e_unicycle: 15, longboard: 20 } },
  { id: 2, name: 'Orla Bolha', income: 'mid', population: 5600, wheelchairShare: 0.05,
    ownership: { longboard: 35, skates: 30, skate: 30, kick_scooter: 20 } },
  { id: 3, name: 'Pátio Industrial', income: 'low', population: 2600, wheelchairShare: 0.04,
    ownership: { bmx: 35, skate: 30, e_scooter: 10 } },
  { id: 4, name: 'Morro Alto', income: 'mid', population: 3000, wheelchairShare: 0.06,
    ownership: { e_unicycle: 20, longboard: 25, skate: 25, wheelchair_powered: 4, kick_scooter: 20 } },
  { id: 5, name: 'Parque Aero', income: 'mid', population: 900, wheelchairShare: 0.06,
    ownership: { skates: 35, longboard: 30, kick_scooter: 25, wheelchair_powered: 6 } },
  { id: 6, name: 'Distrito Eólico', income: 'high', population: 2400, wheelchairShare: 0.04,
    ownership: { e_scooter: 35, hoverboard: 35, e_unicycle: 20, longboard: 15 } },
];
const D = { vila: 0, centro: 1, orla: 2, patio: 3, morro: 4, parque: 5, eolico: 6 };

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
  // marcos gigantes: pegadas documentadas em src/render/models/landmarks.ts
  lmk_orb_tower: [-1.6, -1.6, 1.6, 1.6],
  lmk_biodome: [-3.2, -3.2, 3.2, 3.2],
  lmk_bubble_wheel: [-3.55, -0.55, 3.55, 0.55],
  lmk_aqueduct: [-4.75, -0.4, 4.75, 0.95],
  lmk_wind_turbine: [-1.65, -0.45, 1.65, 0.75],
  lmk_drop_tower: [-2.45, -2.45, 2.45, 2.45],
  lmk_leaf_pavilion: [-2.1, -2.1, 2.1, 2.1],
  lmk_rainbow_ramp: [-4.25, -0.75, 4.25, 0.75],
  lmk_lawn: [-3, -3, 3, 3],
  rad_volcano: [-0.88, -0.88, 0.88, 1.05], // inclui a rampa da encosta (+z local)
  prop_dino_neck: [-0.15, -0.5, 0.15, 0.42],
  prop_dino_runner: [-0.1, -0.42, 0.1, 0.25],
  prop_dino_horns: [-0.2, -0.38, 0.2, 0.33],
};
const placed = [];
const grounds = [];
function box(kind, x, y, rot) {
  const e = EXTENT[kind] ?? EXTENT.building;
  const t = (rot * Math.PI) / 2, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  // mesma rotação do three (makeRotationY): x' = x cos + z sin ; z' = -x sin + z cos
  const pts = [[e[0], e[1]], [e[2], e[1]], [e[2], e[3]], [e[0], e[3]]].map(([lx, lz]) => [x + lx * c + lz * s, y - lx * s + lz * c]);
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}
const hit = (a, b) => a[0] < b[2] - 1e-6 && b[0] < a[2] - 1e-6 && a[1] < b[3] - 1e-6 && b[1] < a[3] - 1e-6;
function checkGround(what, b, x, y, onRoad) {
  if (b[0] < -0.5 || b[2] > W - 1.5 || b[1] < -0.5 || b[3] > H - 0.5) throw new Error(`${what} (${x}, ${y}) sai do chão da cidade`);
  for (const r of onRoad ? reserved.filter((r) => r.what === 'canal') : reserved) {
    if (hit(b, r.box)) throw new Error(`${what} (${x}, ${y}) está em cima de ${r.what}`);
  }
}
function occupy(what, kind, x, y, rot, onRoad = false) {
  const b = box(kind, x, y, rot);
  checkGround(what, b, x, y, onRoad);
  for (const p of placed) if (hit(b, p.box)) throw new Error(`${what} (${x}, ${y}) sobrepõe ${p.what} (${p.at})`);
  placed.push({ what, box: b, at: `${x}, ${y}` });
}
/** Chão (gramado): não pode ir para cima de via/canal nem de outro chão, mas aceita objetos em cima. */
function occupyGround(what, kind, x, y, rot) {
  const b = box(kind, x, y, rot);
  checkGround(what, b, x, y, false);
  for (const p of grounds) if (hit(b, p.box)) throw new Error(`${what} (${x}, ${y}) sobrepõe ${p.what}`);
  grounds.push({ what, box: b });
}

// ---------- prédios ----------
const buildings = [];
let bid = 0;
const CAP = { res: 40, com: 150, ind: 80, school: 300, hospital: 120, park: 0, skatepark: 20 };
const isBig = (m) => m.startsWith('lmk_') || m.startsWith('rad_') || m.startsWith('prop_');
function bld(x, y, kind, model, rotation, district, capacity = CAP[kind]) {
  const ext = EXTENT[model] ? model : 'building';
  if (model === 'lmk_lawn') occupyGround(model, ext, x, y, rotation);
  else occupy(model, ext, x, y, rotation);
  buildings.push({ id: bid++, x, y, kind, capacity, model, rotation, district });
}
const KIND_OF = (m) => m.startsWith('bld_res') ? 'res' : m.startsWith('bld_com') ? 'com' : m.startsWith('bld_ind') ? 'ind'
  : m === 'bld_park' || isBig(m) ? 'park' : m === 'bld_skatepark' ? 'skatepark' : m === 'bld_school' ? 'school' : 'hospital';
/** Marco, vulcão ou dinossauro posicionado como prédio de parque. */
const mark = (model, x, y, rot, district) => bld(x, y, KIND_OF(model), model, rot, district);

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
// prédio de bairro (parque/skatepark) no miolo, entre as fileiras
const midBld = (model) => (cx, cy, d) => bld(cx, cy, KIND_OF(model), model, 0, d);
// quarter-pipes nas bordas da praça, de costas para a via
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
block(31, n0, D.centro, [C1, C3, C1, C2], [C3, null, PK, C1], trees(1));
block(36, n0, D.centro, [C3, null, null, C1], [C1, null, null, C3], plaza('megapipe', 0));
block(41, n0, D.centro, [C2, null, null, C1], [C1, null, null, C2], plaza('bowl', 0));

// Ilha (linhas 11–15): Orla Bolha
const [i0] = BANDS[1].rows;
block(1, i0, D.orla, [R3, C3, R1, R2], [R1, null, null, R3], midBld(PK));
block(6, i0, D.orla, [C2, R3, R3, C3], [R2, null, null, HO], trees(2));
block(11, i0, D.orla, [R3, null, null, PK], [C2, null, null, PK], plaza('megapipe', 0));
block(16, i0, D.orla, [C3, R1, SC, R3], [R3, null, null, C2], plaza('wallride', 1));
block(21, i0, D.orla, [R2, C2, R3, R1], [C3, null, null, R1], midBld(SK));
block(26, i0, D.orla, [R3, null, null, C3], [R1, null, null, C2], plaza('bowl', 0));
block(31, i0, D.orla, [R3, C3, R1, R2], [R1, null, null, R3], midBld(PK));
block(36, i0, D.orla, [R2, null, null, C3], [C2, null, null, R1], plaza('spiral_tower', 0));
block(41, i0, D.orla, [C3, R1, SC, R3], [R3, null, null, C2], plaza('wallride', 1));

// Sul (linhas 21–25): Morro Alto a oeste, Pátio Industrial a leste
const [s0] = BANDS[2].rows;
block(1, s0, D.morro, [R2, null, null, R2], [PK, null, null, PK], plaza('spiral_tower', 0));
block(6, s0, D.morro, [R2, HO, R1, R2], [R3, null, null, R2], midBld(PK));
block(11, s0, D.morro, [R1, R2, R3, R2], [R2, null, null, SC], plaza('wallride', 1));
block(16, s0, D.patio, [I1, null, null, I1], [I1, null, null, I1], plaza('bowl', 0));
block(21, s0, D.patio, [I1, null, null, SK], [I1, null, null, SK], plaza('megapipe', 0));
block(26, s0, D.patio, [I1, I1, R1, I1], [I1, null, SK, I1], trees(1));
block(31, s0, D.patio, [I1, null, null, I1], [SK, null, null, I1], plaza('spiral_tower', 0));
block(36, s0, D.patio, [I1, I1, R1, I1], [I1, null, SK, I1], trees(1));
block(41, s0, D.patio, [I1, null, null, I1], [I1, null, null, SK], plaza('bowl', 0));

// ---------- faixa dos marcos (linhas 31–39) ----------
// Gramados primeiro (chão): os marcos, dinos e árvores ficam em cima deles. Os vértices do
// gramado (a cada 1 tile a partir do centro ± 3) caem na malha do chão do CityView, que começa
// em x = -0,5 e, nesta faixa, em z = borda sul do canal; senão o vertex snapping faz z-fighting.
const lawnZ = CANALS[CANALS.length - 1].y1 + 6;
const lawn = (x, district) => {
  if (Math.abs(((x + 0.5) % 1 + 1) % 1) > 1e-6) throw new Error(`gramado em x=${x} fora da grade do chão`);
  mark('lmk_lawn', x, +lawnZ.toFixed(2), 0, district);
};
for (const x of [5.5, 11.5, 17.5]) lawn(x, D.parque);
for (const x of [25.5, 31.5, 41.5]) lawn(x, D.eolico);

// Parque Aero (superquadra x 1–21): Biosfera, Roda-Gigante, Rampa Arco-Íris, Pavilhão Folha,
// Vulcão de Gel e dinossauros passeando pelo gramado.
mark('lmk_biodome', 5, 35, 0, D.parque);
mark('lmk_bubble_wheel', 12.5, 33.1, 0, D.parque);
mark('lmk_rainbow_ramp', 12.5, 37.4, 0, D.parque);
mark('lmk_leaf_pavilion', 18.3, 34, 0, D.parque);
mark('rad_volcano', 18.7, 37.55, 2, D.parque);
mark('prop_dino_neck', 10.2, 35.1, 1, D.parque);
mark('prop_dino_runner', 12.4, 34.7, 3, D.parque);
mark('prop_dino_horns', 14.1, 35.6, 1, D.parque);
mark('prop_dino_runner', 15.5, 34.5, 0, D.parque);
mark('prop_dino_neck', 17.1, 37.9, 0, D.parque);
mark('prop_dino_horns', 8.55, 34.3, 2, D.parque);
for (const [x, y] of [[8.7, 35.6], [8.6, 36.3], [15.9, 32.0], [11.2, 35.9], [13.6, 34.3], [20.1, 36.4]]) feat('tree', x, y, 0);
for (const [x, y] of [[9.1, 36.3], [15.9, 33.9]]) feat('bench', x, y, 0);
for (const [x, y] of [[8.6, 32.0], [16.7, 36.4]]) feat('lamp', x, y, 0);

// Distrito Eólico (x 21–46): Turbinas Aero na beira do canal e nos gramados, o Aqueduto
// cruzando a superquadra e as torres Orbe e Gota no skyline.
mark('lmk_orb_tower', 24.4, 33.4, 0, D.eolico);
mark('lmk_aqueduct', 28.6, 37.4, 0, D.eolico);
mark('lmk_drop_tower', 41, 34.2, 0, D.eolico);
mark('lmk_wind_turbine', 29.4, 32.6, 0, D.eolico);
mark('lmk_wind_turbine', 33.4, 34.9, 0, D.eolico);
mark('lmk_wind_turbine', 38.6, 37.75, 0, D.eolico);
mark('lmk_wind_turbine', 43.6, 37.75, 0, D.eolico);
// na margem sul do canal (entre as travessias), de frente para o bairro
for (const x of XS.slice(4, -1)) mark('lmk_wind_turbine', x + 2.72, 29.7, 0, D.eolico);
for (const [x, y] of [[26.9, 35.4], [22.3, 35.7], [35.0, 32.2], [37.4, 32.3], [44.8, 32.3], [34.8, 37.0]]) feat('tree', x, y, 0);
for (const [x, y] of [[27.2, 33.6], [31.6, 35.7]]) feat('bench', x, y, 0);

// ---------- Loops Aéreos nas avenidas (só a faixa rápida para leste dá a volta) ----------
for (const [x, y] of [[8.5, 1], [18.5, 1], [38.5, 1], [13.5, 25], [28.5, 25], [43.5, 25], [8.5, 39], [28.5, 39], [43.5, 39]]) {
  feat('air_loop', x, y, 1, true);
}

// ---------- quarter-pipes em volta das praças radicais ----------
for (const [cx, cy] of [
  [13.5, 3], [28.5, 3], [38.5, 3], [43.5, 3], [13.5, 13], [28.5, 13], [38.5, 13],
  [18.5, 23], [23.5, 23], [3.5, 23], [33.5, 23], [43.5, 23],
]) {
  // na borda norte/sul do miolo, centralizados (longe das vias e dos prédios de canto)
  quarters(cx, cy);
}

// ---------- beira-canal: postes, árvores, bancos, paradas e estações ----------
for (const [k, canal] of CANALS.entries()) {
  for (const [side, roadY] of [[-1, canal.a], [1, canal.b]]) {
    const yLamp = roadY - side * 0.62, yTree = side < 0 ? (roadY + 0.5 + canal.y0) / 2 : (canal.y1 + roadY - 0.5) / 2;
    for (const [i, x] of XS.slice(0, -1).entries()) {
      if (k === CANALS.length - 1 && side > 0 && x >= 21) continue; // margem das turbinas
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
// estações de compartilhamento, painéis CRT e paradas nas bordas da cidade
for (const x of [3.5, 18.5, 28.5, 43.5]) feat('share_station', x, 0.0, 2);
for (const x of [6.5, 23.5, 33.5]) feat('crt_billboard', x, 0.1, 0);
for (const x of [6.5, 21.5, 36.5]) feat('crt_billboard', x, H - 0.85, 2);
for (const x of [3, 19, 33.5, 45]) feat('share_station', x, H - 0.85, 0);
for (const x of [11, 16, 24, 41]) feat('stop_shelter', x, 39.72, 0);
// árvores na margem oeste
for (let y = 2; y < H - 1; y += 2.5) {
  if (CANALS.some((c) => y > c.y0 - 0.3 && y < c.y1 + 0.3)) continue;
  if (BANDS.some((b) => b.rows.some((r) => Math.abs(r - y) < 0.7))) continue;
  feat('tree', 0, y, 0);
}

// ---------- bolhas gigantes flutuantes (Atmosphere) ----------
// x, y em tiles; `rot` (0–3) só varia o tamanho/fase. Não colidem com nada: flutuam no alto
// (60–90 m, acima das torres comuns), longe dos alvos das câmeras de perto e dos marcos altos
// (Torre Orbe, Torre Gota, Roda-Gigante e turbinas).
for (const [x, y, r] of [
  [4, 7.5, 0], [12.5, 3, 2], [24, 6, 1], [30, 12.5, 3], [17, 13, 0], [7, 18.5, 1], [21.5, 18, 2],
  [3, 26, 3], [14, 23, 1], [27.5, 22.5, 0], [10, 13.5, 2], [36, 7.5, 1], [44, 12, 2], [40, 19, 0],
  [34, 24.5, 3], [46, 4, 1], [5, 38, 2], [18, 31.5, 0],
]) feat('orb', Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y)), r);

// ---------- semáforos: colunas internas com cruzamento de verdade ----------
for (const n of nodes) {
  if (n.x === XS[0] || n.x === last(XS)) continue;
  const touching = edges.filter((e) => e.from === n.id || e.to === n.id);
  const horiz = touching.filter((e) => nodes[e.from].y === nodes[e.to].y).map((e) => e.id);
  const vert = touching.filter((e) => nodes[e.from].x === nodes[e.to].x).map((e) => e.id);
  if (!horiz.length || !vert.length) continue;
  const main = ROW_KIND[n.y] === 'avenue' ? 36 : 30;
  n.signal = { cycle: 60, phases: [{ edges: horiz, green: main }, { edges: vert, green: 60 - main }] };
}

const city = {
  name: 'Vitrine Pucacity — Metrópole Aero (teste visual)',
  size: { w: W, h: H },
  // a água cobre a largura toda da cidade
  areas: CANALS.map((c) => ({ kind: 'water', x: 0, y: +c.y0.toFixed(2), w: W, h: CANAL_H })),
  nodes, edges, crossings, buildings, districts, features,
};

writeFileSync(new URL('../src/assets/cities/vitrine.json', import.meta.url), JSON.stringify(city, null, 1) + '\n');
const count = (k) => features.filter((f) => f.kind === k).length;
const marcos = buildings.filter((b) => b.model.startsWith('lmk_') && b.model !== 'lmk_lawn').length;
console.log(`vitrine.json: ${W}×${H} tiles · ${CANALS.length} canais · ${nodes.length} nós, ${edges.length} vias, ${crossings.length} travessias ` +
  `(${crossings.filter((c) => !c.access).length} sem acesso), ${buildings.length} prédios (${marcos} marcos, ` +
  `${buildings.filter((b) => b.model === 'lmk_lawn').length} gramados, ${buildings.filter((b) => b.model.startsWith('prop_dino')).length} dinos), ` +
  `${features.length} features (${count('air_loop')} loops, ${count('spiral_tower')} espirais, ${count('megapipe')} megapipes, ` +
  `${count('bowl')} bowls, ${count('wallride')} wallrides, ${count('quarter')} quarters, ${count('orb')} bolhas, ` +
  `${count('tree')} árvores, ${count('stop_shelter')} paradas)`);
