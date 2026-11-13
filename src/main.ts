import '@fontsource/varela-round';
import '@fontsource/bungee';
import '@fontsource/exo-2/700.css';
import { Group, Plane, Raycaster, Scene, Vector2, Vector3 } from 'three';
import GUI from 'lil-gui';
import cityJson from './assets/cities/vitrine.json';
import type { CityFile } from './core/CityFile';
import { crossingIsAccessible, waterBands } from './core/CityFile';
import { Ps1Renderer } from './render/Renderer';
import { CityView } from './render/CityView';
import { DemoTraffic } from './render/DemoTraffic';
import { Atmosphere } from './render/Atmosphere';
import { CameraRig } from './render/CameraRig';
import { ps1Shared, setWireframe } from './render/ps1/Ps1Material';
import { Hud, type OverlayMode } from './ui/hud';
import { ToolController, type PickTarget } from './ui/tools';
import { CommandStack } from './core/Commands';
import { LinesView } from './render/LinesView';
import type { Object3D, Mesh } from 'three';
import { numParam, params } from './render/util';

/**
 * VITRINE VISUAL — página de validação da direção de arte (docs/validacao-visual.md).
 * Parâmetros de URL: ?cam=overview|canal|canal2|ilha|loop|bowl|street|towers|spiral|megapipe|parque|eolico|marcos
 *                    ?overlay=traffic|access  ?ps1=0  ?t=8 (congela após 8 s simulados)  ?hud=0
 *                    ?agents=1600  ?res=240
 */
let city = cityJson as unknown as CityFile;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const r = new Ps1Renderer(canvas);
r.apply({ internalHeight: numParam('res', 240), ps1: params.get('ps1') !== '0' });

const scene = new Scene();
let view = new CityView(city);
scene.add(view.group);
const center = new Vector3(city.size.w / 2 - 0.5, 0, city.size.h / 2 - 0.5);
const atmo = new Atmosphere(
  center,
  waterBands(city).map((c) => ({ ...c, x0: -25, x1: city.size.w + 25 })),
  (city.features ?? []).filter((f) => f.kind === 'orb').map((f) => ({ x: f.x, z: f.y, rot: f.rot })),
  Math.hypot(city.size.w, city.size.h) / 2,
);
scene.add(atmo.group);

const hud = new Hud();
let lastTrick = 0;
let simTime = 0;
const AGENTS = numParam('agents', 1600);
const trafficGroup = new Group();
scene.add(trafficGroup);
function makeTraffic(c: CityFile, v: CityView): DemoTraffic {
  const t = new DemoTraffic(c, v, AGENTS, 7, {
    onTrick: (txt) => { if (simTime - lastTrick > 3) { lastTrick = simTime; hud.trick(txt); } },
  });
  for (const m of t.meshes.values()) trafficGroup.add(m);
  trafficGroup.add(t.cabins);
  const glass = t.cabinGlass();
  if (glass) trafficGroup.add(glass);
  return t;
}
let traffic = makeTraffic(city, view);

// Ferramentas do jogador: CommandStack do core (custo, validação, undo/redo) + painel em gel
const stack = new CommandStack(city, { money: city.scenario?.budget ?? 48250 });
const linesView = new LinesView();
scene.add(linesView.group);
function disposeTree(o: Object3D) {
  o.traverse((x) => { const m = x as Mesh; if (m.isMesh) m.geometry.dispose(); });
}
/** A cidade mudou por uma ferramenta: redesenha vias/travessias e reinicia o trânsito de demonstração. */
function rebuildWorld(c: CityFile) {
  city = c;
  scene.remove(view.group);
  disposeTree(view.group);
  view = new CityView(city);
  scene.add(view.group);
  for (const ch of [...trafficGroup.children]) { trafficGroup.remove(ch); disposeTree(ch); }
  traffic = makeTraffic(city, view);
  view.overlay.visible = overlay === 'traffic';
  view.accessOverlay.visible = overlay === 'access';
}
const tools = new ToolController(stack, {
  onChange: (c, lines) => {
    if (c !== city) rebuildWorld(c);
    linesView.update(c, lines);
    syncTools();
    updateKpis();
  },
  toast: (txt, good) => hud.trick(txt, !good),
  onActive: () => syncTools(),
  day: () => 3,
});
function syncTools() { hud.setTools(tools.active, stack.canUndo, stack.canRedo); }
hud.onTool = (k) => { hud.showPanel(null); tools.activate(k); };
hud.onUndo = () => tools.undo();
hud.onRedo = () => tools.redo();

