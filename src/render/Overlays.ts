import { BufferAttribute, Color, Mesh, Vector3 } from 'three';
import type { CityFile, LaneKind } from '../core/CityFile';
import { crossingIsAccessible } from '../core/CityFile';
import { MeshBuilder } from './models/MeshBuilder';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas } from './textures/Atlas';
import { cityLayout, nodeLookup, type CityLayout, type SimState } from './SimState';

/**
 * Overlays de dados sobre a cidade (SPEC §7): tráfego por faixa e acessibilidade das travessias.
 * Só pintam o que o estado da simulação diz (`SimState.lanes` e `SimState.crossings`).
 */

/** Seção transversal de uma via de 1 tile (de um lado a outro). */
export const LANE_LAYOUT: { kind: LaneKind; o0: number; o1: number }[] = [
  { kind: 'sidewalk', o0: -0.5, o1: -0.3 },
  { kind: 'slow', o0: -0.3, o1: -0.18 },
  { kind: 'fast', o0: -0.18, o1: -0.06 },
  { kind: 'transit', o0: -0.06, o1: 0.06 },
  { kind: 'fast', o0: 0.06, o1: 0.18 },
  { kind: 'slow', o0: 0.18, o1: 0.3 },
  { kind: 'sidewalk', o0: 0.3, o1: 0.5 },
];

/** Tira do overlay de tráfego: uma faixa num lado de uma via; `start` = 1º vértice na malha. */
export interface OverlayStrip { edge: number; lane: LaneKind; side: number; start: number }

const GREEN = '#39FF6A';
const RED = '#E8322C';

interface AccessRange { crossing: number; start: number; end: number; ok: boolean; shade: number[] }

/** Função de ocupação por tira a partir de `SimState.lanes` (faixas ausentes = 0). */
export function laneOccupancy(state: Pick<SimState, 'lanes'>): (s: OverlayStrip) => number {
  const loads = new Map<string, number>();
  for (const l of state.lanes) loads.set(`${l.edge}|${l.lane}|${l.side}`, l.load);
  return (s) => loads.get(`${s.edge}|${s.lane}|${s.side}`) ?? 0;
}

export class Overlays {
  readonly traffic: Mesh;
  readonly access: Mesh;
  readonly strips: OverlayStrip[] = [];
  private readonly accessRanges: AccessRange[] = [];

  constructor(city: CityFile, layout: CityLayout = cityLayout(city)) {
    const { texture } = getAtlas();
    const node = nodeLookup(city);
    const over = new MeshBuilder();
    const access = new MeshBuilder();

    // tráfego: uma tira por faixa e lado de cada via inteira (cor atualizada em tempo real)
    for (const e of city.edges) {
      const A = node(e.from), B = node(e.to);
      const d = new Vector3(B.x - A.x, 0, B.y - A.y).normalize();
      const right = new Vector3(-d.z, 0, d.x);
      const s = new Vector3(A.x, 0.06, A.y).addScaledVector(d, 0.5), t = new Vector3(B.x, 0.06, B.y).addScaledVector(d, -0.5);
      for (const l of LANE_LAYOUT) {
        const start = over.triCount * 3;
        over.quad(s.clone().addScaledVector(right, l.o0), s.clone().addScaledVector(right, l.o1),
          t.clone().addScaledVector(right, l.o1), t.clone().addScaledVector(right, l.o0), { color: GREEN }, new Vector3(0, 1, 0));
        this.strips.push({ edge: e.id, lane: l.kind, side: l.o0 < 0 ? -1 : 1, start });
      }
    }

    // acessibilidade: faixa sobre o canal, verde se há rota acessível
    for (const c of layout.crossings) {
      const ok = crossingIsAccessible(c.crossing);
      const start = access.triCount * 3;
      access.at(c.x, 0.35, c.zMid, 0, (b) =>
        b.box(1.5, 0.04, c.length - 1, { color: ok ? GREEN : RED, omit: ['bottom'] }));
      this.accessRanges.push({ crossing: c.crossing.id, start, end: access.triCount * 3, ok, shade: [] });
    }

    this.traffic = new Mesh(over.build(), createPs1Material({ map: texture, opacity: 0.8 }));
    this.traffic.visible = false;
    this.traffic.renderOrder = 2;
    this.access = new Mesh(access.build(), createPs1Material({ map: texture, opacity: 0.7 }));
    this.access.visible = false;

    // luz baked por vértice (cor gravada ÷ cor base), para repintar sem perder o sombreado
    const col = this.access.geometry.getAttribute('color') as BufferAttribute;
    for (const r of this.accessRanges) {
      const base = new Vector3().setFromColor(colorOf(r.ok));
      const sum = base.x + base.y + base.z || 1;
      for (let i = r.start; i < r.end; i++) r.shade.push((col.getX(i) + col.getY(i) + col.getZ(i)) / sum);
    }
  }

  /** Pinta o overlay de tráfego: ocupação 0 → verde, 0.5 → amarelo, ≥1 → vermelho. */
  paintTraffic(occupancy: (s: OverlayStrip) => number) {
    const col = this.traffic.geometry.getAttribute('color') as BufferAttribute;
    for (const s of this.strips) {
      const v = Math.min(1, Math.max(0, occupancy(s)));
      const r = v < 0.5 ? v * 2 : 1, g = v < 0.5 ? 1 : 1 - (v - 0.5) * 2;
      for (let k = 0; k < 6; k++) col.setXYZ(s.start + k, r * 0.95, g * 0.9, 0.12);
    }
    col.needsUpdate = true;
  }

  /** Overlay de tráfego direto do estado (`SimState.lanes`). */
  paintTrafficState(state: Pick<SimState, 'lanes'>) {
    this.paintTraffic(laneOccupancy(state));
  }

  /** Overlay de acessibilidade a partir de `SimState.crossings` (só repinta o que mudou). */
  paintAccess(state: Pick<SimState, 'crossings'>) {
    const col = this.access.geometry.getAttribute('color') as BufferAttribute;
    let dirty = false;
    for (const cs of state.crossings) {
      for (const r of this.accessRanges) {
        if (r.crossing !== cs.id || r.ok === cs.accessible) continue;
        r.ok = cs.accessible;
        const c = colorOf(r.ok);
        r.shade.forEach((k, i) => col.setXYZ(r.start + i, c.r * k, c.g * k, c.b * k));
        dirty = true;
      }
    }
    if (dirty) col.needsUpdate = true;
  }
}

/** Mesma conversão de cor do MeshBuilder (three Color). */
function colorOf(ok: boolean): Color {
  return new Color(ok ? GREEN : RED);
}
