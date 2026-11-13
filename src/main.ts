import * as THREE from 'three';
import { CityValidationError, loadCity } from './core/CityLoader';
import { crossingsWithoutAccess } from './core/Crossings';
import { findPath, type Path } from './core/Pathfinding';
import { RoadGraph, type LinkKind } from './core/RoadGraph';
import { Rng } from './core/Rng';
import { nearestNode } from './core/Spatial';
import { MVP_VEHICLES, vehicle } from './core/Vehicles';
import { CameraRig } from './render/CameraRig';
import { CityView, LAYER } from './render/CityView';
import { hex, ROUTE_COLOR, WORLD } from './render/palette';
import { screenToTile } from './render/Picking';
import { createPs1Material, ps1Globals } from './render/ps1/Ps1Material';
import { QuadBuilder } from './render/QuadBuilder';
import { RadicalView } from './render/RadicalView';
import { Ps1Renderer } from './render/Renderer';
import { skyTexture } from './render/textures';

const hud = document.getElementById('hud')!;
const errorBox = document.getElementById('error')!;

function showError(e: unknown): void {
  errorBox.style.display = 'block';
  errorBox.textContent =
    e instanceof CityValidationError ? e.message : `Erro ao iniciar:\n${e instanceof Error ? e.stack ?? e.message : String(e)}`;
}

/** Verde → amarelo → vermelho conforme fluxo/capacidade. */
function congestionColor(sat: number): THREE.Color {
  const t = THREE.MathUtils.clamp(sat, 0, 1.2) / 1.2;
  return t < 0.5
    ? new THREE.Color(0x40d040).lerp(new THREE.Color(0xf0e040), t * 2)
    : new THREE.Color(0xf0e040).lerp(new THREE.Color(0xf04030), (t - 0.5) * 2);
}

const LINK_LABEL: Record<LinkKind, string> = {
  road: 'via',
  radical: 'manobra',
  lift: 'elevador',
  walkway: 'passarela',
  transit_only: 'coletivo',
};

