import * as THREE from 'three';
import { Rng } from '../core/Rng';
import type { BuildingKind, CityEdge, CityFile } from '../core/types';
import { createPs1Material } from './ps1/Ps1Material';
import { QuadBuilder, setQuadColor } from './QuadBuilder';
import { asphaltTexture, grassTexture, plainTexture } from './textures';

/** Alturas (y) das camadas planas, para evitar z-fighting. */
export const LAYER = { ground: 0, road: 0.02, junction: 0.03, overlay: 0.06 } as const;

const ROAD_TINT: Record<CityEdge['kind'], number> = {
  street: 0xffffff,
  avenue: 0xd4d4e8,
  highway: 0xb8c4ff,
};
const BUS_LANE_TINT = 0xff9a88;

/** Placeholders até chegarem os .glb da Arte: cor, faixa de altura e pegada (tiles). */
const BUILDING_STYLE: Record<BuildingKind, { color: number; h: [number, number]; foot: [number, number] }> = {
  res: { color: 0xd8b48a, h: [1.2, 3.5], foot: [2.2, 2.2] },
  com: { color: 0x8aa8d8, h: [4, 9], foot: [2.4, 2.4] },
  ind: { color: 0xa09a88, h: [1.6, 2.6], foot: [2.6, 2.0] },
  school: { color: 0xe8d070, h: [1.8, 2.2], foot: [2.6, 2.6] },
  hospital: { color: 0xf0f0f0, h: [4.5, 5.5], foot: [2.6, 2.6] },
  park: { color: 0x5aa04a, h: [0.12, 0.12], foot: [2.8, 2.8] },
};

/** Largura visual de uma via em tiles. */
export function roadWidth(e: CityEdge): number {
  const total = e.oneWay ? e.lanes : e.lanes * 2;
  return 0.3 + 0.45 * total;
}

/**
 * Visual estático da cidade: chão, vias, cruzamentos, prédios (instanciados) e semáforos.
 * Mapeamento: city.x → x, city.y → z, altura → y.
 */
export class CityView {
  readonly group = new THREE.Group();
  private readonly roadGeometry: THREE.BufferGeometry;
  /** city edge id → índice do quad na geometria das vias. */
  private readonly roadQuad = new Map<number, number>();
  private readonly baseColor = new Map<number, THREE.Color>();

  constructor(private readonly city: CityFile) {
    const nodePos = new Map(city.nodes.map((n) => [n.id, n] as const));

    // ---- chão
    const { w, h } = city.size;
    const margin = 16;
    const groundGeo = new THREE.PlaneGeometry(w + margin * 2, h + margin * 2, 16, 16);
    groundGeo.rotateX(-Math.PI / 2);
    const uv = groundGeo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((w + margin * 2) / 4), uv.getY(i) * ((h + margin * 2) / 4));
    const ground = new THREE.Mesh(groundGeo, createPs1Material({ map: grassTexture() }));
    ground.position.set(w / 2, LAYER.ground, h / 2);
    this.group.add(ground);

    // ---- vias
    const roads = new QuadBuilder();
    const maxWidthAtNode = new Map<number, number>();
    for (const e of city.edges) {
      const a = nodePos.get(e.from)!;
      const b = nodePos.get(e.to)!;
      const width = roadWidth(e);
      const color = new THREE.Color(e.lanesReserved?.includes('bus') ? BUS_LANE_TINT : ROAD_TINT[e.kind]);
      this.baseColor.set(e.id, color);
      this.roadQuad.set(e.id, roads.segment(a.x, a.y, b.x, b.y, width, LAYER.road, color));
      for (const id of [e.from, e.to]) maxWidthAtNode.set(id, Math.max(maxWidthAtNode.get(id) ?? 0, width));
    }
    this.roadGeometry = roads.build();
    this.group.add(new THREE.Mesh(this.roadGeometry, createPs1Material({ map: asphaltTexture(), vertexColors: true, side: THREE.DoubleSide })));

    // ---- cruzamentos
    const junctions = new QuadBuilder();
    const junctionColor = new THREE.Color(0x4a4a52);
    for (const [id, width] of maxWidthAtNode) {
      const n = nodePos.get(id)!;
      junctions.square(n.x, n.y, width, LAYER.junction, junctionColor);
    }
    this.group.add(new THREE.Mesh(junctions.build(), createPs1Material({ map: plainTexture(), vertexColors: true, side: THREE.DoubleSide })));

    // ---- prédios (um InstancedMesh para todos; cor por instância, luz "baked" por face)
    this.group.add(this.buildBuildings());

    // ---- semáforos (postes simples)
    const signaled = city.nodes.filter((n) => n.signal);
    if (signaled.length > 0) {
      const pole = new THREE.BoxGeometry(0.25, 1.4, 0.25);
      pole.translate(0, 0.7, 0);
      const mesh = new THREE.InstancedMesh(pole, createPs1Material({ color: 0xffd040 }), signaled.length);
      const m = new THREE.Matrix4();
      signaled.forEach((n, i) => {
        const off = (maxWidthAtNode.get(n.id) ?? 1) / 2 + 0.2;
        mesh.setMatrixAt(i, m.makeTranslation(n.x + off, 0, n.y + off));
      });
      this.group.add(mesh);
    }
  }

  /** Recolore vias (ex.: overlay de congestionamento). null volta à cor base. */
  setEdgeColors(colorOf: (cityEdgeId: number) => THREE.Color | null): void {
    for (const [id, quad] of this.roadQuad) {
      setQuadColor(this.roadGeometry, quad, colorOf(id) ?? this.baseColor.get(id)!);
    }
  }

  private buildBuildings(): THREE.InstancedMesh {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    bakeFaceShading(box);

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
      color.setHex(style.color).multiplyScalar(0.9 + rng.next() * 0.2);
      mesh.setColorAt(i, color);
    });
    return mesh;
  }
}

/** Cor de vértice por direção da face, imitando luz "pintada" no vértice (sem luz dinâmica). */
function bakeFaceShading(geo: THREE.BufferGeometry): void {
  const normal = geo.getAttribute('normal') as THREE.BufferAttribute;
  const colors: number[] = [];
  for (let i = 0; i < normal.count; i++) {
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const nz = normal.getZ(i);
    let s = 0.6;
    if (ny > 0.5) s = 1.0;
    else if (nx > 0.5) s = 0.85;
    else if (nz > 0.5) s = 0.75;
    else if (nx < -0.5) s = 0.62;
    else if (nz < -0.5) s = 0.55;
    colors.push(s, s, s);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}
