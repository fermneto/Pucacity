import '@fontsource/varela-round';
import '@fontsource/bungee';
import '@fontsource/exo-2/700.css';
import { Scene, Vector3 } from 'three';
import GUI from 'lil-gui';
import vitrineUrl from '../assets/cities/vitrine.json?url';
import { BalanceValidationError, CityValidationError, loadBalance, loadCity } from '../core/CityLoader';
import { crossingIsAccessible, waterBands } from '../core/CityFile';
import type { CityFile } from '../core/types';
import { Ps1Renderer } from '../render/Renderer';
import { CityView, type OverlayStrip } from '../render/CityView';
import { Atmosphere } from '../render/Atmosphere';
import { CameraRig } from '../render/CameraRig';
import { ps1Shared, setWireframe } from '../render/ps1/Ps1Material';
import { numParam, params } from '../render/util';
import { Hud, type OverlayMode } from '../ui/hud';
import { createSimulation, SIMULATION_KIND } from './createSimulation';
import { GameLoop, SPEEDS, type Speed } from './GameLoop';
import { SimpleSimView, type SimViewPort } from './SimpleSimView';
import type { SimState, SimulationPort } from './SimulationPort';
import './game.css';

/**
 * JOGO (index.html). Liga: city.json (CityLoader) → simulação (SimulationPort) → render do PC1.
 *
 * Parâmetros de URL:
 *   ?city=vitrine (padrão) | demo | vila-nova | cities/x.json   (nome curto = public/cities/<nome>.json)
 *   ?seed=1  ?scale=0.05 (fração da população que vira agente)  ?start=420 (minuto inicial, 7h)
 *   ?tps=1 (ticks por segundo em 1×)  ?t=30 (pré-roda 30 ticks e pausa: capturas reproduzíveis)
 *   ?res=240  ?ps1=0  ?hud=0  ?overlay=traffic|access
 *
 * Padrão `vitrine`: é a cidade para a qual o render do PC1 foi afinado (canal, travessias, features)
 * e já valida no CityLoader (tests/core/vitrine.test.ts). `demo.json` (48×48, sem features) continua
 * disponível com `?city=demo`; o Vila Nova do PC2 entra como `?city=vila-nova` quando chegar em public/cities/.
 */

type Debug = { __ready?: boolean; __puca?: unknown };

/** Troca da vista provisória pelo SimView definitivo do PC1: só aqui. */
function createSimView(): SimViewPort {
  return new SimpleSimView();
}

export function resolveCityUrl(param: string | null): string {
  if (!param || param === 'vitrine') return vitrineUrl;
  if (/^[\w-]+$/.test(param)) return `cities/${param}.json`;
  return param;
}

function showError(e: unknown): void {
  let title = 'Erro ao iniciar o jogo';
  let body: string;
  if (e instanceof CityValidationError) {
    title = `city.json inválido — ${e.errors.length} erro(s)`;
    body = e.errors.map((x) => `• ${x}`).join('\n');
  } else if (e instanceof BalanceValidationError) {
    title = `config/balance.json inválido — ${e.errors.length} erro(s)`;
    body = e.errors.map((x) => `• ${x}`).join('\n');
  } else {
    body = e instanceof Error ? (e.stack ?? e.message) : String(e);
  }
  const box = document.createElement('div');
  box.id = 'game-error';
  const h = document.createElement('h1');
  h.textContent = title;
  box.append(h, body);
  document.body.appendChild(box);
  console.error(`${title}\n${body}`);
  (window as unknown as Debug).__ready = true; // capturas não ficam esperando
}

const pad = (n: number) => String(n).padStart(2, '0');
const clockText = (s: SimState) => `Dia ${s.day + 1} · ${pad(Math.floor(s.minuteOfDay / 60))}:${pad(s.minuteOfDay % 60)}`;

