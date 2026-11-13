import '@fontsource/varela-round';
import '@fontsource/bungee';
import '@fontsource/exo-2/700.css';
import './ui/hud.css';
import './lab.css';
import {
  Box3, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Scene, Sphere, Vector3,
} from 'three';
import GUI from 'lil-gui';
import paleta from '../data/arte/paleta.json';
import { Ps1Renderer } from './render/Renderer';
import { CATALOG, buildModel, type ModelDef } from './render/models/catalog';
import { MeshBuilder } from './render/models/MeshBuilder';
import { createPs1Material, ps1Shared, setWireframe } from './render/ps1/Ps1Material';
import { getAtlas, TILE_DESCRICAO, TILE_NAMES, TILE_PX, tileOffset } from './render/textures/Atlas';
import { COLORS, pickLook } from './render/palette';
import { LANE_LAYOUT } from './render/CityView';
import { makeRng, numParam, params } from './render/util';

/**
 * LABORATÓRIO DE ARTE — valida cada asset isoladamente (docs/validacao-visual.md).
 * ?tab=veiculos|predios|radicais|props|silhuetas|atlas|paleta  ?t=1.5 (congela o giro)  ?res=480
 */
type Tab = 'veiculos' | 'predios' | 'radicais' | 'props' | 'silhuetas' | 'atlas' | 'paleta';
const TABS: [Tab, string][] = [
  ['veiculos', 'Veículos'], ['predios', 'Prédios'], ['radicais', 'Radicais'], ['props', 'Props'],
  ['silhuetas', 'Silhuetas (densidade do jogo)'], ['atlas', 'Atlas de texturas'], ['paleta', 'Paleta'],
];
const CAT_OF: Partial<Record<Tab, ModelDef['categoria']>> = { veiculos: 'veiculo', predios: 'predio', radicais: 'radical', props: 'prop' };

const canvas = document.getElementById('view') as HTMLCanvasElement;
const r = new Ps1Renderer(canvas);
r.apply({ internalHeight: numParam('res', 480) });
const { texture, canvas: atlasCanvas } = getAtlas();
const instMat = createPs1Material({ map: texture, instanced: true });
const opaqueMat = createPs1Material({ map: texture });
const glassMat = createPs1Material({ map: texture, opacity: 0.45 });

// ---------- DOM ----------
const root = document.createElement('div');
root.className = 'lab';
root.innerHTML = `
  <header>
    <div class="gel logo"><span>PUCACITY</span></div>
    <h1>Laboratório de arte · cada asset no pipeline PS1 real · <b>G</b> abre o painel</h1>
    <nav>${TABS.map(([id, l]) => `<button class="gel" data-tab="${id}"><span>${l}</span></button>`).join('')}</nav>
  </header>
  <div class="gel summary"><span id="summary"></span></div>
  <div id="content"></div>`;
document.body.appendChild(root);
const content = root.querySelector('#content') as HTMLElement;
const summary = root.querySelector('#summary') as HTMLElement;

interface Card {
  view: HTMLElement; scene: Scene; camera: PerspectiveCamera; center: Vector3; radius: number; pitch: number; spin: boolean; yaw: number;
  /** Se definido: câmera à distância do jogo com FOV recortado → mesma densidade de pixels do jogo. */
  gameDistance?: number;
}
let cards: Card[] = [];
const lookRng = makeRng(5);
const tintables: InstancedMesh[] = [];

