import { BufferAttribute, Group, Matrix4, Mesh, Vector3 } from 'three';
import type { CityCrossing, CityEdge, CityFile, LaneKind } from '../core/CityFile';
import { crossingIsAccessible } from '../core/CityFile';
import { MeshBuilder, type Paint } from './models/MeshBuilder';
import { buildModel } from './models/catalog';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas, type TileName } from './textures/Atlas';
import { TILE_M } from './util';

/**
 * Desenha a cidade estática (SPEC §7.5/7.6): chão, canal, vias com faixas por tipo,
 * prédios, travessias radicais e props. Tudo vira poucas malhas grandes (poucas draw calls).
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
/** Deslocamento lateral (à direita do sentido) de quem anda em cada faixa. */
export const LANE_OFFSET: Record<LaneKind, number> = { sidewalk: 0.4, slow: 0.24, fast: 0.12, transit: 0.025 };

const LANE_TILE: Record<LaneKind, TileName> = {
  sidewalk: 'sidewalk', slow: 'lane_slow', fast: 'lane_fast', transit: 'lane_transit',
};

const RADICAL_MODEL: Record<string, string> = {
  ramp_bridge: 'rad_ramp_bridge', death_jump: 'rad_death_jump', rail_walkway: 'rad_rail_walkway', air_loop: 'rad_air_loop',
};
const FEATURE_MODEL: Record<string, string> = {
  air_loop: 'rad_air_loop', wallride: 'rad_wallride', quarter: 'rad_quarter', bowl: 'rad_bowl',
  stop_shelter: 'prop_stop_shelter', share_station: 'prop_share_station', crt_billboard: 'prop_crt_billboard',
  tree: 'prop_tree_aero', lamp: 'prop_lamp', bench: 'prop_bench',
};

export interface OverlayStrip { edge: number; lane: LaneKind; side: number; start: number }

export class CityView {
  readonly group = new Group();
  readonly overlay: Mesh;
  readonly accessOverlay: Mesh;
  readonly strips: OverlayStrip[] = [];
  readonly canalSpanM: number;
  readonly liftCabins: { crossing: CityCrossing; x: number; zA: number; zB: number }[] = [];

  constructor(readonly city: CityFile) {
    const { texture } = getAtlas();
    const opaque = new MeshBuilder();
    const glass = new MeshBuilder();
    const water = new MeshBuilder();
    const over = new MeshBuilder();
    const access = new MeshBuilder();
    const canal = city.canal ?? { y0: 0, y1: 0 };
    this.canalSpanM = (canal.y1 - canal.y0) * TILE_M;

    this.ground(opaque, water);
    for (const e of city.edges) this.road(opaque, over, e);
    for (const n of city.nodes) this.intersection(opaque, n.x, n.y);

    const place = (id: string, x: number, z: number, rot: number, span?: number) => {
      const m = buildModel(id, span);
      const mat = new Matrix4().makeTranslation(x, 0, z).multiply(new Matrix4().makeRotationY(rot));
      opaque.addGeometry(m.opaque, mat);
      if (m.glass) glass.addGeometry(m.glass, mat);
    };

    for (const b of city.buildings) place(b.model, b.x, b.y, (b.rotation * Math.PI) / 2);
    for (const f of city.features ?? []) place(FEATURE_MODEL[f.kind], f.x, f.y, (f.rot * Math.PI) / 2);

    for (const c of city.crossings) {
      const A = city.nodes[c.from], B = city.nodes[c.to];
      const x = A.x, zMid = (canal.y0 + canal.y1) / 2;
      place(RADICAL_MODEL[c.radical], x, zMid, 0, this.canalSpanM);
      if (c.access === 'bubble_lift') {
        place('rad_bubble_lift', x + 0.62, zMid, 0, this.canalSpanM);
        const half = (this.canalSpanM / 2 + 2) / TILE_M;
        this.liftCabins.push({ crossing: c, x: x + 0.62, zA: zMid - half, zB: zMid + half });
      }
      // overlay de acessibilidade: faixa sobre o canal, verde se há rota acessível
      const ok = crossingIsAccessible(c);
      access.at(x, 0.35, zMid, 0, (b) =>
        b.box(1.5, 0.04, (B.y - A.y) - 1, { color: ok ? '#39FF6A' : '#E8322C', omit: ['bottom'] }));
    }

    const mk = (b: MeshBuilder, mat: ReturnType<typeof createPs1Material>) => new Mesh(b.build(), mat);
    this.group.add(mk(opaque, createPs1Material({ map: texture })));
    if (glass.triCount) this.group.add(mk(glass, createPs1Material({ map: texture, opacity: 0.45 })));
    this.group.add(mk(water, createPs1Material({ map: texture, scroll: [0.05, 0.12] })));
    this.overlay = mk(over, createPs1Material({ map: texture, opacity: 0.8 }));
    this.overlay.visible = false;
    this.overlay.renderOrder = 2;
    this.group.add(this.overlay);
    this.accessOverlay = mk(access, createPs1Material({ map: texture, opacity: 0.7 }));
    this.accessOverlay.visible = false;
    this.group.add(this.accessOverlay);
  }

