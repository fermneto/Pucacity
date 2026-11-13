import {
  Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3,
} from 'three';
import veiculos from '../../data/arte/veiculos.json';
import type { CityCrossing, CityFile, LaneKind } from '../core/CityFile';
import { CityView, LANE_OFFSET, type OverlayStrip } from './CityView';
import { buildModel } from './models/catalog';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas } from './textures/Atlas';
import { pickLook } from './palette';
import { makeRng, pickWeighted, TILE_M, type Rng } from './util';

/**
 * Trânsito de DEMONSTRAÇÃO, só para validar o visual (silhuetas, faixas, manobras, overlays).
 * Não é a simulação do SPEC §4 (que mora em core/). Cada cidadão segue a sua faixa,
 * escolhe vias ao acaso e atravessa o canal pelo elemento radical que pode usar.
 */

interface VehicleInfo { kind: string; lane: LaneKind; speed: [number, number]; freq: number; tricks: boolean }

const LANE_OF: Record<string, LaneKind> = Object.fromEntries(
  Object.entries(veiculos.faixas).map(([k, v]) => [k, (v as { lane: LaneKind }).lane]),
);
const INFO: VehicleInfo[] = veiculos.individuais.map((v) => ({
  kind: v.kind, lane: LANE_OF[v.faixa], speed: v.velocidade as [number, number], freq: v.frequencia, tricks: v.manobras,
}));

type Trick = 'spin' | 'flip' | 'none';
const TRICK: Record<string, Trick> = {
  skate: 'spin', longboard: 'spin', skates: 'spin', kick_scooter: 'flip', bmx: 'flip', wheelchair: 'flip',
};
const TRICK_NAMES: Record<string, string[]> = {
  skate: ['KICKFLIP', '360 FLIP', 'OLLIE NORTH'], longboard: ['BIG SPIN'], skates: ['MISTRIAL', 'TOPSIDE'],
  kick_scooter: ['TAILWHIP', 'BARSPIN'], bmx: ['BACKFLIP', 'SUPERMAN'], wheelchair: ['BACKFLIP DE CADEIRA'],
};

interface Agent {
  model: string;
  info: VehicleInfo | null;
  lane: LaneKind;
  edge: number;            // índice em links
  forward: boolean;
  t: number;
  speed: number;           // tiles/s
  hidden: boolean;
  airborne: boolean;
  slot: number;
  fixedRoute?: number[];   // coletivo: sequência de links
  routeIdx?: number;
}

interface Link {
  a: number; b: number;
  len: number;
  crossing?: CityCrossing;
  edgeId?: number;
  loop?: boolean;
  hasLane: Record<LaneKind, boolean>;
  grid: 'N' | 'S';
}

export interface TrafficEvents { onTrick?: (text: string) => void }

export class DemoTraffic {
  readonly meshes = new Map<string, InstancedMesh>();
  readonly agents: Agent[] = [];
  private links: Link[] = [];
  private adj = new Map<number, number[]>();
  private rng: Rng;
  private dummy = new Object3D();
  airborneCount = 0;
  readonly cabins: InstancedMesh;
  private time = 0;

