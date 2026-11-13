import { Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, type ShaderMaterial } from 'three';
import type { LaneKind } from '../core/types';
import { LANE_OFFSET } from '../render/CityView';
import { buildModel } from '../render/models/catalog';
import { pickLook } from '../render/palette';
import { createPs1Material } from '../render/ps1/Ps1Material';
import { getAtlas } from '../render/textures/Atlas';
import { makeRng } from '../render/util';
import type { SimState } from './SimulationPort';

/**
 * Contrato mínimo de uma vista da simulação: o loop chama `update` uma vez por quadro
 * com o estado mais recente e a fração `alpha` do próximo tick (para interpolar).
 *
 * PONTO DE TROCA: `SimpleSimView` é provisória (PC3). O `SimView` definitivo é do PC1
 * (`src/render/SimView.ts`, Onda 1/2); quando existir, implemente esta interface com ele em
 * `src/game/main.ts` (função `createSimView`) e apague este arquivo.
 */
export interface SimViewPort {
  readonly group: Group;
  update(state: SimState, alpha: number): void;
}

interface Pose { x: number; y: number; heading: number }
interface Slot { mesh: InstancedMesh; capacity: number }

const TELEPORT_TILES = 2.5;

/** Agentes como instâncias dos modelos procedurais do PC1 (`veh_<kind>`), um InstancedMesh por modelo. */
export class SimpleSimView implements SimViewPort {
  readonly group = new Group();
  private readonly material: ShaderMaterial;
  private readonly slots = new Map<string, Slot>();
  private from = new Map<string, Pose>();
  private to = new Map<string, Pose>();
  private lastMinute = Number.NaN;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3(1, 1, 1);
  private readonly up = new Vector3(0, 1, 0);

  constructor() {
    this.material = createPs1Material({ map: getAtlas().texture, instanced: true });
  }

  update(state: SimState, alpha: number): void {
    if (state.minute !== this.lastMinute) {
      this.from = this.to;
      this.to = new Map();
      for (const a of state.agents) this.to.set(`a${a.id}`, { x: a.x, y: a.y, heading: a.heading });
      state.transit.forEach((t, i) => this.to.set(`t${i}`, { x: t.x, y: t.y, heading: t.heading }));
      this.lastMinute = state.minute;
    }

    // 1ª passada: quantas instâncias de cada modelo (para crescer as malhas antes de escrever matrizes)
    const need = new Map<string, number>();
    const bump = (model: string) => need.set(model, (need.get(model) ?? 0) + 1);
    for (const a of state.agents) bump(`veh_${a.vehicle}`);
    for (const t of state.transit) bump(`veh_${t.kind}`);
    for (const [model, n] of need) this.slot(model, n);

    const counts = new Map<string, number>();
    const place = (model: string, key: string, lane: LaneKind | null) => {
      const cur = this.to.get(key);
      if (!cur) return;
      const prev = this.from.get(key);
      let x = cur.x, y = cur.y;
      if (prev && Math.hypot(cur.x - prev.x, cur.y - prev.y) < TELEPORT_TILES) {
        x = prev.x + (cur.x - prev.x) * alpha;
        y = prev.y + (cur.y - prev.y) * alpha;
      }
      const h = cur.heading;
      const off = LANE_OFFSET[lane ?? 'sidewalk'];
      // à direita do sentido de marcha (mesma convenção do DemoTraffic): right = (-sen h, cos h)
      this.p.set(x - Math.sin(h) * off, 0, y + Math.cos(h) * off);
      this.q.setFromAxisAngle(this.up, Math.atan2(Math.cos(h), Math.sin(h))); // modelo olha para +z
      this.m.compose(this.p, this.q, this.s);
      const n = counts.get(model) ?? 0;
      counts.set(model, n + 1);
      this.slots.get(model)?.mesh.setMatrixAt(n, this.m);
    };

    for (const a of state.agents) place(`veh_${a.vehicle}`, `a${a.id}`, a.lane);
    state.transit.forEach((t, i) => place(`veh_${t.kind}`, `t${i}`, 'transit'));

    for (const [model, slot] of this.slots) {
      slot.mesh.count = counts.get(model) ?? 0;
      slot.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Garante um InstancedMesh com capacidade para `need` instâncias (dobra quando falta). */
  private slot(model: string, need: number): Slot {
    const old = this.slots.get(model);
    if (old && old.capacity >= need) return old;
    const capacity = Math.max(16, need * 2, (old?.capacity ?? 0) * 2);
    const geo = buildModel(model).opaque.clone();
    geo.setAttribute('iColor2', new InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    geo.setAttribute('iColor3', new InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    const mesh = new InstancedMesh(geo, this.material, capacity);
    mesh.frustumCulled = false;
    // cores por instância seguindo as regras da paleta (determinístico por modelo)
    const rng = makeRng([...model].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
    const c2 = geo.getAttribute('iColor2') as InstancedBufferAttribute;
    const c3 = geo.getAttribute('iColor3') as InstancedBufferAttribute;
    for (let i = 0; i < capacity; i++) {
      const look = pickLook(rng);
      mesh.setColorAt(i, new Color(look.vehicle.hex));
      const o = new Color(look.outfit.hex), k = new Color(look.skin);
      c2.setXYZ(i, o.r, o.g, o.b);
      c3.setXYZ(i, k.r, k.g, k.b);
    }
    if (old) {
      this.group.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.dispose();
    }
    const slot = { mesh, capacity };
    this.slots.set(model, slot);
    this.group.add(mesh);
    return slot;
  }
}