  private ground(o: MeshBuilder, water: MeshBuilder) {
    const { w, h } = this.city.size;
    const canal = this.city.canal;
    // Pisos grandes são subdivididos (como no PS1) para o affine warping não deformar demais;
    // UV em coordenadas de mundo para não haver costura entre os pedaços.
    const flat = (b: MeshBuilder, x0: number, z0: number, x1: number, z1: number, y: number, p: Paint, step = 1) => {
      const s = p.uvScale ?? 1;
      const up = new Vector3(0, 1, 0);
      for (let x = x0; x < x1 - 1e-6; x += step) for (let z = z0; z < z1 - 1e-6; z += step) {
        const xa = x, xb = Math.min(x + step, x1), za = z, zb = Math.min(z + step, z1);
        const uv = (X: number, Z: number) => [X * s, Z * s];
        const A = new Vector3(xa, y, za), B = new Vector3(xb, y, za), C = new Vector3(xb, y, zb), D = new Vector3(xa, y, zb);
        b.tri(A, B, C, uv(xa, za), uv(xb, za), uv(xb, zb), p, up);
        b.tri(A, C, D, uv(xa, za), uv(xb, zb), uv(xa, zb), p, up);
      }
    };
    // gramado em volta + "ilhas" de concreto nos quarteirões
    const pad = 30;
    const grass: Paint = { tile: 'grass', uvScale: 0.5 };
    flat(o, -pad, -pad, w + pad, -0.5, -0.01, grass, 2);
    flat(o, -pad, h - 0.5, w + pad, h + pad, -0.01, grass, 2);
    const bands: [number, number][] = canal ? [[-0.5, canal.y0], [canal.y1, h - 0.5]] : [[-0.5, h - 0.5]];
    for (const [z0, z1] of bands) {
      flat(o, -pad, z0, -0.5, z1, -0.01, grass, 2);
      flat(o, w - 1.5, z0, w + pad, z1, -0.01, grass, 2);
    }
    if (canal) {
      flat(o, -0.5, -0.5, w - 1.5, canal.y0, 0, { tile: 'sidewalk', uvScale: 2 });
      flat(o, -0.5, canal.y1, w - 1.5, h - 0.5, 0, { tile: 'sidewalk', uvScale: 2 });
      // canal: água rebaixada + muretas de concreto
      flat(water, -pad, canal.y0, w + pad, canal.y1, -0.18, { tile: 'water', uvScale: 1, gloss: 0.35 }, 1.2);
      for (const [z, n] of [[canal.y0, 1], [canal.y1, -1]] as const) {
        o.quad(new Vector3(-pad, -0.2, z), new Vector3(w + pad, -0.2, z), new Vector3(w + pad, 0, z), new Vector3(-pad, 0, z),
          { tile: 'concrete', uvScale: 1 }, new Vector3(0, 0, n));
      }
    }
  }

  private road(o: MeshBuilder, over: MeshBuilder, e: CityEdge) {
    const A = this.city.nodes[e.from], B = this.city.nodes[e.to];
    const a = new Vector3(A.x, 0, A.y), b = new Vector3(B.x, 0, B.y);
    const d = b.clone().sub(a).normalize();
    const right = new Vector3(-d.z, 0, d.x);
    const a0 = a.clone().addScaledVector(d, 0.5), b0 = b.clone().addScaledVector(d, -0.5);
    // um pedaço por tile de comprimento (subdivisão anti-affine; 1 repetição de textura por pedaço)
    const pieces = Math.max(1, Math.round(a0.distanceTo(b0)));
    for (let k = 0; k < pieces; k++) {
      this.roadPiece(o, over, e, a0.clone().lerp(b0, k / pieces), a0.clone().lerp(b0, (k + 1) / pieces), right, k === 0);
    }
  }