  constructor(private city: CityFile, private view: CityView, total: number, seed = 7, private events: TrafficEvents = {}) {
    this.rng = makeRng(seed);
    this.buildGraph();
    const { texture } = getAtlas();
    const material = createPs1Material({ map: texture, instanced: true });

    // quantos de cada modelo
    const counts = new Map<string, number>();
    for (let i = 0; i < total; i++) {
      const info = pickWeighted(this.rng, INFO, (v) => v.freq);
      const model = `veh_${info.kind}`;
      counts.set(model, (counts.get(model) ?? 0) + 1);
      this.spawn(model, info);
    }
    const transitLinks = this.links.map((l, i) => ({ l, i })).filter(({ l }) => l.hasLane.transit && !l.crossing);
    const lines = [
      { model: 'veh_tuktuk', grid: 'N' as const, color: '#3FD0E8', n: 5 },
      { model: 'veh_tandem', grid: 'S' as const, color: '#FF5FA8', n: 4 },
      { model: 'veh_tandem_4', grid: 'S' as const, color: '#FFE23A', n: 2 },
    ];
    for (const line of lines) {
      const route = transitLinks.filter(({ l }) => l.grid === line.grid).map(({ i }) => i);
      for (let k = 0; k < line.n; k++) {
        this.spawn(line.model, null, route, line.color);
        counts.set(line.model, (counts.get(line.model) ?? 0) + 1);
      }
    }

    for (const [model, n] of counts) {
      const geo = buildModel(model).opaque.clone();
      geo.setAttribute('iColor2', new InstancedBufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('iColor3', new InstancedBufferAttribute(new Float32Array(n * 3), 3));
      const mesh = new InstancedMesh(geo, material, n);
      mesh.frustumCulled = false;
      this.meshes.set(model, mesh);
    }
    // cores por instância
    const slots = new Map<string, number>();
    for (const a of this.agents) {
      const mesh = this.meshes.get(a.model)!;
      a.slot = slots.get(a.model) ?? 0;
      slots.set(a.model, a.slot + 1);
      const look = pickLook(this.rng);
      const vc = (a as Agent & { lineColor?: string }).lineColor ?? look.vehicle.hex;
      mesh.setColorAt(a.slot, new Color(vc));
      const c2 = new Color(look.outfit.hex), c3 = new Color(look.skin);
      (mesh.geometry.getAttribute('iColor2') as InstancedBufferAttribute).setXYZ(a.slot, c2.r, c2.g, c2.b);
      (mesh.geometry.getAttribute('iColor3') as InstancedBufferAttribute).setXYZ(a.slot, c3.r, c3.g, c3.b);
    }

    const cabin = buildModel('rad_bubble_cabin');
    const cabGeo = cabin.opaque.clone();
    this.cabins = new InstancedMesh(cabGeo, createPs1Material({ map: texture }), Math.max(1, view.liftCabins.length));
    this.cabins.count = view.liftCabins.length;
    this.cabins.frustumCulled = false;
  }

  /** Malhas de vidro das cápsulas (bolha translúcida). */
  cabinGlass(): InstancedMesh | null {
    const g = buildModel('rad_bubble_cabin').glass;
    if (!g || !this.view.liftCabins.length) return null;
    const m = new InstancedMesh(g, createPs1Material({ map: getAtlas().texture, opacity: 0.5 }), this.view.liftCabins.length);
    m.frustumCulled = false;
    this.cabinGlassMesh = m;
    return m;
  }
  private cabinGlassMesh: InstancedMesh | null = null;

  private buildGraph() {
    const nodes = this.city.nodes;
    const add = (l: Link) => {
      const i = this.links.push(l) - 1;
      for (const n of [l.a, l.b]) this.adj.set(n, [...(this.adj.get(n) ?? []), i]);
    };
    const canalY = this.city.canal ? (this.city.canal.y0 + this.city.canal.y1) / 2 : Infinity;
    for (const e of this.city.edges) {
      const A = nodes[e.from], B = nodes[e.to];
      const hasLane = { sidewalk: !!e.lanes.sidewalk, slow: !!e.lanes.slow, fast: !!e.lanes.fast, transit: !!e.lanes.transit };
      const loop = (this.city.features ?? []).some((f) => f.kind === 'air_loop' && Math.abs(f.y - A.y) < 0.01 && Math.abs(f.y - B.y) < 0.01 && f.x > Math.min(A.x, B.x) && f.x < Math.max(A.x, B.x));
      add({ a: e.from, b: e.to, len: Math.hypot(B.x - A.x, B.y - A.y), edgeId: e.id, loop, hasLane, grid: A.y < canalY ? 'N' : 'S' });
    }
    for (const c of this.city.crossings) {
      const A = nodes[c.from], B = nodes[c.to];
      add({ a: c.from, b: c.to, len: Math.hypot(B.x - A.x, B.y - A.y), crossing: c, hasLane: { sidewalk: true, slow: true, fast: true, transit: false }, grid: 'N' });
    }
  }

  private spawn(model: string, info: VehicleInfo | null, route?: number[], lineColor?: string) {
    const rng = this.rng;
    const candidates = this.links.map((l, i) => ({ l, i })).filter(({ l }) => !l.crossing);
    const start = route ? route[Math.floor(rng() * route.length)] : candidates[Math.floor(rng() * candidates.length)].i;
    const lane: LaneKind = info ? info.lane : 'transit';
    const speedMs = info ? info.speed[0] + rng() * (info.speed[1] - info.speed[0]) : model === 'veh_tuktuk' ? 7 : 4.5;
    const agent: Agent & { lineColor?: string } = {
      model, info, lane, edge: start, forward: rng() > 0.5, t: rng(), speed: speedMs / TILE_M,
      hidden: false, airborne: false, slot: 0, fixedRoute: route, routeIdx: route ? route.indexOf(start) : undefined, lineColor,
    };
    this.agents.push(agent);
  }

  /** Pode atravessar? E por onde (radical ou rota acessível)? */
  private crossingMode(a: Agent, c: CityCrossing, forward: boolean): 'radical' | 'access' | null {
    const tricks = !!a.info?.tricks;
    const northToSouth = forward; // travessias vão de from (norte) para to (sul)
    if (c.radical === 'rail_walkway') return tricks ? 'radical' : 'access';
    if (tricks && (c.radical !== 'death_jump' || northToSouth)) return 'radical';
    return c.access ? 'access' : null;
  }

  private nextLink(a: Agent, node: number) {
    if (a.fixedRoute) {
      // coletivo: anda pela sequência de links que tocam o nó atual, sem voltar
      const opts = (this.adj.get(node) ?? []).filter((i) => a.fixedRoute!.includes(i) && i !== a.edge);
      const pickI = opts.length ? opts[Math.floor(this.rng() * opts.length)] : a.edge;
      a.edge = pickI;
    } else {
      const opts = (this.adj.get(node) ?? []).filter((i) => {
        if (i === a.edge) return false;
        const l = this.links[i];
        if (l.crossing) return this.crossingMode(a, l.crossing, l.a === node) !== null;
        return true;
      });
      a.edge = opts.length ? opts[Math.floor(this.rng() * opts.length)] : a.edge;
    }
    const l = this.links[a.edge];
    a.forward = l.a === node;
    a.t = 0;
  }

  update(dt: number) {
    this.time += dt;
    this.airborneCount = 0;
    for (const a of this.agents) {
      const l = this.links[a.edge];
      a.t += (a.speed * dt) / l.len;
      if (a.t >= 1) {
        const wasAir = a.airborne;
        if (wasAir && a.info && this.events.onTrick && this.rng() < 0.08) {
          const names = TRICK_NAMES[a.info.kind] ?? ['GAP'];
          this.events.onTrick(`${names[Math.floor(this.rng() * names.length)]} NO CANAL! +${l.crossing?.radical === 'death_jump' ? 3000 : 500}`);
        }
        this.nextLink(a, a.forward ? l.b : l.a);
      }
      this.place(a);
      if (a.airborne) this.airborneCount++;
    }
    for (const m of this.meshes.values()) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      (m.geometry.getAttribute('iColor2') as InstancedBufferAttribute).needsUpdate = true;
      (m.geometry.getAttribute('iColor3') as InstancedBufferAttribute).needsUpdate = true;
    }
    this.updateCabins();
  }

