import * as THREE from 'three';
import { CityValidationError, loadCity } from './core/CityLoader';
import { findPath, type Path } from './core/Pathfinding';
import { RoadGraph } from './core/RoadGraph';
import { Rng } from './core/Rng';
import { nearestNode } from './core/Spatial';
import { CameraRig } from './render/CameraRig';
import { CityView, LAYER } from './render/CityView';
import { screenToTile } from './render/Picking';
import { createPs1Material, ps1Globals } from './render/ps1/Ps1Material';
import { QuadBuilder } from './render/QuadBuilder';
import { Ps1Renderer } from './render/Renderer';

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

async function main(): Promise<void> {
  const cityUrl = new URLSearchParams(location.search).get('city') ?? 'cities/demo.json';
  const city = await loadCity(cityUrl);
  const graph = new RoadGraph(city);

  const renderer = new Ps1Renderer(document.body);
  const scene = new THREE.Scene();
  scene.background = ps1Globals.uFogColor.value;

  const view = new CityView(city);
  scene.add(view.group);

  const rig = new CameraRig(renderer.gl.domElement, city.size);
  rig.resize(renderer.aspect);
  window.addEventListener('resize', () => rig.resize(renderer.aspect));

  // ---------- estado do protótipo: rota A* entre dois cruzamentos + congestionamento fake
  let origin: number | null = null;
  let path: Path | null = null;
  let overlayOn = false;
  let congestionSeed = 0;
  const routeMat = createPs1Material({ vertexColors: true, side: THREE.DoubleSide });
  const routeMesh = new THREE.Mesh(new THREE.BufferGeometry(), routeMat);
  scene.add(routeMesh);
  const markerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  markerGeo.translate(0, 0.4, 0);
  const originMarker = new THREE.Mesh(markerGeo, createPs1Material({ color: 0x40ffff }));
  originMarker.visible = false;
  scene.add(originMarker);

  const rebuildRoute = () => {
    const qb = new QuadBuilder();
    const c = new THREE.Color(0x40ffff);
    for (const ei of path?.edges ?? []) {
      const e = graph.edge(ei);
      const a = graph.node(e.from);
      const b = graph.node(e.to);
      qb.segment(a.x, a.y, b.x, b.y, 0.45, LAYER.overlay, c);
    }
    routeMesh.geometry.dispose();
    routeMesh.geometry = qb.build();
  };

  const recomputePath = (dest: number) => {
    if (origin === null) return;
    path = findPath(graph, origin, dest);
    rebuildRoute();
  };

  const refreshOverlay = () => {
    if (!overlayOn) return view.setEdgeColors(() => null);
    const satByCityEdge = new Map<number, number>();
    for (const e of graph.edges) {
      satByCityEdge.set(e.cityEdgeId, Math.max(satByCityEdge.get(e.cityEdgeId) ?? 0, graph.saturation(e.index)));
    }
    view.setEdgeColors((id) => congestionColor(satByCityEdge.get(id) ?? 0));
  };

  // Ganchos de debug no console do navegador (só em dev): __puca.graph, __puca.state()
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __puca: { city, graph, rig, findPath, state: () => ({ origin, path }) },
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
    if (origin === null || path !== null) {
      origin = hit.index;
      path = null;
      rebuildRoute();
      const n = graph.node(origin);
      originMarker.position.set(n.x, 0, n.y);
      originMarker.visible = true;
    } else {
      recomputePath(hit.index);
    }
  });

  // ---------- teclado
  window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'q': rig.rotate(-1); break;
      case 'e': rig.rotate(1); break;
      case 'p': rig.useOrtho = !rig.useOrtho; break;
      case '1': ps1Globals.uJitter.value = ps1Globals.uJitter.value > 0 ? 0 : 1; break;
      case '2': ps1Globals.uAffine.value = ps1Globals.uAffine.value > 0 ? 0 : 1; break;
      case '3': renderer.dither = !renderer.dither; break;
      case 'r': renderer.cycleResolution(); rig.resize(renderer.aspect); break;
      case 't': overlayOn = !overlayOn; refreshOverlay(); break;
      case 'c': {
        // "Hora do rush" fake: fluxos aleatórios → BPR muda custos → A* desvia
        congestionSeed++;
        const rng = new Rng(congestionSeed);
        for (const ed of graph.edges) ed.flowVph = rng.next() ** 2 * ed.capacityVph * 1.6;
        overlayOn = true;
        refreshOverlay();
        if (path && origin !== null) recomputePath(path.nodes[path.nodes.length - 1]!);
        break;
      }
      case 'x':
        graph.resetFlows();
        refreshOverlay();
        if (path && origin !== null) recomputePath(path.nodes[path.nodes.length - 1]!);
        break;
      case 'escape':
        origin = null; path = null; originMarker.visible = false; rebuildRoute();
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
    hud.textContent = [
      `PucaCity — ${city.name}`,
      `${fps} fps  ${renderer.lowRes.x}×${renderer.lowRes.y}  ${rig.useOrtho ? 'ortho' : 'persp'}  draw calls ${renderer.sceneDrawCalls}`,
      `nós ${graph.nodes.length}  arestas ${graph.edges.length}  prédios ${city.buildings.length}`,
      `[1] jitter ${on(ps1Globals.uJitter.value > 0)} [2] affine ${on(ps1Globals.uAffine.value > 0)} [3] dither ${on(renderer.dither)} [R] res`,
      `[T] overlay ${on(overlayOn)}  [C] rush aleatório  [X] zera fluxo`,
      origin === null
        ? 'clique num cruzamento = origem'
        : path
          ? `rota: ${path.edges.length} trechos, ${path.cost.toFixed(2)} min  (clique = nova origem)`
          : 'clique em outro cruzamento = destino',
      'WASD/arrastar mover · roda zoom · Q/E girar · P câmera',
    ].join('\n');

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch(showError);
