import { Group, Matrix4, Mesh, Vector3 } from 'three';
import type { CityEdge, CityFile, CityNode, LaneKind } from '../core/CityFile';
import { waterBands } from '../core/CityFile';
import { MeshBuilder, type Paint } from './models/MeshBuilder';
import { buildModel } from './models/catalog';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas, type TileName } from './textures/Atlas';
import { LANE_LAYOUT, Overlays, type OverlayStrip } from './Overlays';
import { cityLayout, nodeLookup, type LiftAnchor } from './SimState';

/**
 * Desenha a cidade estática (SPEC §7.5/7.6): chão, canal, vias com faixas por tipo,
 * prédios, travessias radicais e props. Tudo vira poucas malhas grandes (poucas draw calls).
 */

export { LANE_LAYOUT, type OverlayStrip } from './Overlays';
/** Deslocamento lateral (à direita do sentido) de quem anda em cada faixa. */
export { LANE_OFFSET } from './SimState';

const LANE_TILE: Record<LaneKind, TileName> = {
  sidewalk: 'sidewalk', slow: 'lane_slow', fast: 'lane_fast', transit: 'lane_transit',
};

const RADICAL_MODEL: Partial<Record<string, string>> = {
  ramp_bridge: 'rad_ramp_bridge', death_jump: 'rad_death_jump', rail_walkway: 'rad_rail_walkway', air_loop: 'rad_air_loop',
};
const FEATURE_MODEL: Partial<Record<string, string>> = {
  air_loop: 'rad_air_loop', wallride: 'rad_wallride', quarter: 'rad_quarter', bowl: 'rad_bowl',
  stop_shelter: 'prop_stop_shelter', share_station: 'prop_share_station', crt_billboard: 'prop_crt_billboard',
  tree: 'prop_tree_aero', lamp: 'prop_lamp', bench: 'prop_bench',
  spiral_tower: 'rad_spiral_tower', megapipe: 'rad_megapipe',
};

export class CityView {
  readonly group = new Group();
  /** Overlays de tráfego e acessibilidade (Overlays.ts), alimentados pelo SimState. */
  readonly overlays: Overlays;
  readonly canalSpanM: number;
  readonly liftCabins: LiftAnchor[];
  private readonly node: (id: number) => CityNode;

  constructor(readonly city: CityFile) {
    const { texture } = getAtlas();
    const opaque = new MeshBuilder();
    const glass = new MeshBuilder();
    const water = new MeshBuilder();
    const layout = cityLayout(city);
    this.node = nodeLookup(city);
    this.canalSpanM = layout.canalSpanM;
    this.liftCabins = layout.liftCabins;

    this.ground(opaque, water);
    for (const e of city.edges) this.road(opaque, e);
    for (const n of city.nodes) this.intersection(opaque, n.x, n.y);

    const place = (id: string, x: number, z: number, rot: number, span?: number) => {
      const m = buildModel(id, span);
      const mat = new Matrix4().makeTranslation(x, 0, z).multiply(new Matrix4().makeRotationY(rot));
      opaque.addGeometry(m.opaque, mat);
      if (m.glass) glass.addGeometry(m.glass, mat);
    };

    for (const b of city.buildings) place(b.model, b.x, b.y, (b.rotation * Math.PI) / 2);
    for (const f of city.features ?? []) {
      const model = FEATURE_MODEL[f.kind];
      if (model) place(model, f.x, f.y, (f.rot * Math.PI) / 2);
    }

    for (const c of layout.crossings) {
      const model = RADICAL_MODEL[c.crossing.radical];
      if (model) place(model, c.x, c.zMid, 0, this.canalSpanM);
      if (c.crossing.access === 'bubble_lift') place('rad_bubble_lift', c.x + 0.62, c.zMid, 0, this.canalSpanM);
    }

    const mk = (b: MeshBuilder, mat: ReturnType<typeof createPs1Material>) => new Mesh(b.build(), mat);
    this.group.add(mk(opaque, createPs1Material({ map: texture })));
    if (glass.triCount) this.group.add(mk(glass, createPs1Material({ map: texture, opacity: 0.45 })));
    this.group.add(mk(water, createPs1Material({ map: texture, scroll: [0.05, 0.12] })));
    this.overlays = new Overlays(city, layout);
    this.group.add(this.overlays.traffic);
    this.group.add(this.overlays.access);
  }

