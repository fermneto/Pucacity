import {
  BufferAttribute, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas, tileOffset } from './textures/Atlas';
import { buildModel } from './models/catalog';
import { MeshBuilder } from './models/MeshBuilder';
import { WORLD } from './palette';
import { makeRng } from './util';

/**
 * Camada Frutiger Aero do mundo: céu em gradiente (com bandas do 15-bit), nuvens fofas,
 * sol e bolhas subindo no canal.
 */
export class Atmosphere {
  readonly group = new Group();
  readonly sky: Mesh;
  private bubbles: InstancedMesh | null = null;
  private bubbleState: { x: number; z: number; y: number; v: number }[] = [];
  private clouds: Group;
  private time = 0;

  constructor(center: Vector3, canal?: { y0: number; y1: number; x0: number; x1: number }) {
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

    // Bolhas no canal
    if (canal) {
      const b = new MeshBuilder();
      b.sphere(0.05, 4, 3, { color: '#E8FFFF', gloss: 1 });
      const M = 70;
      this.bubbles = new InstancedMesh(b.build(), createPs1Material({ map: texture, opacity: 0.7 }), M);
      this.bubbles.frustumCulled = false;
      for (let i = 0; i < M; i++) {
        this.bubbleState.push({
          x: canal.x0 + rng() * (canal.x1 - canal.x0),
          z: canal.y0 + 0.15 + rng() * (canal.y1 - canal.y0 - 0.3),
          y: -0.18 + rng() * 0.4,
          v: 0.05 + rng() * 0.08,
        });
      }
      this.group.add(this.bubbles);
    }
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
  }
}
