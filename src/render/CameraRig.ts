import { PerspectiveCamera, Vector3 } from 'three';

/**
 * Câmera de gestão (SPEC §7.8): perspectiva com FOV baixo, inclinada,
 * pan arrastando/WASD, zoom na roda e rotação em passos de 90° (Q/E).
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 400);
  target = new Vector3();
  yaw = 0;
  private yawGoal = 0;
  distance = 20;
  pitch = 0.95;

  constructor(el: HTMLElement) {
    let drag: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => { if (e.button === 0) drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('pointerup', () => (drag = null));
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      const k = (this.distance / innerHeight) * 1.1;
      this.pan(-(e.clientX - drag.x) * k, -(e.clientY - drag.y) * k);
      drag = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('wheel', (e) => {
      this.distance = Math.min(45, Math.max(4, this.distance * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: true });
  }

  set(target: Vector3, distance: number, yaw = 0, pitch = 0.95) {
    this.target.copy(target);
    this.distance = distance;
    this.yaw = this.yawGoal = yaw;
    this.pitch = pitch;
  }

  rotate(steps: number) {
    this.yawGoal += (steps * Math.PI) / 2;
  }

  pan(dx: number, dz: number) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.target.x += dx * c + dz * s;
    this.target.z += -dx * s + dz * c;
  }

  update(dt: number, aspect: number) {
    this.yaw += (this.yawGoal - this.yaw) * Math.min(1, dt * 8);
    const d = this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      this.target.y + Math.sin(this.pitch) * d,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
    this.camera.lookAt(this.target);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