// Câmera e presets
const rig = new CameraRig(canvas);
// [alvo, distância, yaw, pitch] para a Metrópole Aero de 48×41 tiles (3 canais; marcos na faixa sul)
type Preset = [Vector3, number, number, number];
const OVERVIEW: Preset = [center.clone().setZ(center.z + 1.5), 64, 0, 0.95];
const PRESETS: Record<string, Preset> = {
  overview: OVERVIEW,
  canal: [new Vector3(8.5, 0, 8), 10, 0.55, 0.5],
  canal2: [new Vector3(18.5, 0, 18), 10, -0.5, 0.5],
  ilha: [new Vector3(16, 0, 13), 20, 0.35, 0.75],
  loop: [new Vector3(8.5, 0.5, 1), 8, 2.5, 0.38],
  bowl: [new Vector3(18.5, 0, 23), 8, 0.4, 0.7],
  street: [new Vector3(13.3, 0, 5.4), 4.2, 0.35, 0.5],
  towers: [new Vector3(18.5, 1, 3), 13, 3.4, 0.35],
  spiral: [new Vector3(28.6, 0.6, 3), 6.5, 0.55, 0.32],
  megapipe: [new Vector3(13.5, 0.3, 13), 6, 1.25, 0.4],
  parque: [new Vector3(11.5, 1.5, 35), 21, 0.35, 0.5],
  eolico: [new Vector3(33.5, 2.5, 34), 22, -0.45, 0.42],
  marcos: [new Vector3(24, 4, 33), 41, 0.1, 0.24],
};
rig.set(...(PRESETS[params.get('cam') ?? 'overview'] ?? OVERVIEW));

// Névoa acompanha a distância da câmera: perto fica densa (clima PS1), na visão geral só o horizonte some.
const fogAuto = { on: true };
function updateFog() {
  if (!fogAuto.on) return;
  const d = rig.distance;
  ps1Shared.uFogNear.value = Math.max(18, d * 1.05);
  ps1Shared.uFogFar.value = Math.max(42, d * 2.4);
}
updateFog();

// Overlays
let overlay: OverlayMode = 'none';
function setOverlay(m: OverlayMode) {
  overlay = overlay === m && m !== 'none' ? 'none' : m;
  view.overlay.visible = overlay === 'traffic';
  view.accessOverlay.visible = overlay === 'access';
  ps1Shared.uDesat.value = overlay === 'none' ? 0 : 0.85;
  hud.setOverlay(overlay);
  if (overlay === 'traffic') view.paintTraffic(traffic.occupancy());
}
hud.onOverlay = setOverlay;
hud.setBadge(true);

// Velocidade / pausa
let speed = 1;
let paused = false;
hud.onSpeed = (s) => (speed = s);

// Painel de debug visual (G)
const settings = r.settings;
const gui = new GUI({ title: 'Visual PS1 (G)' });
const fx = gui.addFolder('Pipeline PS1');
fx.add(settings, 'ps1').name('Efeitos PS1').onChange(() => r.resize());
fx.add(settings, 'internalHeight', [240, 360, 480, 720]).name('Resolução interna').onChange(() => r.resize());
fx.add(settings, 'jitter', 0, 2, 0.1).name('Vertex jitter').onChange(() => r.resize());
fx.add(settings, 'affine', 0, 1, 0.05).name('Affine warping').onChange(() => r.resize());
fx.add(settings, 'dither', 0, 2, 0.1).name('Dither').onChange(() => r.resize());
fx.add(settings, 'quantize15bit').name('Cor 15-bit').onChange(() => r.resize());
const fog = gui.addFolder('Névoa');
fog.add(fogAuto, 'on').name('Automática (pela distância)');
fog.add(ps1Shared.uFogNear, 'value', 0, 200, 1).name('Início').listen();
fog.add(ps1Shared.uFogFar, 'value', 5, 400, 1).name('Fim').listen();
const dbg = gui.addFolder('Debug');
const debug = { wireframe: false, stats: '' };
dbg.add(debug, 'wireframe').name('Wireframe (polígonos)').onChange(setWireframe);
const statsCtl = dbg.add(debug, 'stats').name('Draw calls / tris').disable();
gui.hide();