  /** Malha do overlay de tráfego (compatibilidade: use `overlays.traffic`). */
  get overlay(): Mesh {
    return this.overlays.traffic;
  }
  /** Malha do overlay de acessibilidade (compatibilidade: use `overlays.access`). */
  get accessOverlay(): Mesh {
    return this.overlays.access;
  }
  /** Tiras do overlay de tráfego. */
  get strips(): OverlayStrip[] {
    return this.overlays.strips;
  }

  private ground(o: MeshBuilder, water: MeshBuilder) {
    const { w, h } = this.city.size;
    const canals = waterBands(this.city);
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
    // gramado em volta + chão de concreto/calçada entre os canais
    const pad = 30;
    const grass: Paint = { tile: 'grass', uvScale: 0.5 };
    flat(o, -pad, -pad, w + pad, -0.5, -0.01, grass, 2);
    flat(o, -pad, h - 0.5, w + pad, h + pad, -0.01, grass, 2);
    const cuts = [-0.5, ...canals.flatMap((c) => [c.y0, c.y1]), h - 0.5];
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const z0 = cuts[k] ?? 0, z1 = cuts[k + 1] ?? 0;
      flat(o, -pad, z0, -0.5, z1, -0.01, grass, 2);
      flat(o, w - 1.5, z0, w + pad, z1, -0.01, grass, 2);
      flat(o, -0.5, z0, w - 1.5, z1, 0, { tile: 'sidewalk', uvScale: 2 });
    }
    for (const canal of canals) {
      // canal: água rebaixada + muretas de concreto (em pedaços, anti-affine)
      flat(water, -pad, canal.y0, w + pad, canal.y1, -0.18, { tile: 'water', uvScale: 1, gloss: 0.35 }, 1.2);
      for (const [z, n] of [[canal.y0, 1], [canal.y1, -1]] as const) {
        for (let x = -pad; x < w + pad; x += 2) {
          o.quad(new Vector3(x, -0.2, z), new Vector3(x + 2, -0.2, z), new Vector3(x + 2, 0, z), new Vector3(x, 0, z),
            { tile: 'concrete', uvScale: 1 }, new Vector3(0, 0, n));
        }
      }
    }
  }

  private road(o: MeshBuilder, e: CityEdge) {
    const A = this.node(e.from), B = this.node(e.to);
    const a = new Vector3(A.x, 0, A.y), b = new Vector3(B.x, 0, B.y);
    const d = b.clone().sub(a).normalize();
    const right = new Vector3(-d.z, 0, d.x);
    const a0 = a.clone().addScaledVector(d, 0.5), b0 = b.clone().addScaledVector(d, -0.5);
    // um pedaço por tile de comprimento (subdivisão anti-affine; 1 repetição de textura por pedaço)
    const pieces = Math.max(1, Math.round(a0.distanceTo(b0)));
    for (let k = 0; k < pieces; k++) {
      this.roadPiece(o, e, a0.clone().lerp(b0, k / pieces), a0.clone().lerp(b0, (k + 1) / pieces), right);
    }
  }

  private roadPiece(o: MeshBuilder, e: CityEdge, a2: Vector3, b2: Vector3, right: Vector3) {
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
    }
  }

  private intersection(o: MeshBuilder, x: number, z: number) {
    const q = (x0: number, z0: number, x1: number, z1: number, y: number, p: Paint) =>
      o.quad(new Vector3(x0, y, z0), new Vector3(x1, y, z0), new Vector3(x1, y, z1), new Vector3(x0, y, z1), p, new Vector3(0, 1, 0));
    q(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.011, { tile: 'asphalt', uvScale: 1 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
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
    this.overlays.paintTraffic(occupancy);
  }
}