async function main(): Promise<void> {
  const { balance, warnings: balanceWarnings } = loadBalance();
  if (balanceWarnings.length) console.warn(`balance.json: ${balanceWarnings.length} aviso(s)\n- ${balanceWarnings.join('\n- ')}`);

  const cityUrl = resolveCityUrl(params.get('city'));
  const { city, warnings } = await loadCity(cityUrl);
  if (warnings.length) console.warn(`${city.name}: ${warnings.length} aviso(s) no city.json\n- ${warnings.join('\n- ')}`);

  // ---------- render (código do PC1)
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const r = new Ps1Renderer(canvas);
  r.apply({ internalHeight: numParam('res', 240), ps1: params.get('ps1') !== '0' });
  const scene = new Scene();
  const view = new CityView(city);
  scene.add(view.group);
  const center = new Vector3(city.size.w / 2 - 0.5, 0, city.size.h / 2 - 0.5);
  // Atmosphere (PC1) agora aceita todos os canais: bolhas sobre cada faixa de água.
  const canals = waterBands(city).map((b) => ({ ...b, x0: -25, x1: city.size.w + 25 }));
  const atmo = new Atmosphere(center, canals);
  scene.add(atmo.group);
  const rig = new CameraRig(canvas);
  // Mesmo enquadramento da visão geral da vitrine (PC1): distância fixa, a névoa acompanha o zoom.
  rig.set(center.clone().setZ(center.z + 1.2), Math.min(42, Math.max(city.size.w, city.size.h) * 1.3), 0, 0.95);
  const updateFog = () => {
    ps1Shared.uFogNear.value = Math.max(18, rig.distance * 1.05);
    ps1Shared.uFogFar.value = Math.max(42, rig.distance * 2.4);
  };
  updateFog();

  // ---------- simulação + vista dos agentes
  const sim: SimulationPort = createSimulation(city, {
    seed: numParam('seed', 1),
    scale: numParam('scale', 0.05),
    startMinute: numParam('start', 7 * 60),
  });
  const simView = createSimView();
  scene.add(simView.group);
  const loop = new GameLoop(() => sim.tick(), { ticksPerSecond: numParam('tps', 1), maxTicksPerFrame: 32 });

  // ---------- HUD (src/ui/hud.ts do PC1) + status do jogo
  const hud = new Hud();
  const status = document.createElement('div');
  status.className = 'gel game-status';
  hud.root.appendChild(status);

  const syncSpeedButtons = () => {
    hud.root.querySelectorAll<HTMLElement>('.speed button').forEach((b) => {
      b.classList.toggle('on', !loop.paused && SPEEDS[Number(b.dataset.s) - 1] === loop.speed);
    });
  };
  const setSpeed = (s: Speed) => {
    loop.setSpeed(s);
    syncSpeedButtons();
  };
  hud.onSpeed = (i) => setSpeed(SPEEDS[i - 1] ?? 1);

  let overlay: OverlayMode = 'none';
  const paintTraffic = (state: SimState) => {
    // saturação por aresta do city.json e sentido (side 1 = from→to), como o CityView espera
    const sat = new Map<string, number>();
    for (const e of sim.graph.edges) {
      if (e.link !== 'road') continue;
      const key = `${e.sourceId}|${e.reversed ? -1 : 1}`;
      sat.set(key, Math.max(sat.get(key) ?? 0, state.edgeSaturation[e.index] ?? 0));
    }
    view.paintTraffic((s: OverlayStrip) => sat.get(`${s.edge}|${s.side}`) ?? sat.get(`${s.edge}|${-s.side}`) ?? 0);
  };
  const setOverlay = (m: OverlayMode) => {
    overlay = overlay === m && m !== 'none' ? 'none' : m;
    view.overlay.visible = overlay === 'traffic';
    view.accessOverlay.visible = overlay === 'access';
    ps1Shared.uDesat.value = overlay === 'none' ? 0 : 0.85;
    hud.setOverlay(overlay);
    if (overlay === 'traffic') paintTraffic(sim.getState());
  };
  hud.onOverlay = setOverlay;

  const accessPct = city.crossings.length ? city.crossings.filter(crossingIsAccessible).length / city.crossings.length : 1;
  const satThreshold = balance.congestion.saturatedThreshold;
  const updateKpis = (state: SimState) => {
    // KPIs PROVISÓRIOS derivados do SimState; os de verdade virão de core/Kpis.ts.
    const roads = sim.graph.edges.filter((e) => e.link === 'road');
    const congested = roads.filter((e) => (state.edgeSaturation[e.index] ?? 0) > satThreshold).length / Math.max(1, roads.length);
    const st = state.stats;
    hud.setKpis({
      money: city.scenario?.budget ?? 0,
      clock: clockText(state),
      travelMin: st.tripsCompleted ? st.tripMinutesTotal / st.tripsCompleted : 0,
      congestion: congested,
      access: accessPct,
      radical: Math.min(1, st.radicalCrossings / Math.max(1, st.tripsCompleted)),
      satisfaction: Math.max(0, Math.min(1, 0.5 + accessPct * 0.3 - congested * 0.4)),
    });
  };

  // ---------- painel visual (G), igual ao da vitrine
  const settings = r.settings;
  const gui = new GUI({ title: 'Visual PS1 (G)' });
  gui.add(settings, 'ps1').name('Efeitos PS1').onChange(() => r.resize());
  gui.add(settings, 'internalHeight', [240, 360, 480, 720]).name('Resolução interna').onChange(() => r.resize());
  gui.add({ wireframe: false }, 'wireframe').name('Wireframe').onChange(setWireframe);
  gui.hide();

  // ---------- teclado (SPEC §8)
  const keys = new Set<string>();
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === ' ') {
      loop.togglePause();
      syncSpeedButtons();
      e.preventDefault();
    } else if (k === '1' || k === '2' || k === '3') setSpeed(SPEEDS[Number(k) - 1] ?? 1);
    else if (k === 't') setOverlay('traffic');
    else if (k === 'a') setOverlay('access');
    else if (k === 'p') { settings.ps1 = !settings.ps1; r.resize(); gui.controllersRecursive().forEach((c) => c.updateDisplay()); }
    else if (k === 'h') hud.toggle();
    else if (k === 'g') gui.show(gui._hidden);
    else if (k === 'q') rig.rotate(-1);
    else if (k === 'e') rig.rotate(1);
    else if (k === 'escape') hud.showPanel(null);
  });

  // ---------- pré-rodada para capturas (?t=N ticks) e parâmetros visuais
  let renderTime = 0;
  if (params.has('t')) {
    sim.step(Math.max(0, Math.floor(numParam('t', 0))));
    for (let i = 0; i < 60; i++) atmo.update(1 / 30);
    renderTime = 2;
    ps1Shared.uTime.value = renderTime;
    loop.paused = true;
  }
  if (params.get('hud') === '0') hud.toggle(false);
  const ov = params.get('overlay');
  if (ov === 'traffic' || ov === 'access') setOverlay(ov);
  syncSpeedButtons();

  // ---------- debug no console (só em dev)
  if (import.meta.env.DEV) {
    (window as unknown as Debug).__puca = {
      city, sim, loop, rig, view, simView, balance,
      get graph() { return sim.graph; },
      state: () => sim.getState(),
      setCity: (c: CityFile) => sim.setCity(c),
    };
  }

  // ---------- quadro
  let state = sim.getState();
  updateKpis(state);
  let last = performance.now();
  let fpsAcc = 0, fpsFrames = 0, fps = 0, kpiTimer = 0, frames = 0;
  const renderStatus = () => {
    status.innerHTML =
      `<div>${loop.paused ? '<b class="paused">❚❚ PAUSA</b>' : `<b>▶ ${loop.speed}×</b>`} · ${clockText(state)} · <b>${fps || '—'}</b> fps</div>` +
      `<div>${city.name} · ${state.agents.length} agentes · ${state.transit.length} coletivos</div>` +
      `<div>simulação: <b>${SIMULATION_KIND === 'mock' ? 'MOCK (provisória)' : 'core'}</b> · <b>1/2/3</b> 1×/2×/4×</div>`;
  };
  renderStatus();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (loop.advance(dt) > 0) state = sim.getState();
    if (!loop.paused) {
      renderTime += dt * loop.speed;
      ps1Shared.uTime.value = renderTime;
      atmo.update(dt * loop.speed);
    }
    simView.update(state, loop.paused ? 1 : loop.alpha);

    kpiTimer += dt;
    if (kpiTimer > 0.5) {
      kpiTimer = 0;
      updateKpis(state);
      if (overlay === 'traffic') paintTraffic(state);
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

    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 0.5) {
      fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0;
      fpsFrames = 0;
      renderStatus();
    }
    if (++frames === 2) (window as unknown as Debug).__ready = true;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch(showError);