// Teclado
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ((e.target as HTMLElement | null)?.closest?.('input, select, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? tools.redo() : tools.undo(); }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return tools.redo(); }
  if (k === 'escape' && tools.active) return tools.activate(null);
  if (k === ' ') { paused = !paused; e.preventDefault(); }
  else if (k === 't') setOverlay('traffic');
  else if (k === 'a') setOverlay('access');
  else if (k === 'p') { settings.ps1 = !settings.ps1; r.resize(); gui.controllersRecursive().forEach((c) => c.updateDisplay()); }
  else if (k === 'h') hud.toggle();
  else if (k === 'g') gui.show(gui._hidden);
  else if (k === 'q') rig.rotate(-1);
  else if (k === 'e') rig.rotate(1);
  else if (k === '1' || k === '2' || k === '3') speed = Number(k);
  else if (k === 'escape') hud.showPanel(null);
});
const keys = new Set<string>();
addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Seleção: clique no chão → travessia ou via mais próxima
const ray = new Raycaster();
const ground = new Plane(new Vector3(0, 1, 0), 0);
let down = new Vector2();
canvas.addEventListener('pointerdown', (e) => (down = new Vector2(e.clientX, e.clientY)));
canvas.addEventListener('pointerup', (e) => {
  if (down.distanceTo(new Vector2(e.clientX, e.clientY)) > 4) return;
  ray.setFromCamera(new Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), rig.camera);
  const p = ray.ray.intersectPlane(ground, new Vector3());
  if (!p) return;
  select(p);
});

const NOMES: Record<string, string> = {
  ramp_bridge: 'Rampa-Ponte', death_jump: 'Salto Mortal', rail_walkway: 'Rail-Passarela', air_loop: 'Loop Aéreo',
  bubble_lift: 'Elevador de Bolha', glass_walkway: 'Passarela de vidro', transit_only: 'Só coletivo',
};
/** O que está sob o clique: travessia (sobre o canal), cruzamento ou via. */
function pickTarget(p: Vector3): PickTarget {
  const t: PickTarget = {};
  const canal = waterBands(city).find((c) => p.z > c.y0 - 0.6 && p.z < c.y1 + 0.6);
  if (canal) {
    const c = city.crossings.find((c) => {
      const A = city.nodes.find((n) => n.id === c.from), B = city.nodes.find((n) => n.id === c.to);
      return !!A && !!B && Math.abs(A.x - p.x) < 0.9 && Math.min(A.y, B.y) < canal.y0 && Math.max(A.y, B.y) > canal.y1;
    });
    if (c) t.crossing = c.id;
  }
  let bestN = 0.75;
  for (const n of city.nodes) {
    const d = Math.hypot(n.x - p.x, n.y - p.z);
    if (d < bestN) { bestN = d; t.node = n.id; }
  }
  let bestE = 0.6;
  for (const e of city.edges) {
    const A = city.nodes.find((n) => n.id === e.from), B = city.nodes.find((n) => n.id === e.to);
    if (!A || !B) continue;
    const L2 = (B.x - A.x) ** 2 + (B.y - A.y) ** 2;
    const k = Math.max(0, Math.min(1, ((p.x - A.x) * (B.x - A.x) + (p.z - A.y) * (B.y - A.y)) / L2));
    const d = Math.hypot(p.x - (A.x + k * (B.x - A.x)), p.z - (A.y + k * (B.y - A.y)));
    if (d < bestE) { bestE = d; t.edge = e.id; }
  }
  return t;
}