function vehicleMesh(id: string, count = 1): InstancedMesh {
  const geo = buildModel(id).opaque.clone();
  geo.setAttribute('iColor2', new InstancedBufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('iColor3', new InstancedBufferAttribute(new Float32Array(count * 3), 3));
  const m = new InstancedMesh(geo, instMat, count);
  for (let i = 0; i < count; i++) m.setMatrixAt(i, new Matrix4());
  recolor(m);
  tintables.push(m);
  return m;
}

function recolor(m: InstancedMesh) {
  for (let i = 0; i < m.count; i++) {
    const look = pickLook(lookRng);
    m.setColorAt(i, new Color(look.vehicle.hex));
    const c2 = new Color(look.outfit.hex), c3 = new Color(look.skin);
    (m.geometry.getAttribute('iColor2') as InstancedBufferAttribute).setXYZ(i, c2.r, c2.g, c2.b);
    (m.geometry.getAttribute('iColor3') as InstancedBufferAttribute).setXYZ(i, c3.r, c3.g, c3.b);
  }
  m.instanceColor!.needsUpdate = true;
  m.geometry.getAttribute('iColor2').needsUpdate = true;
  m.geometry.getAttribute('iColor3').needsUpdate = true;
}

function floor(scene: Scene, size: number) {
  const b = new MeshBuilder();
  b.at(0, -0.02, 0, 0, (b) => b.box(size, 0.02, size, { tile: 'sidewalk', uvScale: 2 / size, omit: ['bottom'] }));
  scene.add(new Mesh(b.build(), opaqueMat));
}

function fit(scene: Scene): { center: Vector3; radius: number } {
  const box = new Box3().setFromObject(scene);
  const s = box.getBoundingSphere(new Sphere());
  return { center: s.center, radius: Math.max(s.radius, 0.05) };
}

function card(container: HTMLElement, def: ModelDef): void {
  const geo = buildModel(def.id);
  const el = document.createElement('div');
  el.className = 'card';
  const over = geo.tris > def.budget;
  const notes: string[] = [];
  if (def.lane) notes.push(`faixa: ${def.lane}`);
  if (def.categoria === 'veiculo') notes.push('tints: veículo · roupa · pele');
  if (geo.glass) notes.push('tem vidro translúcido');
  el.innerHTML = `<div class="view"></div><div class="info">
    <span class="tris ${over ? 'over' : 'ok'}">${geo.tris} / ${def.budget} tris ${over ? '✗' : '✓'}</span>
    <div class="name">${def.nome}</div><code>${def.id}.glb</code>
    <div class="note">${notes.join(' · ')}</div></div>`;
  container.appendChild(el);
  const scene = new Scene();
  if (def.categoria === 'veiculo') scene.add(vehicleMesh(def.id));
  else {
    scene.add(new Mesh(geo.opaque, opaqueMat));
    if (geo.glass) scene.add(new Mesh(geo.glass, glassMat));
  }
  const { center, radius } = fit(scene);
  floor(scene, radius * 3);
  const camera = new PerspectiveCamera(30, 1, 0.01, 200);
  cards.push({ view: el.querySelector('.view')!, scene, camera, center, radius, pitch: 0.42, spin: true, yaw: 0.6 });
}

const ZOOMS: [string, number][] = [['perto', 5], ['médio', 11], ['visão geral', 23]];

function silhouettes(container: HTMLElement) {
  const scene = silhouetteScene();
  for (const [label, dist] of ZOOMS) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="view" style="height:150px"></div><div class="info"><div class="name">Zoom ${label} · câmera a ${dist} tiles</div>
      <div class="note">Mesma densidade de pixels do jogo em 240 linhas. Cada tipo deve ser reconhecível pela forma, sem depender da cor.</div></div>`;
    container.appendChild(el);
    const camera = new PerspectiveCamera(38, 1, 0.1, 200);
    cards.push({ view: el.querySelector('.view')!, scene, camera, center: new Vector3(0, 0, 0.05), radius: 1, pitch: 0.95, spin: false, yaw: 0, gameDistance: dist });
  }
}

function silhouetteScene(): Scene {
  const scene = new Scene();
  // trecho de via com as faixas
  const b = new MeshBuilder();
  const L = 9;
  for (const l of LANE_LAYOUT) {
    const tile = l.kind === 'sidewalk' ? 'sidewalk' : l.kind === 'slow' ? 'lane_slow' : l.kind === 'fast' ? 'lane_fast' : 'lane_transit';
    b.quadXYZ([-L / 2, 0.01, l.o0], [L / 2, 0.01, l.o0], [L / 2, 0.01, l.o1], [-L / 2, 0.01, l.o1], { tile, uvScale: 1 }, [0, 1, 0]);
  }
  scene.add(new Mesh(b.build(), opaqueMat));
  const vehicles = CATALOG.filter((d) => d.categoria === 'veiculo');
  const OFF: Record<string, number> = { sidewalk: 0.4, slow: 0.24, fast: 0.12, transit: 0.0 };
  const gap = 0.48;
  vehicles.forEach((d, i) => {
    const m = vehicleMesh(d.id);
    const x = (i - (vehicles.length - 1) / 2) * gap;
    m.setMatrixAt(0, new Matrix4().makeRotationY(Math.PI / 2).setPosition(x, 0.012, OFF[d.lane ?? 'fast']));
    scene.add(m);
  });
  return scene;
}

function crowd(container: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<div class="view"></div><div class="info"><div class="name">Multidão sorteada pelas regras da paleta</div>
    <div class="note">Máx. 1 neon por cidadão · roupa nunca neon se o veículo for · 6 tons de pele. Use “Sortear cores” no painel.</div></div>`;
  container.appendChild(el);
  const scene = new Scene();
  const ids = ['veh_skate', 'veh_pedestrian', 'veh_kick_scooter', 'veh_hoverboard', 'veh_wheelchair', 'veh_bmx'];
  ids.forEach((id, row) => {
    const m = vehicleMesh(id, 8);
    for (let i = 0; i < 8; i++) m.setMatrixAt(i, new Matrix4().makeRotationY(0.4).setPosition(i * 0.3 - 1.05, 0, row * 0.32 - 0.8));
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
  });
  floor(scene, 3.5);
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);
  cards.push({ view: el.querySelector('.view')!, scene, camera, center: new Vector3(0, 0.1, 0), radius: 1.15, pitch: 0.7, spin: false, yaw: 0.25 });
}

