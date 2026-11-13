import {
  Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, type Material,
} from 'three';
import { buildModel } from './models/catalog';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas } from './textures/Atlas';
import { pickLook } from './palette';
import { agentModel, type SimAgent, type SimState, type Vec3 } from './SimState';
import { makeRng, type Rng } from './util';

/**
 * Desenha os agentes da simulação: um InstancedMesh por modelo de veículo, lendo SOMENTE
 * um `SimState` (proposta de contrato em SimState.ts). Nenhuma regra de jogo aqui: posição,
 * direção, manobra e visibilidade vêm prontas do estado; o render só escolhe cores e malhas.
 */

interface Slot { model: string; index: number; frame: number }

const ZERO = new Matrix4().makeScale(0, 0, 0);
const ONE = new Vector3(1, 1, 1);
const NO_ROT = new Quaternion();

export class SimView {
  /** Todas as malhas de agentes (para quem prefere adicionar um grupo só à cena). */
  readonly group = new Group();
  readonly meshes = new Map<string, InstancedMesh>();
  readonly cabins: InstancedMesh;
  private cabinGlassMesh: InstancedMesh | null = null;
  private readonly material: Material;
  private readonly slots = new Map<number, Slot>();
  private readonly used = new Map<string, number>();
  private readonly rng: Rng;
  private liftCount: number;
  private frame = 0;

  // temporários reaproveitados (milhares de agentes por quadro)
  private readonly m = new Matrix4();
  private readonly r = new Matrix4();
  private readonly vx = new Vector3();
  private readonly vy = new Vector3();
  private readonly vz = new Vector3();
  private readonly up = new Vector3();
  private readonly pos = new Vector3();

  /** `initial` dimensiona as malhas; `seed` sorteia as cores (paleta.json) de forma reproduzível. */
  constructor(initial: SimState, seed = 7) {
    this.rng = makeRng(seed);
    const { texture } = getAtlas();
    this.material = createPs1Material({ map: texture, instanced: true });

    const counts = new Map<string, number>();
    for (const a of initial.agents) counts.set(agentModel(a), (counts.get(agentModel(a)) ?? 0) + 1);
    for (const [model, n] of counts) this.createMesh(model, n);

    this.liftCount = initial.lifts.length;
    const cabin = buildModel('rad_bubble_cabin');
    this.cabins = new InstancedMesh(cabin.opaque.clone(), createPs1Material({ map: texture }), Math.max(1, this.liftCount));
    this.cabins.count = this.liftCount;
    this.cabins.frustumCulled = false;

    this.update(initial);
  }

  /** Malhas de vidro das cápsulas (bolha translúcida). */
  cabinGlass(): InstancedMesh | null {
    if (this.cabinGlassMesh) return this.cabinGlassMesh;
    const g = buildModel('rad_bubble_cabin').glass;
    if (!g || !this.liftCount) return null;
    const m = new InstancedMesh(g, createPs1Material({ map: getAtlas().texture, opacity: 0.5 }), this.liftCount);
    m.frustumCulled = false;
    this.cabinGlassMesh = m;
    return m;
  }

  private createMesh(model: string, capacity: number): InstancedMesh {
    const geo = buildModel(model).opaque.clone();
    geo.setAttribute('iColor2', new InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    geo.setAttribute('iColor3', new InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    const mesh = new InstancedMesh(geo, this.material, capacity);
    mesh.frustumCulled = false;
    mesh.count = 0;
    const old = this.meshes.get(model);
    if (old) {
      // cresceu: copia matrizes e cores das instâncias existentes
      const n = old.count;
      mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, n * 16));
      if (old.instanceColor) {
        mesh.setColorAt(0, new Color()); // cria o atributo de cor por instância
        mesh.instanceColor?.array.set(old.instanceColor.array.subarray(0, n * 3));
      }
      for (const name of ['iColor2', 'iColor3']) {
        const src = old.geometry.getAttribute(name) as InstancedBufferAttribute;
        (geo.getAttribute(name) as InstancedBufferAttribute).array.set(src.array.subarray(0, n * 3));
      }
      mesh.count = n;
      this.group.remove(old);
      old.geometry.dispose();
    }
    this.meshes.set(model, mesh);
    this.group.add(mesh);
    return mesh;
  }