  private place(a: Agent) {
    const l = this.links[a.edge];
    const nodes = this.city.nodes;
    const A = nodes[a.forward ? l.a : l.b], B = nodes[a.forward ? l.b : l.a];
    const start = new Vector3(A.x, 0, A.y), end = new Vector3(B.x, 0, B.y);
    const fwd = end.clone().sub(start).normalize();
    const right = new Vector3(-fwd.z, 0, fwd.x);
    let pos = start.clone().lerp(end, a.t).addScaledVector(right, LANE_OFFSET[a.lane]);
    let up = new Vector3(0, 1, 0);
    let dir = fwd.clone();
    let spin = 0, flip = 0;
    a.hidden = false;
    a.airborne = false;

    if (l.crossing) {
      const mode = this.crossingMode(a, l.crossing, a.forward)!;
      const S = this.view.canalSpanM / TILE_M;
      const base = start.clone().lerp(end, a.t);
      if (l.crossing.radical === 'rail_walkway') {
        if (mode === 'radical') pos = base.setX(A.x - 0.2).setY(0.14);
        else pos = base.setX(A.x + 0.225).setY(0.1);
      } else if (mode === 'access') {
        a.hidden = true; // dentro da cápsula do Elevador de Bolha
        pos = base;
      } else {
        const big = l.crossing.radical === 'death_jump';
        const lift = big ? 4.5 / TILE_M : 1.6 / TILE_M;
        const air0 = 0.5 - (S / 2) / l.len - 0.02, air1 = 0.5 + (S / 2) / l.len + 0.02;
        const rampLen = (big ? 10 : 5) / TILE_M / l.len;
        let y = 0;
        if (a.t < air0 && a.t > air0 - rampLen) y = ((a.t - (air0 - rampLen)) / rampLen) * lift;
        else if (a.t >= air0 && a.t <= air1) {
          const s = (a.t - air0) / (air1 - air0);
          y = lift * (1 - s) + 4 * (big ? 1.6 : 0.7) * s * (1 - s) + (big ? 2.6 : 1.3) / TILE_M * s;
          a.airborne = true;
          const trick = TRICK[a.info?.kind ?? ''] ?? 'none';
          if (trick === 'spin') spin = s * Math.PI * 2;
          if (trick === 'flip') flip = s * Math.PI * 2 * (big ? 2 : 1);
        } else if (a.t > air1 && a.t < air1 + ((big ? 10 : 6) / TILE_M) / l.len) {
          const land = (big ? 10 : 6) / TILE_M / l.len;
          y = (1 - (a.t - air1) / land) * (big ? 2.6 : 1.3) / TILE_M;
        }
        pos = base.addScaledVector(right, 0.21).setY(y);
      }
    } else if (l.loop && a.lane === 'fast' && a.forward === (nodes[l.a].x < nodes[l.b].x)) {
      // Loop Aéreo: só quem vai para o leste na faixa rápida dá a volta
      const R = 6 / TILE_M;
      const t0 = 0.4, t1 = 0.6;
      const mid = start.clone().lerp(end, 0.5);
      if (a.t >= t0 && a.t <= t1) {
        const ang = ((a.t - t0) / (t1 - t0)) * Math.PI * 2;
        const xo = ((a.t - t0) / (t1 - t0) - 0.5) * 4.4 / TILE_M;
        // espaço local do loop: z = avanço, y = altura, x = hélice → mundo (rot π/2: lz→+x, lx→-z)
        pos = mid.clone().add(new Vector3(R * Math.sin(ang), R * (1 - Math.cos(ang)), -xo));
        dir = new Vector3(Math.cos(ang), Math.sin(ang), 0);
        up = new Vector3(-Math.sin(ang), Math.cos(ang), 0);
        a.airborne = ang > 0.6 && ang < Math.PI * 2 - 0.6;
      } else {
        // aproxima/afasta da faixa rápida (0.12) para a entrada (+0.275) e a saída (-0.275) da hélice
        const k = a.t < t0 ? a.t / t0 : (a.t - t1) / (1 - t1);
        const off = a.t < t0 ? 0.12 + k * 0.155 : -0.275 + k * 0.395;
        pos = (a.t < t0 ? start.clone().lerp(mid, k) : mid.clone().lerp(end, k)).addScaledVector(right, off);
      }
    }

    if (a.info && !a.airborne && (a.lane === 'sidewalk') && a.info.kind === 'pedestrian') {
      pos.y += Math.abs(Math.sin(this.time * 9 + a.slot)) * 0.008;
    }

    const m = new Matrix4();
    if (a.hidden) {
      m.makeScale(0, 0, 0);
    } else {
      const z = dir.clone().normalize();
      const x = new Vector3().crossVectors(up, z).normalize();
      const y = new Vector3().crossVectors(z, x);
      m.makeBasis(x, y, z);
      if (spin) m.multiply(new Matrix4().makeRotationY(spin));
      if (flip) m.multiply(new Matrix4().makeRotationX(-flip));
      m.setPosition(pos);
    }
    this.meshes.get(a.model)!.setMatrixAt(a.slot, m);
  }