async function main(): Promise<void> {
  const cityUrl = new URLSearchParams(location.search).get('city') ?? 'cities/demo.json';
  const { city, warnings } = await loadCity(cityUrl);
  if (warnings.length > 0) console.warn(`city.json: ${warnings.length} aviso(s)\n- ${warnings.join('\n- ')}`);
  const graph = new RoadGraph(city);
  const noAccess = crossingsWithoutAccess(city);

  // Fog a partir do horizonte Aero, antes de criar materiais.
  ps1Globals.uFogColor.value.setHex(hex(WORLD.ceu_horizonte));

  const renderer = new Ps1Renderer(document.body);
  const scene = new THREE.Scene();
  scene.background = skyTexture(WORLD.ceu_topo, WORLD.ceu_horizonte);

  const view = new CityView(city);
  scene.add(view.group);
  scene.add(new RadicalView(city).group);

  const rig = new CameraRig(renderer.gl.domElement, city.size);
  rig.resize(renderer.aspect);
  window.addEventListener('resize', () => rig.resize(renderer.aspect));

  // ---------- estado do protótipo: rota A* por modo entre dois cruzamentos + congestionamento fake
  let modeIndex = 2; // skate
  let origin: number | null = null;
  let dest: number | null = null;
  let path: Path | null = null;
  let overlayOn = false;
  let congestionSeed = 0;
  const routeMesh = new THREE.Mesh(new THREE.BufferGeometry(), createPs1Material({ vertexColors: true, side: THREE.DoubleSide }));
  scene.add(routeMesh);
  const markerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(0, 0.4, 0);
  const originMarker = new THREE.Mesh(markerGeo, createPs1Material({ color: ROUTE_COLOR }));
  originMarker.visible = false;
  scene.add(originMarker);

  const currentVehicle = () => vehicle(MVP_VEHICLES[modeIndex]!);

  const rebuildRoute = () => {
    const qb = new QuadBuilder();
    const c = new THREE.Color(ROUTE_COLOR);
    for (const ei of path?.edges ?? []) {
      const e = graph.edge(ei);
      const a = graph.node(e.from);
      const b = graph.node(e.to);
      qb.segment(a.x, a.y, b.x, b.y, 0.35, LAYER.overlay, c);
    }
    routeMesh.geometry.dispose();
    routeMesh.geometry = qb.build();
  };

  const recompute = () => {
    path = origin !== null && dest !== null ? findPath(graph, currentVehicle(), origin, dest) : null;
    rebuildRoute();
  };

  const refreshOverlay = () => {
    if (!overlayOn) return view.setEdgeColors(() => null);
    const sat = new Map<number, number>();
    for (const e of graph.edges) {
      if (e.link === 'road') sat.set(e.sourceId, Math.max(sat.get(e.sourceId) ?? 0, graph.saturation(e.index)));
    }
    view.setEdgeColors((id) => congestionColor(sat.get(id) ?? 0));
  };

  // Ganchos de debug no console do navegador (só em dev): __puca.graph, __puca.state()
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __puca: { city, graph, rig, findPath, vehicle, state: () => ({ mode: currentVehicle().kind, origin, dest, path }) },
    });
  }

  // ---------- mouse: arrastar = mover câmera; clique = escolher cruzamentos
  const dom = renderer.gl.domElement;
  let down: { x: number; y: number; dragging: boolean } | null = null;
  dom.addEventListener('pointerdown', (e) => {
    if (e.button === 0) down = { x: e.clientX, y: e.clientY, dragging: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (!down.dragging && Math.hypot(dx, dy) > 4) down.dragging = true;
    if (down.dragging) {
      rig.dragPan(dx, dy);
      down.x = e.clientX;
      down.y = e.clientY;
    }
  });
  window.addEventListener('pointerup', (e) => {
    const wasClick = down && !down.dragging;
    down = null;
    if (!wasClick || e.target !== dom) return;
    const tile = screenToTile(e.clientX, e.clientY, dom, rig.camera);
    if (!tile) return;
    const hit = nearestNode(graph, tile.x, tile.y, 3);
    if (!hit) return;
    if (origin === null || dest !== null) {
      origin = hit.index;
      dest = null;
      const n = graph.node(origin);
      originMarker.position.set(n.x, 0, n.y);
      originMarker.visible = true;
    } else {
      dest = hit.index;
    }
    recompute();
  });

  // ---------- teclado
  window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'q': rig.rotate(-1); break;
      case 'e': rig.rotate(1); break;
      case 'p': rig.useOrtho = !rig.useOrtho; break;
      case 'm': modeIndex = (modeIndex + 1) % MVP_VEHICLES.length; recompute(); break;
      case '1': ps1Globals.uJitter.value = ps1Globals.uJitter.value > 0 ? 0 : 1; break;
      case '2': ps1Globals.uAffine.value = ps1Globals.uAffine.value > 0 ? 0 : 1; break;
      case '3': renderer.dither = !renderer.dither; break;
      case 'r': renderer.cycleResolution(); rig.resize(renderer.aspect); break;
      case 't': overlayOn = !overlayOn; refreshOverlay(); break;
      case 'c': {
        // "Hora do rush" fake: fluxos aleatórios por faixa → BPR muda custos → A* desvia
        const rng = new Rng(++congestionSeed);
        for (const ed of graph.edges) {
          for (const lane of ['sidewalk', 'slow', 'fast', 'transit'] as const) {
            ed.flowVph[lane] = rng.next() ** 2 * ed.lanes[lane] * graph.params.laneCapacityVph[lane] * 1.6;
          }
          if (ed.link !== 'road') ed.linkFlowVph = rng.next() ** 2 * graph.params.linkCapacityVph[ed.link] * 1.6;
        }
        overlayOn = true;
        refreshOverlay();
        recompute();
        break;
      }
      case 'x': graph.resetFlows(); refreshOverlay(); recompute(); break;
      case 'escape':
        origin = null; dest = null; originMarker.visible = false; recompute();
        break;
    }
  });

  // ---------- loop
  let last = performance.now();
  let fpsAcc = 0;
  let fpsFrames = 0;
  let fps = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 0.5) {
      fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0;
      fpsFrames = 0;
    }

    rig.update(dt);
    // névoa acompanha o zoom para a cidade não sumir ao afastar
    ps1Globals.uFogNear.value = rig.distance * 0.9;
    ps1Globals.uFogFar.value = rig.distance * 2.4;
    renderer.render(scene, rig.camera);

    const on = (b: boolean) => (b ? 'on ' : 'off');
    const v = currentVehicle();
    let routeLine: string;
    if (origin === null) routeLine = 'clique num cruzamento = origem';
    else if (dest === null) routeLine = 'clique em outro cruzamento = destino';
    else if (!path) routeLine = `${v.name}: SEM ROTA! (falta travessia acessível?)  clique = nova origem`;
    else {
      const used = [...new Set(path.edges.map((ei) => LINK_LABEL[graph.edge(ei).link]))].join(', ');
      routeLine = `${v.name}: ${path.cost.toFixed(1)} min via ${used}  (clique = nova origem)`;
    }
    hud.textContent = [
      `Pucacity — ${city.name}`,
      `${fps} fps  ${renderer.lowRes.x}×${renderer.lowRes.y}  ${rig.useOrtho ? 'ortho' : 'persp'}  draw calls ${renderer.sceneDrawCalls}`,
      `vias ${city.edges.length}  travessias ${city.crossings.length} (${noAccess.length} sem rota acessível)  prédios ${city.buildings.length}`,
      `[M] modo: ${v.name}`,
      routeLine,
      `[T] overlay ${on(overlayOn)}  [C] rush aleatório  [X] zera fluxo`,
      `[1] jitter ${on(ps1Globals.uJitter.value > 0)} [2] affine ${on(ps1Globals.uAffine.value > 0)} [3] dither ${on(renderer.dither)} [R] res`,
      'WASD/arrastar mover · roda zoom · Q/E girar · P câmera',
      'faixas: cinza calçada · lilás lenta · azul rápida · laranja coletiva',
    ].join('\n');

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch(showError);
