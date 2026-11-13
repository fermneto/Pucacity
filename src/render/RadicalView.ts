import * as THREE from 'three';
import type { AccessKind, CityCrossing, CityFile, RadicalKind } from '../core/types';
import { hex, LANE_COLOR, WORLD } from './palette';
import { createPs1Material } from './ps1/Ps1Material';
import { bakeFaceShading } from './shading';

/** Distância lateral (tiles) entre o elemento radical e a rota acessível da mesma travessia. */
const ACCESS_OFFSET = 1.4;
const NO_ACCESS_COLOR = 0xe8322c; // Vermelho Lata de Spray: alerta de travessia sem rota acessível

/**
 * Cunha unitária: base em y=0, x ∈ [-0.5, 0.5], z ∈ [0, 1], sobe de altura 0 (z=0) a 1 (z=1).
 * Escalada/rotacionada para virar kicker e aterrissagem.
 */
function wedgeGeometry(): THREE.BufferGeometry {
  const A = [-0.5, 0, 0], B = [0.5, 0, 0], C = [0.5, 0, 1], D = [-0.5, 0, 1], E = [-0.5, 1, 1], F = [0.5, 1, 1];
  const tris = [
    A, B, F, A, F, E, // rampa
    D, E, F, D, F, C, // fundo vertical
    A, E, D, // lado esquerdo
    B, C, F, // lado direito
    A, D, C, A, C, B, // base
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return bakeFaceShading(g);
}

/**
 * Placeholders procedurais dos elementos radicais e das rotas acessíveis (até os .glb rad_*.glb da Arte).
 * Cada travessia vira um grupo local onde +z corre de `from` para `to` e x é lateral.
 */
export class RadicalView {
  readonly group = new THREE.Group();
  private readonly materials = new Map<number, THREE.ShaderMaterial>();
  private readonly wedge = wedgeGeometry();
  private readonly box = bakeFaceShading(new THREE.BoxGeometry(1, 1, 1));

  constructor(city: CityFile) {
    const pos = new Map(city.nodes.map((n) => [n.id, n] as const));
    for (const c of city.crossings) {
      const a = pos.get(c.from)!;
      const b = pos.get(c.to)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const holder = new THREE.Group();
      holder.position.set((a.x + b.x) / 2, 0, (a.y + b.y) / 2);
      holder.rotation.y = Math.atan2(dx, dy); // local +z → direção from→to
      holder.userData = { crossingId: c.id };
      this.buildRadical(holder, c.radical, len);
      this.buildAccess(holder, c, len);
      this.group.add(holder);
    }
  }

  private mat(color: number): THREE.ShaderMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = createPs1Material({ color, vertexColors: true, side: THREE.DoubleSide });
      this.materials.set(color, m);
    }
    return m;
  }

  /** Caixa centrada em (x, y, z) local com tamanho (sx, sy, sz). */
  private addBox(parent: THREE.Object3D, color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const mesh = new THREE.Mesh(this.box, this.mat(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }

  /** Kicker (subindo em +z) ou aterrissagem (flip), com a faixa de borda pintada. */
  private addRamp(parent: THREE.Object3D, atZ: number, flip: boolean, width: number, height: number, length: number, lip: number) {
    const ramp = new THREE.Mesh(this.wedge, this.mat(hex(WORLD.concreto)));
    ramp.scale.set(width, height, length);
    ramp.position.z = atZ;
    if (flip) ramp.rotation.y = Math.PI;
    parent.add(ramp);
    const lipZ = atZ + (flip ? -length : length) - (flip ? -0.04 : 0.04);
    this.addBox(parent, lip, 0, height + 0.02, lipZ, width, 0.05, 0.12);
  }

  private buildRadical(holder: THREE.Group, kind: RadicalKind, len: number): void {
    const half = len / 2;
    const launch = hex(WORLD.faixa_lancamento);
    const landing = hex(WORLD.faixa_aterrissagem);
    switch (kind) {
      case 'ramp_bridge':
        this.addRamp(holder, -half, false, 1.1, 0.9, 0.8, launch);
        this.addRamp(holder, half, true, 1.1, 0.7, 0.9, landing);
        break;
      case 'death_jump':
        this.addRamp(holder, -half, false, 1.1, 1.8, 1.0, launch);
        this.addRamp(holder, half, true, 1.1, 1.2, 1.2, landing);
        this.addBox(holder, 0xff5fa8, 0.6, 2.4, -half + 0.9, 0.05, 1.2, 0.05); // mastro da bandeirola
        this.addBox(holder, 0xff5fa8, 0.6, 2.85, -half + 1.1, 0.04, 0.3, 0.4);
        break;
      case 'air_loop': {
        const r = Math.max(0.6, half * 0.85);
        const torus = new THREE.TorusGeometry(r, 0.13, 4, 16);
        torus.rotateY(Math.PI / 2); // loop no plano vertical que contém a travessia
        const loop = new THREE.Mesh(bakeFaceShading(torus), this.mat(hex(WORLD.vidro)));
        loop.position.y = r + 0.1;
        holder.add(loop);
        this.addBox(holder, hex(WORLD.cromo), 0, 0.05, 0, 0.5, 0.1, len); // pista de entrada/saída
        break;
      }
      case 'rail_walkway':
        this.addBox(holder, hex(WORLD.cromo), 0, 0.75, 0, 0.1, 0.1, len + 0.4);
        this.addBox(holder, hex(WORLD.cromo), 0, 0.37, -half, 0.08, 0.75, 0.08);
        this.addBox(holder, hex(WORLD.cromo), 0, 0.37, half, 0.08, 0.75, 0.08);
        break;
    }
  }

  private buildAccess(holder: THREE.Group, c: CityCrossing, len: number): void {
    const x = ACCESS_OFFSET;
    const half = len / 2;
    const kind: AccessKind | undefined = c.access;
    if (!kind) {
      // Sem rota acessível: pilar de alerta vermelho (o overlay de acessibilidade usará a mesma cor).
      this.addBox(holder, NO_ACCESS_COLOR, x, 0.9, 0, 0.35, 1.8, 0.35);
      this.addBox(holder, NO_ACCESS_COLOR, x, 2.1, 0, 0.35, 0.35, 0.35);
      return;
    }
    switch (kind) {
      case 'bubble_lift': {
        const glass = hex(WORLD.vidro);
        const chrome = hex(WORLD.cromo);
        this.addBox(holder, chrome, x, 1.1, -half, 0.12, 2.2, 0.12);
        this.addBox(holder, chrome, x, 1.1, half, 0.12, 2.2, 0.12);
        this.addBox(holder, chrome, x, 2.2, 0, 0.05, 0.05, len);
        const bubble = new THREE.Mesh(bakeFaceShading(new THREE.IcosahedronGeometry(0.38, 1)), this.mat(glass));
        bubble.position.set(x, 1.75, 0);
        holder.add(bubble);
        break;
      }
      case 'glass_walkway':
        this.addBox(holder, hex(WORLD.vidro), x, 0.35, 0, 0.7, 0.08, len);
        this.addBox(holder, hex(WORLD.cromo), x - 0.33, 0.6, 0, 0.04, 0.04, len);
        this.addBox(holder, hex(WORLD.cromo), x + 0.33, 0.6, 0, 0.04, 0.04, len);
        break;
      case 'transit_only':
        this.addBox(holder, LANE_COLOR.transit, x, 0.06, 0, 0.6, 0.06, len);
        break;
    }
  }
}