  private updateCabins() {
    const cabs = this.view.liftCabins;
    const q = new Quaternion();
    cabs.forEach((c, i) => {
      // ciclo de 14 s: sobe (3 s) · cabo (5 s) · desce (3 s) · volta pelo cabo (3 s, vazia)
      const T = (this.time + i * 3.3) % 14;
      const top = 8.0 / TILE_M, bottom = 0.4 / TILE_M;
      let y = bottom, z = c.zA;
      if (T < 3) y = bottom + (top - bottom) * (T / 3);
      else if (T < 8) { y = top; z = c.zA + (c.zB - c.zA) * ((T - 3) / 5); }
      else if (T < 11) { y = top - (top - bottom) * ((T - 8) / 3); z = c.zB; }
      else { y = top; z = c.zB + (c.zA - c.zB) * ((T - 11) / 3); }
      const m = new Matrix4().compose(new Vector3(c.x, y, z), q, new Vector3(1, 1, 1));
      this.cabins.setMatrixAt(i, m);
      this.cabinGlassMesh?.setMatrixAt(i, m);
    });
    this.cabins.instanceMatrix.needsUpdate = true;
    if (this.cabinGlassMesh) this.cabinGlassMesh.instanceMatrix.needsUpdate = true;
  }

  /** Ocupação por tira de faixa, para o overlay de tráfego. */
  occupancy(): (s: OverlayStrip) => number {
    const counts = new Map<string, number>();
    for (const a of this.agents) {
      const l = this.links[a.edge];
      if (l.edgeId === undefined) continue;
      const side = a.lane === 'transit' ? -1 : a.forward ? 1 : -1;
      const key = `${l.edgeId}|${a.lane}|${side}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const CAP: Record<LaneKind, number> = { sidewalk: 6, slow: 5, fast: 5, transit: 3 };
    return (s) => (counts.get(`${s.edge}|${s.lane}|${s.side}`) ?? 0) / CAP[s.lane];
  }
}