function atlasView(container: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.className = 'atlas';
  for (const name of TILE_NAMES) {
    const [u, v] = tileOffset(name);
    const c = document.createElement('canvas');
    c.width = c.height = TILE_PX;
    c.getContext('2d')!.drawImage(atlasCanvas, u * atlasCanvas.width, (1 - v) * atlasCanvas.height - TILE_PX, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
    const f = document.createElement('figure');
    f.appendChild(c);
    f.insertAdjacentHTML('beforeend', `<figcaption><code>${name}</code><br>${TILE_DESCRICAO[name]}</figcaption>`);
    wrap.appendChild(f);
  }
  container.appendChild(wrap);
}

function paletteView(container: HTMLElement) {
  const sw = (hex: string, nome: string, sub: string) => `<div class="sw"><i style="background:${hex}"></i><div><b>${nome}</b>${hex} · ${sub}</div></div>`;
  let html = `<h2>Mundo (${Object.keys(paleta.mundo).length} cores-base · limite ≤ 32)</h2><div class="swatches">` +
    Object.entries(paleta.mundo).map(([k, v]) => sw(v, k, 'base')).join('') + '</div>';
  for (const fam of ['aero', 'neon', 'rua', 'base'] as const) {
    const cs = COLORS.filter((c) => c.familia === fam);
    html += `<h2>Variação · ${fam} (${cs.length})</h2><div class="swatches">` + cs.map((c) => sw(c.hex, c.nome, c.familia)).join('') + '</div>';
  }
  container.insertAdjacentHTML('beforeend', html);
  const g = document.createElement('div');
  g.className = 'grid wide';
  container.appendChild(g);
  crowd(g);
}

function show(tab: Tab) {
  cards = [];
  tintables.length = 0;
  content.innerHTML = '';
  root.querySelectorAll<HTMLElement>('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const cat = CAT_OF[tab];
  if (cat) {
    const defs = CATALOG.filter((d) => d.categoria === cat);
    const g = document.createElement('div');
    g.className = 'grid';
    content.appendChild(g);
    defs.forEach((d) => card(g, d));
    const over = defs.filter((d) => buildModel(d.id).tris > d.budget);
    const tris = defs.map((d) => buildModel(d.id).tris);
    summary.innerHTML = `<b>${defs.length}</b> modelos · orçamento SPEC <b>${defs[0].budget}</b> tris · ` +
      `min <b>${Math.min(...tris)}</b> / máx <b>${Math.max(...tris)}</b> · ` +
      (over.length ? `<b style="color:#e8322c">${over.length} acima do orçamento: ${over.map((d) => d.id).join(', ')}</b>` : '<b style="color:#1e8e5a">todos dentro do orçamento ✓</b>');
  } else if (tab === 'silhuetas') {
    const g = document.createElement('div');
    g.className = 'grid wide';
    content.appendChild(g);
    silhouettes(g);
    summary.innerHTML = 'Teste de legibilidade: resolução <b>240</b>, câmera e FOV do jogo. Da esquerda p/ direita: ' +
      CATALOG.filter((d) => d.categoria === 'veiculo').map((d) => d.nome.split(' (')[0]).join(' · ');
    r.apply({ internalHeight: 240 });
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  } else if (tab === 'atlas') {
    atlasView(content);
    summary.innerHTML = `Atlas procedural <b>${atlasCanvas.width}×${atlasCanvas.height}</b> = 16 tiles de <b>${TILE_PX}×${TILE_PX}</b>, sem filtragem (NearestFilter), desenhado em código (sem assets de terceiros).`;
  } else {
    paletteView(content);
    summary.innerHTML = `Paleta de <b>data/arte/paleta.json</b>: ${Object.keys(paleta.mundo).length} cores de mundo + <b>${COLORS.length}</b> cores de variação.`;
  }
  history.replaceState(null, '', `?tab=${tab}${params.has('t') ? `&t=${params.get('t')}` : ''}`);
}

// ---------- Painel ----------
const settings = r.settings;
const ui = { girar: true, desaturar: false, wireframe: false, sortear: () => tintables.forEach(recolor) };
const gui = new GUI({ title: 'Laboratório (G)' });
gui.add(settings, 'ps1').name('Efeitos PS1').onChange(() => r.resize());
gui.add(settings, 'internalHeight', [240, 360, 480, 720, 1080]).name('Resolução interna').onChange(() => r.resize());
gui.add(settings, 'jitter', 0, 2, 0.1).name('Vertex jitter').onChange(() => r.resize());
gui.add(settings, 'affine', 0, 1, 0.05).name('Affine').onChange(() => r.resize());
gui.add(settings, 'dither', 0, 2, 0.1).name('Dither').onChange(() => r.resize());
gui.add(settings, 'quantize15bit').name('Cor 15-bit').onChange(() => r.resize());
gui.add(ui, 'girar').name('Girar modelos');
gui.add(ui, 'wireframe').name('Wireframe').onChange(setWireframe);
gui.add(ui, 'desaturar').name('Desaturar (overlay)').onChange((v: boolean) => (ps1Shared.uDesat.value = v ? 0.85 : 0));
gui.add(ui, 'sortear').name('Sortear cores');
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'g') gui.show(gui._hidden); });