  /** Instância (e cores) de um agente; agentes novos ganham um visual sorteado da paleta. */
  private slotOf(a: SimAgent, state: SimState): { mesh: InstancedMesh; index: number } {
    const known = this.slots.get(a.id);
    if (known) {
      known.frame = this.frame;
      const mesh = this.meshes.get(known.model);
      if (mesh) return { mesh, index: known.index };
    }
    const model = agentModel(a);
    const index = this.used.get(model) ?? 0;
    this.used.set(model, index + 1);
    let mesh = this.meshes.get(model);
    if (!mesh) mesh = this.createMesh(model, 8);
    else if (index >= mesh.instanceMatrix.count) mesh = this.createMesh(model, mesh.instanceMatrix.count * 2);
    mesh.count = Math.max(mesh.count, index + 1);
    this.slots.set(a.id, { model, index, frame: this.frame });

    const look = pickLook(this.rng);
    const line = a.line === undefined ? undefined : state.lines[a.line];
    mesh.setColorAt(index, new Color(line?.color ?? look.vehicle.hex));
    const c2 = new Color(look.outfit.hex), c3 = new Color(look.skin);
    (mesh.geometry.getAttribute('iColor2') as InstancedBufferAttribute).setXYZ(index, c2.r, c2.g, c2.b);
    (mesh.geometry.getAttribute('iColor3') as InstancedBufferAttribute).setXYZ(index, c3.r, c3.g, c3.b);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    (mesh.geometry.getAttribute('iColor2') as InstancedBufferAttribute).needsUpdate = true;
    (mesh.geometry.getAttribute('iColor3') as InstancedBufferAttribute).needsUpdate = true;
    return { mesh, index };
  }

  /** Eixos da cidade (x, y, h) → eixos do Three (x, y = altura, z = city.y). */
  private static toThree(v: Vec3, out: Vector3): Vector3 {
    return out.set(v.x, v.h, v.y);
  }

  /**
   * Atualiza as instâncias a partir do estado. Agentes que somem do estado ficam ocultos.
   * Se um modelo precisar de mais instâncias, a malha é trocada dentro de `group`
   * (quem adicionou `meshes` à cena um a um deve readicionar).
   */
  update(state: SimState) {
    this.frame++;
    const seen = new Set<string>();
    for (const a of state.agents) {
      const { mesh, index } = this.slotOf(a, state);
      seen.add(agentModel(a));
      if (a.hidden) {
        mesh.setMatrixAt(index, ZERO);
        continue;
      }
      const z = SimView.toThree(a.forward, this.vz).normalize();
      const up = SimView.toThree(a.up, this.up);
      const x = this.vx.crossVectors(up, z).normalize();
      const y = this.vy.crossVectors(z, x);
      const m = this.m.makeBasis(x, y, z);
      if (a.trick?.kind === 'spin') m.multiply(this.r.makeRotationY(a.trick.angle));
      if (a.trick?.kind === 'flip') m.multiply(this.r.makeRotationX(-a.trick.angle));
      const p = this.pos.set(a.x, a.h, a.y);
      // balanço do passo do pedestre (só visual)
      if (a.kind === 'pedestrian' && a.lane === 'sidewalk' && a.line === undefined && !a.airborne) {
        p.y += Math.abs(Math.sin(state.time * 9 + index)) * 0.008;
      }
      m.setPosition(p);
      mesh.setMatrixAt(index, m);
    }
    for (const s of this.slots.values()) {
      if (s.frame === this.frame) continue;
      this.meshes.get(s.model)?.setMatrixAt(s.index, ZERO);
      seen.add(s.model);
    }
    for (const [model, mesh] of this.meshes) if (seen.has(model)) mesh.instanceMatrix.needsUpdate = true;

    const n = Math.min(state.lifts.length, this.cabins.instanceMatrix.count);
    state.lifts.forEach((c, i) => {
      if (i >= n) return;
      const m = this.m.compose(this.pos.set(c.x, c.h, c.y), NO_ROT, ONE);
      this.cabins.setMatrixAt(i, m);
      this.cabinGlassMesh?.setMatrixAt(i, m);
    });
    this.cabins.count = n;
    this.cabins.instanceMatrix.needsUpdate = true;
    if (this.cabinGlassMesh) this.cabinGlassMesh.instanceMatrix.needsUpdate = true;
  }
}
