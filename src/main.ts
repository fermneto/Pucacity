import '@fontsource/varela-round';
import '@fontsource/bungee';
import '@fontsource/exo-2/700.css';
import { Plane, Raycaster, Scene, Vector2, Vector3 } from 'three';
import GUI from 'lil-gui';
import cityJson from './assets/cities/vitrine.json';
import type { CityFile } from './core/CityFile';
import { crossingIsAccessible } from './core/CityFile';
import { Ps1Renderer } from './render/Renderer';
import { CityView } from './render/CityView';
import { DemoTraffic } from './render/DemoTraffic';
import { Atmosphere } from './render/Atmosphere';
import { CameraRig } from './render/CameraRig';
import { ps1Shared, setWireframe } from './render/ps1/Ps1Material';
import { Hud, type OverlayMode } from './ui/hud';
import { numParam, params } from './render/util';

/**
 * VITRINE VISUAL — página de validação da direção de arte (docs/validacao-visual.md).
 * Parâmetros de URL: ?cam=overview|canal|loop|bowl|street  ?overlay=traffic|access
 *                    ?ps1=0  ?t=8 (congela após 8 s simulados)  ?hud=0  ?agents=420  ?res=240
 */
const city = cityJson as unknown as CityFile;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const r = new Ps1Renderer(canvas);
r.apply({ internalHeight: numParam('res', 240), ps1: params.get('ps1') !== '0' });

const scene = new Scene();
const view = new CityView(city);
scene.add(view.group);
const center = new Vector3(city.size.w / 2 - 0.5, 0, city.size.h / 2 - 0.5);
const firstCanal = city.canals?.[0];
const atmo = new Atmosphere(center, firstCanal ? { ...firstCanal, x0: -25, x1: city.size.w + 25 } : undefined);
scene.add(atmo.group);

const hud = new Hud();
let lastTrick = 0;
let simTime = 0;
const traffic = new DemoTraffic(city, view, numParam('agents', 420), 7, {
  onTrick: (t) => { if (simTime - lastTrick > 3) { lastTrick = simTime; hud.trick(t); } },
});
for (const m of traffic.meshes.values()) scene.add(m);
scene.add(traffic.cabins);
const cabinGlass = traffic.cabinGlass();
if (cabinGlass) scene.add(cabinGlass);

// Câmera e presets
const rig = new CameraRig(canvas);
const PRESETS: Record<string, [Vector3, number, number, number]> = {
  overview: [center.clone().setZ(8), 23, 0, 0.95],
  canal: [new Vector3(3.5, 0, 8), 8.5, 0.55, 0.5],
  loop: [new Vector3(8.5, 0.5, 1), 8, 2.5, 0.38],
  bowl: [new Vector3(8.5, 0, 13), 8, 0.4, 0.7],
  street: [new Vector3(3.3, 0, 5.2), 4.2, 0.35, 0.5],
  towers: [new Vector3(8.5, 1, 3), 12, 3.4, 0.35],
};
const preset = PRESETS[params.get('cam') ?? 'overview'] ?? PRESETS.overview;
rig.set(...preset);

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
fog.add(ps1Shared.uFogNear, 'value', 0, 60, 1).name('Início');
fog.add(ps1Shared.uFogFar, 'value', 5, 120, 1).name('Fim');
const dbg = gui.addFolder('Debug');
const debug = { wireframe: false, stats: '' };
dbg.add(debug, 'wireframe').name('Wireframe (polígonos)').onChange(setWireframe);
const statsCtl = dbg.add(debug, 'stats').name('Draw calls / tris').disable();
gui.hide();

// Teclado
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
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
function select(p: Vector3) {
  const canal = city.canals?.find((c) => p.z > c.y0 - 0.6 && p.z < c.y1 + 0.6);
  if (canal) {
    const c = city.crossings.find((c) => Math.abs(city.nodes[c.from].x - p.x) < 0.9);
    if (c) {
      const ok = crossingIsAccessible(c);
      hud.showPanel(NOMES[c.radical], [
        ['Sobre', 'Canal'],
        ['Vão', `${view.canalSpanM.toFixed(0)} m`],
        ['Rota acessível', c.access ? NOMES[c.access] : c.radical === 'rail_walkway' ? 'Passarela de vidro' : 'NENHUMA', !ok],
        ['Quem salta', 'skate, patins, patinete, BMX, cadeira'],
        ['Mão', c.radical === 'death_jump' ? 'só norte → sul' : 'dupla'],
      ]);
      return;
    }
  }
  let best: { d: number; id: number } | null = null;
  for (const e of city.edges) {
    const A = city.nodes[e.from], B = city.nodes[e.to];
    const ax = A.x, az = A.y, bx = B.x, bz = B.y;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * (bx - ax) + (p.z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    const d = Math.hypot(p.x - (ax + t * (bx - ax)), p.z - (az + t * (bz - az)));
    if (d < 0.6 && (!best || d < best.d)) best = { d, id: e.id };
  }
  if (!best) return hud.showPanel(null);
  const e = city.edges[best.id];
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
    money: 48250 - Math.floor(simTime * 3),
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