function select(p: Vector3) {
  if (tools.active) return tools.pick(pickTarget(p));
  const canal = waterBands(city).find((c) => p.z > c.y0 - 0.6 && p.z < c.y1 + 0.6);
  if (canal) {
    const c = city.crossings.find((c) => {
      const A = city.nodes[c.from], B = city.nodes[c.to];
      return !!A && !!B && Math.abs(A.x - p.x) < 0.9 && A.y < canal.y0 && B.y > canal.y1;
    });
    if (c) {
      const ok = crossingIsAccessible(c);
      hud.showPanel(NOMES[c.radical] ?? c.radical, [
        ['Sobre', 'Canal'],
        ['Vão', `${view.canalSpanM.toFixed(0)} m`],
        ['Rota acessível', c.access ? NOMES[c.access] ?? c.access : c.radical === 'rail_walkway' ? 'Passarela de vidro' : 'NENHUMA', !ok],
        ['Quem salta', 'skate, patins, patinete, BMX, cadeira'],
        ['Mão', c.radical === 'death_jump' ? 'só norte → sul' : 'dupla'],
      ]);
      return;
    }
  }
  let best: { d: number; id: number } | null = null;
  for (const e of city.edges) {
    const A = city.nodes[e.from], B = city.nodes[e.to];
    if (!A || !B) continue;
    const ax = A.x, az = A.y, bx = B.x, bz = B.y;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * (bx - ax) + (p.z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    const d = Math.hypot(p.x - (ax + t * (bx - ax)), p.z - (az + t * (bz - az)));
    if (d < 0.6 && (!best || d < best.d)) best = { d, id: e.id };
  }
  if (!best) return hud.showPanel(null);
  const e = city.edges[best.id];
  if (!e) return hud.showPanel(null);
  const occ = traffic.occupancy();
  const lane = (l: 'sidewalk' | 'slow' | 'fast' | 'transit') =>
    e.lanes[l] ? `${Math.round(((occ({ edge: e.id, lane: l, side: 1, start: 0 }) + occ({ edge: e.id, lane: l, side: -1, start: 0 })) / (l === 'transit' ? 1 : 2)) * 100)}%` : '—';
  hud.showPanel(`Via ${e.id} · ${e.kind}`, [
    ['Calçada', lane('sidewalk')], ['Rodinha lenta', lane('slow')], ['Rodinha rápida', lane('fast')], ['Coletiva', lane('transit')],
    ['Mão', e.oneWay ? 'única' : 'dupla'],
  ]);
}

// KPIs de demonstração (derivados do trânsito visível)
function updateKpis() {
  const occ = traffic.occupancy();
  const over = view.strips.filter((s) => occ(s) > 1).length / view.strips.length;
  const acc = city.crossings.filter(crossingIsAccessible).length / city.crossings.length;
  const tricksters = traffic.agents.filter((a) => a.info?.tricks).length || 1;
  const minutes = 7 * 60 + 40 + Math.floor(simTime * 2);
  hud.setKpis({
    money: stack.money,
    clock: `Dia 3 · ${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    travelMin: 14 + over * 20,
    congestion: over,
    access: acc,
    radical: Math.min(1, 0.45 + (traffic.airborneCount / tricksters) * 6),
    satisfaction: 0.55 + acc * 0.2 - over * 0.3,
  });
}

// Congelamento para capturas reproduzíveis
const freezeAt = params.has('t') ? numParam('t', 0) : null;
if (freezeAt !== null) {
  const dt = 1 / 30;
  for (let s = 0; s < freezeAt; s += dt) { traffic.update(dt); atmo.update(dt); simTime += dt; }
  ps1Shared.uTime.value = simTime;
  paused = true;
}
if (params.get('hud') === '0') hud.toggle(false);
const ov = params.get('overlay');
if (ov === 'traffic' || ov === 'access') setOverlay(ov);
updateKpis();

let last = performance.now();
let kpiTimer = 0;
let frames = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    const sdt = dt * speed;
    simTime += sdt;
    ps1Shared.uTime.value = simTime;
    traffic.update(sdt);
    atmo.update(sdt);
    kpiTimer += dt;
    if (kpiTimer > 0.5) {
      kpiTimer = 0;
      updateKpis();
      if (overlay === 'traffic') view.paintTraffic(traffic.occupancy());
    }
  }
  const panSpeed = rig.distance * 0.8 * dt;
  if (keys.has('w') || keys.has('arrowup')) rig.pan(0, -panSpeed);
  if (keys.has('s') || keys.has('arrowdown')) rig.pan(0, panSpeed);
  if (keys.has('arrowleft')) rig.pan(-panSpeed, 0); // "A" fica com o overlay de acessibilidade
  if (keys.has('d') || keys.has('arrowright')) rig.pan(panSpeed, 0);
  rig.update(dt, r.aspect);
  updateFog();
  r.begin();
  r.draw(scene, rig.camera);
  r.end();
  if (++frames % 30 === 0) {
    const info = r.gl.info.render;
    debug.stats = `${info.calls} calls · ${info.triangles.toLocaleString('pt-BR')} tris`;
    statsCtl.updateDisplay();
  }
  if (frames === 2) (window as unknown as { __ready: boolean }).__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handle de depuração/testes ponta a ponta (scripts e console do navegador)
(window as unknown as { __puca: unknown }).__puca = { tools, stack, pickTarget, get city() { return city; } };
