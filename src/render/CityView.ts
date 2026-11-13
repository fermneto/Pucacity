import * as THREE from 'three';
import { Rng } from '../core/Rng';
import { METERS_PER_TILE } from '../core/RoadGraph';
import type { BuildingKind, CityEdge, CityFile, LaneKind } from '../core/types';
import { hex, LANE_COLOR, WORLD } from './palette';
import { createPs1Material } from './ps1/Ps1Material';
import { QuadBuilder, setQuadColor } from './QuadBuilder';
import { bakeFaceShading } from './shading';
import { grassTexture, plainTexture, waterTexture } from './textures';

/** Alturas (y) das camadas planas, para evitar z-fighting. */
export const LAYER = { ground: 0, water: 0.01, roadBase: 0.02, lane: 0.03, junction: 0.04, overlay: 0.07 } as const;

/**
 * Exagero visual da largura das vias. Uma rua de 7 m teria 0,7 tile (~4 px em 320×240) e as faixas
 * ficariam ilegíveis; a simulação continua usando a largura real.
 */
export const ROAD_VISUAL_SCALE = 2.2;

/** Peso relativo de cada faixa na largura da via (placeholder até o balance.json). */
const LANE_WEIGHT: Record<LaneKind, number> = { sidewalk: 1, slow: 1, fast: 1, transit: 1.3 };

/** Placeholders até chegarem os .glb da Arte: cor, faixa de altura e pegada (tiles). */
const BUILDING_STYLE: Record<BuildingKind, { color: number; h: [number, number]; foot: [number, number] }> = {
  res: { color: 0xbdb4a4, h: [1.2, 3.5], foot: [2.2, 2.2] }, // Bege Concreto
  com: { color: hex(WORLD.vidro), h: [4, 9], foot: [2.4, 2.4] }, // torres de vidro
  ind: { color: hex(WORLD.concreto), h: [1.6, 2.6], foot: [2.6, 2.0] },
  school: { color: 0xffe23a, h: [1.8, 2.2], foot: [2.6, 2.6] }, // Amarelo Grip Neon
  hospital: { color: 0xf2f8fc, h: [4.5, 5.5], foot: [2.6, 2.6] }, // Branco Gelo Lustroso
  park: { color: 0x6ccb3f, h: [0.12, 0.12], foot: [2.8, 2.8] },
  skatepark: { color: hex(WORLD.cromo), h: [0.3, 0.3], foot: [2.8, 2.8] },
};

/** Largura visual de uma via em tiles. */
export function roadVisualWidth(e: CityEdge): number {
  return (e.width / METERS_PER_TILE) * ROAD_VISUAL_SCALE;
}

/** Faixas da esquerda para a direita (olhando de from → to). */
export function laneStrips(e: CityEdge): LaneKind[] {
  const n = (k: LaneKind) => e.lanes[k] ?? 0;
  const repeat = (k: LaneKind, times: number) => Array.from({ length: times }, () => k);
  const side = (order: LaneKind[]) => order.flatMap((k) => repeat(k, n(k)));
  if (!e.oneWay) {
    const outerToInner = side(['sidewalk', 'slow', 'fast', 'transit']);
    return [...outerToInner, ...[...outerToInner].reverse()];
  }
  const sw = n('sidewalk');
  const left = Math.ceil(sw / 2);
  return [...repeat('sidewalk', left), ...side(['slow', 'fast', 'transit']), ...repeat('sidewalk', sw - left)];
}

/**
 * Visual estático da cidade: chão, água, vias com uma tira por faixa, cruzamentos, prédios e semáforos.
 * Mapeamento: city.x → x, city.y → z, altura → y. As travessias ficam em RadicalView.
 */
export class CityView {
  readonly group = new THREE.Group();
  private readonly laneGeometry: THREE.BufferGeometry;
  /** city edge id → quads das faixas (com a cor base de cada uma). */
  private readonly edgeQuads = new Map<number, { quad: number; base: THREE.Color }[]>();

  constructor(private readonly city: CityFile) {
    const nodePos = new Map(city.nodes.map((n) => [n.id, n] as const));
    const { w, h } = city.size;

    // ---- chão (gramado Aero)
    const margin = 16;
    const groundGeo = new THREE.PlaneGeometry(w + margin * 2, h + margin * 2, 16, 16);
    groundGeo.rotateX(-Math.PI / 2);
    const uv = groundGeo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((w + margin * 2) / 4), uv.getY(i) * ((h + margin * 2) / 4));
    const ground = new THREE.Mesh(groundGeo, createPs1Material({ map: grassTexture() }));
    ground.position.set(w / 2, LAYER.ground, h / 2);
    this.group.add(ground);

