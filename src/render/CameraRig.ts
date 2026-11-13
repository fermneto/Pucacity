import * as THREE from 'three';

const FOV = 40;
const PITCH = THREE.MathUtils.degToRad(55);

/**
 * Câmera de jogo de gestão: orbita um alvo no chão.
 * WASD/setas = mover, arrastar (botão esquerdo) = mover, roda = zoom, Q/E = girar 90°.
 * Mantém uma câmera perspectiva e uma ortográfica sincronizadas (P alterna).
 */
export class CameraRig {
  readonly persp = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 400);
  useOrtho = false;

  readonly target: THREE.Vector3;
  distance = 50;
  readonly minDistance = 12;
  readonly maxDistance = 120;
  private yaw = Math.PI / 4;
  private yawGoal = Math.PI / 4;
  private aspect = 1;
  private readonly keys = new Set<string>();
  /** true enquanto a câmera está se movendo (para render sob demanda no futuro). */
  moving = true;

  constructor(private readonly dom: HTMLElement, private readonly bounds: { w: number; h: number }) {
    this.target = new THREE.Vector3(bounds.w / 2, 0, bounds.h / 2);
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(e.deltaY * 0.001), this.minDistance, this.maxDistance);
    }, { passive: false });
  }

  get camera(): THREE.Camera {
    return this.useOrtho ? this.ortho : this.persp;
  }

  /** Gira em passos de 90° (dir = +1 ou -1). */
  rotate(dir: 1 | -1): void {
    this.yawGoal += (dir * Math.PI) / 2;
  }

  /** Move o alvo pelo arraste do mouse (em pixels de tela). */
  dragPan(dxPx: number, dyPx: number): void {
    const k = (this.distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 2) / this.dom.clientHeight;
    const { f, r } = this.groundAxes();
    this.target.addScaledVector(r, -dxPx * k);
    this.target.addScaledVector(f, dyPx * k / Math.sin(PITCH));
    this.clampTarget();
  }

  resize(aspect: number): void {
    this.aspect = aspect;
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();
  }

  update(dt: number): void {
    const before = this.target.clone();
    const prevYaw = this.yaw;

    const { f, r } = this.groundAxes();
    const speed = this.distance * 0.9 * dt;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) this.target.addScaledVector(f, speed);
    if (k.has('s') || k.has('arrowdown')) this.target.addScaledVector(f, -speed);
    if (k.has('d') || k.has('arrowright')) this.target.addScaledVector(r, speed);
    if (k.has('a') || k.has('arrowleft')) this.target.addScaledVector(r, -speed);
    this.clampTarget();

    this.yaw += (this.yawGoal - this.yaw) * (1 - Math.exp(-dt * 10));
    if (Math.abs(this.yawGoal - this.yaw) < 1e-4) this.yaw = this.yawGoal;

    const d = this.distance;
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(PITCH) * d,
      Math.sin(PITCH) * d,
      Math.cos(this.yaw) * Math.cos(PITCH) * d,
    );
    for (const cam of [this.persp, this.ortho]) {
      cam.position.copy(this.target).add(offset);
      cam.lookAt(this.target);
    }
    const hh = d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.ortho.left = -hh * this.aspect;
    this.ortho.right = hh * this.aspect;
    this.ortho.top = hh;
    this.ortho.bottom = -hh;
    this.ortho.updateProjectionMatrix();

    this.moving = !before.equals(this.target) || prevYaw !== this.yaw;
  }

  /** Eixos no chão: f = "para frente" (longe da câmera), r = direita da tela. */
  private groundAxes(): { f: THREE.Vector3; r: THREE.Vector3 } {
    return {
      f: new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)),
      r: new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)),
    };
  }

  private clampTarget(): void {
    this.target.x = THREE.MathUtils.clamp(this.target.x, 0, this.bounds.w);
    this.target.z = THREE.MathUtils.clamp(this.target.z, 0, this.bounds.h);
  }
}