root.querySelectorAll<HTMLElement>('nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab as Tab)));
ps1Shared.uFogNear.value = 500;
ps1Shared.uFogFar.value = 1000;
show((params.get('tab') as Tab) ?? 'veiculos');

// ---------- Loop ----------
const frozen = params.has('t') ? numParam('t', 0) : null;
let time = frozen ?? 0;
let last = performance.now();
let frames = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (frozen === null && ui.girar) time += dt;
  r.begin(0xcfe9ff);
  for (const c of cards) {
    const rect = c.view.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight || rect.width < 2) continue;
    const yaw = c.yaw + (c.spin ? time * 0.6 : 0);
    if (c.gameDistance) c.camera.fov = 38 * (rect.height / innerHeight); // fatia do FOV do jogo
    const d = c.gameDistance ?? (c.radius / Math.sin((c.camera.fov * Math.PI) / 360)) * 1.05;
    c.camera.position.set(
      c.center.x + Math.sin(yaw) * Math.cos(c.pitch) * d,
      c.center.y + Math.sin(c.pitch) * d,
      c.center.z + Math.cos(yaw) * Math.cos(c.pitch) * d,
    );
    c.camera.lookAt(c.center);
    c.camera.aspect = rect.width / rect.height;
    c.camera.updateProjectionMatrix();
    r.draw(c.scene, c.camera, { x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  }
  r.end();
  if (++frames === 3) (window as unknown as { __ready: boolean }).__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Relatório de orçamento no console (útil em CI/revisão)
console.table(CATALOG.map((d) => ({ id: d.id, tris: buildModel(d.id).tris, budget: d.budget, ok: buildModel(d.id).tris <= d.budget })));
