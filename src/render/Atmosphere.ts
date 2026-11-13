import {
  BufferAttribute, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas, tileOffset } from './textures/Atlas';
import { buildModel } from './models/catalog';
import { MeshBuilder } from './models/MeshBuilder';
import { WORLD } from './palette';
import { makeRng } from './util';

/** Bolha gigante flutuante (feature `orb` do city.json), em tiles; `rot` (0–3) varia tamanho e fase. */
export interface OrbSpot { x: number; z: number; rot: number }

interface OrbState { x: number; z: number; y: number; r: number; phase: number; bob: number; speed: number }

/**
 * Camada Frutiger Aero do mundo: céu em gradiente (com bandas do 15-bit), nuvens fofas,
 * sol, bolhas subindo no canal e bolhas gigantes de vidro flutuando sobre a cidade.
 */
export class Atmosphere {
  readonly group = new Group();
  readonly sky: Mesh;
  private bubbles: InstancedMesh | null = null;
  private bubbleState: { x: number; z: number; y: number; v: number }[] = [];
  private clouds: Group;
  private orbLayers: { mesh: InstancedMesh; scale: number; offset: Vector3 }[] = [];
  private orbState: OrbState[] = [];
  private time = 0;

  constructor(center: Vector3, canals: { y0: number; y1: number; x0: number; x1: number }[] = [], orbs: OrbSpot[] = []) {
    const { texture } = getAtlas();
    // Céu: esfera com cor por vértice (azul royal no topo → azul bebê no horizonte)
    const geo = new SphereGeometry(160, 18, 12);
    const pos = geo.getAttribute('position');
    const n = pos.count;
    const col = new Float32Array(n * 3);
    const top = new Color(WORLD.ceu_topo), hor = new Color(WORLD.ceu_horizonte), ground = new Color('#BFE6FF');
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i) / 160;
      const c = y >= 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(ground, -y);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const [tu, tv] = tileOffset('white');
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('aTile', new Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [tu, tv]), 2));
    geo.setAttribute('aTint', new Float32BufferAttribute(new Array(n).fill(0), 1));
    geo.setAttribute('aGloss', new Float32BufferAttribute(new Array(n).fill(0), 1));
    this.sky = new Mesh(geo, createPs1Material({ map: texture, noFog: true, doubleSide: true }));
    this.sky.position.copy(center);
    this.group.add(this.sky);

    // Sol + halo (sprite "lustroso" de 2 esferas)
    const sun = new MeshBuilder();
    sun.sphere(5, 8, 5, { color: '#FFF6C8' });
    const sunMesh = new Mesh(sun.build(), createPs1Material({ map: texture, noFog: true }));
    sunMesh.position.copy(center).add(new Vector3(-70, 55, -95));
    this.group.add(sunMesh);

    // Nuvens
    const rng = makeRng(42);
    const cloudGeo = buildModel('prop_cloud').opaque;
    this.clouds = new Group();
    const cloudMat = createPs1Material({ map: texture, noFog: true });
    const N = 16;
    const inst = new InstancedMesh(cloudGeo, cloudMat, N);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rng() * 0.3;
      const r = 55 + rng() * 25;
      const s = 9 + rng() * 7;
      inst.setMatrixAt(i, new Matrix4().compose(
        new Vector3(Math.cos(a) * r, 12 + rng() * 14, Math.sin(a) * r),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a + Math.PI / 2),
        new Vector3(s, s * 0.8, s),
      ));
    }
    inst.frustumCulled = false;
    this.clouds.add(inst);
    this.clouds.position.copy(center);
    this.group.add(this.clouds);

    // Bolhas nos canais
    if (canals.length) {
      const b = new MeshBuilder();
      b.sphere(0.05, 4, 3, { color: '#E8FFFF', gloss: 1 });
      const M = 70 * canals.length;
      this.bubbles = new InstancedMesh(b.build(), createPs1Material({ map: texture, opacity: 0.7 }), M);
      this.bubbles.frustumCulled = false;
      for (let i = 0; i < M; i++) {
        const canal = canals[i % canals.length]!;
        this.bubbleState.push({
          x: canal.x0 + rng() * (canal.x1 - canal.x0),
          z: canal.y0 + 0.15 + rng() * (canal.y1 - canal.y0 - 0.3),
          y: -0.18 + rng() * 0.4,
          v: 0.05 + rng() * 0.08,
        });
      }
      this.group.add(this.bubbles);
    }

    if (orbs.length) this.buildOrbs(orbs, rng);
  }

  /**
   * Bolhas gigantes: casca de vidro translúcida, um véu interno iridescente (rosa/lilás) e o
   * brilho especular branco voltado para o sol. Cada camada é um InstancedMesh (3 draw calls).
   */
  private buildOrbs(orbs: OrbSpot[], rng: () => number) {
    const { texture } = getAtlas();
    // esfera unitária com a base em y = 0 (convenção do MeshBuilder): centro em y = 1
    const layer = (paint: { color: string; gloss: number }, lon: number, lat: number, opacity: number, scale: number, offset: Vector3) => {
      const b = new MeshBuilder();
      b.sphere(1, lon, lat, paint);
      const mesh = new InstancedMesh(b.build(), createPs1Material({ map: texture, opacity }), orbs.length);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.orbLayers.push({ mesh, scale, offset });
    };
    layer({ color: '#BFF4FF', gloss: 1 }, 12, 7, 0.32, 1, new Vector3());
    layer({ color: '#F6C8FF', gloss: 0.8 }, 10, 6, 0.18, 0.86, new Vector3(0.06, 0.04, 0));
    layer({ color: '#FFFFFF', gloss: 1 }, 6, 4, 0.85, 0.2, new Vector3(-0.38, 0.42, 0.5));
    for (const o of orbs) {
      const k = ((o.rot % 4) + 4) % 4;
      this.orbState.push({
        x: o.x, z: o.z,
        r: 0.75 + k * 0.18 + rng() * 0.15,
        y: 6.2 + rng() * 2 + k * 0.3, // 60–90 m: acima das torres mais altas
        phase: rng() * Math.PI * 2,
        bob: 0.35 + rng() * 0.3,
        speed: 0.22 + rng() * 0.12,
      });
    }
    this.placeOrbs();
  }

  private placeOrbs() {
    const m = new Matrix4();
    this.orbState.forEach((o, i) => {
      const t = this.time * o.speed + o.phase;
      const cx = o.x + Math.sin(t * 0.6) * 0.25, cz = o.z + Math.cos(t * 0.45) * 0.2;
      const cy = o.y + Math.sin(t) * o.bob;
      for (const L of this.orbLayers) {
        const s = o.r * L.scale;
        m.makeScale(s, s, s).setPosition(cx + L.offset.x * o.r, cy - s + L.offset.y * o.r, cz + L.offset.z * o.r);
        L.mesh.setMatrixAt(i, m);
      }
    });
    for (const L of this.orbLayers) L.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    this.time += dt;
    this.clouds.rotation.y = this.time * 0.004;
    if (this.bubbles) {
      const m = new Matrix4();
      this.bubbleState.forEach((b, i) => {
        b.y += b.v * dt;
        if (b.y > 0.22) b.y = -0.18;
        const s = b.y < -0.05 ? 0.5 : 1;
        m.makeScale(s, s, s).setPosition(b.x + Math.sin(this.time * 2 + i) * 0.03, b.y, b.z);
        this.bubbles!.setMatrixAt(i, m);
      });
      this.bubbles.instanceMatrix.needsUpdate = true;
    }
    if (this.orbState.length) this.placeOrbs();
  }
}