    // ---- áreas (água e bloqueadas)
    const water = new QuadBuilder();
    const blocked = new QuadBuilder();
    const white = new THREE.Color(0xffffff);
    for (const a of city.areas ?? []) {
      const target = a.kind === 'water' ? water : blocked;
      target.segment(a.x, a.y + a.h / 2, a.x + a.w, a.y + a.h / 2, a.h, LAYER.water, a.kind === 'water' ? white : new THREE.Color(0x8a7a6a), 2);
    }
    if (water.quadCount > 0) {
      this.group.add(new THREE.Mesh(water.build(), createPs1Material({ map: waterTexture(), vertexColors: true, side: THREE.DoubleSide })));
    }
    if (blocked.quadCount > 0) {
      this.group.add(new THREE.Mesh(blocked.build(), createPs1Material({ map: plainTexture(), vertexColors: true, side: THREE.DoubleSide })));
    }

    // ---- vias: base escura + uma tira por faixa (o vão entre tiras vira a marcação)
    const base = new QuadBuilder();
    const lanes = new QuadBuilder();
    const asphalt = new THREE.Color(hex(WORLD.asfalto));
    const maxWidthAtNode = new Map<number, number>();
    for (const e of city.edges) {
      const a = nodePos.get(e.from)!;
      const b = nodePos.get(e.to)!;
      const width = roadVisualWidth(e);
      base.segment(a.x, a.y, b.x, b.y, width, LAYER.roadBase, asphalt);

      const strips = laneStrips(e);
      const totalWeight = strips.reduce((s, k) => s + LANE_WEIGHT[k], 0) || 1;
      let cursor = width / 2; // borda esquerda
      const quads: { quad: number; base: THREE.Color }[] = [];
      for (const k of strips) {
        const sw = (width * LANE_WEIGHT[k]) / totalWeight;
        const color = new THREE.Color(LANE_COLOR[k]);
        quads.push({ quad: lanes.strip(a.x, a.y, b.x, b.y, cursor - sw / 2, sw * 0.82, LAYER.lane, color), base: color });
        cursor -= sw;
      }
      this.edgeQuads.set(e.id, quads);
      for (const id of [e.from, e.to]) maxWidthAtNode.set(id, Math.max(maxWidthAtNode.get(id) ?? 0, width));
    }
    const plain = plainTexture();
    this.group.add(new THREE.Mesh(base.build(), createPs1Material({ vertexColors: true, side: THREE.DoubleSide })));
    this.laneGeometry = lanes.build();
    this.group.add(new THREE.Mesh(this.laneGeometry, createPs1Material({ map: plain, vertexColors: true, side: THREE.DoubleSide })));

    // ---- cruzamentos (concreto)
    const junctions = new QuadBuilder();
    const junctionColor = new THREE.Color(hex(WORLD.concreto_sombra));
    for (const [id, width] of maxWidthAtNode) {
      const n = nodePos.get(id)!;
      junctions.square(n.x, n.y, width, LAYER.junction, junctionColor);
    }
    this.group.add(new THREE.Mesh(junctions.build(), createPs1Material({ map: plain, vertexColors: true, side: THREE.DoubleSide })));

    // ---- prédios (um InstancedMesh para todos; cor por instância, luz "baked" por face)
    this.group.add(this.buildBuildings());

    // ---- semáforos (postes simples)
    const signaled = city.nodes.filter((n) => n.signal);
    if (signaled.length > 0) {
      const pole = new THREE.BoxGeometry(0.25, 1.4, 0.25);
      pole.translate(0, 0.7, 0);
      const mesh = new THREE.InstancedMesh(pole, createPs1Material({ color: hex(WORLD.faixa_lancamento) }), signaled.length);
      const m = new THREE.Matrix4();
      signaled.forEach((n, i) => {
        const off = (maxWidthAtNode.get(n.id) ?? 1) / 2 + 0.2;
        mesh.setMatrixAt(i, m.makeTranslation(n.x + off, 0, n.y + off));
      });
      this.group.add(mesh);
    }
  }

  /** Recolore vias inteiras (ex.: overlay de congestionamento). null volta às cores das faixas. */
  setEdgeColors(colorOf: (cityEdgeId: number) => THREE.Color | null): void {
    for (const [id, quads] of this.edgeQuads) {
      const c = colorOf(id);
      for (const q of quads) setQuadColor(this.laneGeometry, q.quad, c ?? q.base);
    }
  }

  private buildBuildings(): THREE.InstancedMesh {
    const box = bakeFaceShading(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    const list = this.city.buildings;
    const mesh = new THREE.InstancedMesh(box, createPs1Material({ vertexColors: true }), list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    list.forEach((b, i) => {
      const style = BUILDING_STYLE[b.kind];
      const rng = new Rng(b.id * 7919); // altura estável por prédio
      const height = style.h[0] + rng.next() * (style.h[1] - style.h[0]);
      q.setFromAxisAngle(up, (b.rotation * Math.PI) / 2);
      m.compose(new THREE.Vector3(b.x, 0, b.y), q, new THREE.Vector3(style.foot[0], height, style.foot[1]));
      mesh.setMatrixAt(i, m);
      color.setHex(style.color).multiplyScalar(0.9 + rng.next() * 0.1);
      mesh.setColorAt(i, color);
    });
    return mesh;
  }
}