  private roadPiece(o: MeshBuilder, over: MeshBuilder, e: CityEdge, a2: Vector3, b2: Vector3, right: Vector3, first: boolean) {
    for (const l of LANE_LAYOUT) {
      const has = (e.lanes[l.kind] ?? 0) > 0;
      const y = l.kind === 'sidewalk' ? 0.03 : 0.012;
      const p0 = a2.clone().addScaledVector(right, l.o0).setY(y), p1 = a2.clone().addScaledVector(right, l.o1).setY(y);
      const q1 = b2.clone().addScaledVector(right, l.o1).setY(y), q0 = b2.clone().addScaledVector(right, l.o0).setY(y);
      const width = l.o1 - l.o0;
      const paint: Paint = has
        ? { tile: LANE_TILE[l.kind], uvU: l.kind === 'sidewalk' ? 1.5 : 1 / width, uvV: l.kind === 'sidewalk' ? 1.5 : 1 }
        : { tile: 'asphalt', uvScale: 1 };
      // faixas do lado esquerdo invertem o sentido do tracejado (borda interna)
      if (l.o0 < 0) o.quad(q1, q0, p0, p1, paint, new Vector3(0, 1, 0));
      else o.quad(p0, p1, q1, q0, paint, new Vector3(0, 1, 0));
      if (l.kind === 'sidewalk') { // meio-fio
        const edge = l.o0 < 0 ? l.o1 : l.o0;
        const c0 = a2.clone().addScaledVector(right, edge), c1 = b2.clone().addScaledVector(right, edge);
        o.quad(c0.clone().setY(0.012), c1.clone().setY(0.012), c1.clone().setY(0.03), c0.clone().setY(0.03),
          { tile: 'concrete', uvScale: 1 }, right.clone().multiplyScalar(l.o0 < 0 ? 1 : -1));
      }
      // tira do overlay de tráfego (cor atualizada em tempo real); uma por via inteira
      if (first) {
        const A = this.city.nodes[e.from], B = this.city.nodes[e.to];
        const d = new Vector3(B.x - A.x, 0, B.y - A.y).normalize();
        const s = new Vector3(A.x, 0.06, A.y).addScaledVector(d, 0.5), t = new Vector3(B.x, 0.06, B.y).addScaledVector(d, -0.5);
        const start = over.triCount * 3;
        over.quad(s.clone().addScaledVector(right, l.o0), s.clone().addScaledVector(right, l.o1),
          t.clone().addScaledVector(right, l.o1), t.clone().addScaledVector(right, l.o0), { color: '#39FF6A' }, new Vector3(0, 1, 0));
        this.strips.push({ edge: e.id, lane: l.kind, side: l.o0 < 0 ? -1 : 1, start });
      }
    }
  }

  private intersection(o: MeshBuilder, x: number, z: number) {
    const q = (x0: number, z0: number, x1: number, z1: number, y: number, p: Paint) =>
      o.quad(new Vector3(x0, y, z0), new Vector3(x1, y, z0), new Vector3(x1, y, z1), new Vector3(x0, y, z1), p, new Vector3(0, 1, 0));
    q(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.011, { tile: 'asphalt', uvScale: 1 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = x + sx * 0.4, cz = z + sz * 0.4;
      q(cx - 0.1, cz - 0.1, cx + 0.1, cz + 0.1, 0.03, { tile: 'sidewalk', uvScale: 1.5 });
    }
    // faixas de pedestre brancas nos quatro lados
    for (let i = -2; i <= 2; i++) {
      const t = i * 0.12;
      q(x + t - 0.03, z - 0.5, x + t + 0.03, z - 0.32, 0.013, { color: '#F2F8FC' });
      q(x + t - 0.03, z + 0.32, x + t + 0.03, z + 0.5, 0.013, { color: '#F2F8FC' });
      q(x - 0.5, z + t - 0.03, x - 0.32, z + t + 0.03, 0.013, { color: '#F2F8FC' });
      q(x + 0.32, z + t - 0.03, x + 0.5, z + t + 0.03, 0.013, { color: '#F2F8FC' });
    }
  }

  /** Pinta o overlay de tráfego: ocupação 0 → verde, 0.5 → amarelo, ≥1 → vermelho. */
  paintTraffic(occupancy: (s: OverlayStrip) => number) {
    const col = this.overlay.geometry.getAttribute('color') as BufferAttribute;
    for (const s of this.strips) {
      const v = Math.min(1, Math.max(0, occupancy(s)));
      const r = v < 0.5 ? v * 2 : 1, g = v < 0.5 ? 1 : 1 - (v - 0.5) * 2;
      for (let k = 0; k < 6; k++) col.setXYZ(s.start + k, r * 0.95, g * 0.9, 0.12);
    }
    col.needsUpdate = true;
  }
}
