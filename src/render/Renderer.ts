import * as THREE from 'three';
import { PostFx } from './ps1/PostFx';
import { ps1Globals } from './ps1/Ps1Material';

export const LOW_RES_HEIGHTS = [240, 360, 480] as const;

/**
 * Renderiza a cena num render target pequeno (altura 240/360/480, largura pela proporção da janela)
 * e amplia para a tela com NearestFilter + pós-processo PS1.
 */
export class Ps1Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly lowRes = new THREE.Vector2(320, 240);
  private target: THREE.WebGLRenderTarget;
  private readonly post: PostFx;
  private heightIndex = 0;
  /** Draw calls da cena no último frame (sem contar o pós-processo). */
  sceneDrawCalls = 0;

  constructor(parent: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.setPixelRatio(1);
    parent.prepend(this.gl.domElement);

    this.target = this.makeTarget(320, 240);
    this.post = new PostFx(this.target.texture);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get aspect(): number {
    return this.lowRes.x / this.lowRes.y;
  }

  get dither(): boolean {
    return this.post.dither;
  }

  set dither(on: boolean) {
    this.post.dither = on;
  }

  /** Alterna 240 → 360 → 480 linhas. Retorna a nova altura. */
  cycleResolution(): number {
    this.heightIndex = (this.heightIndex + 1) % LOW_RES_HEIGHTS.length;
    this.resize();
    return this.lowRes.y;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h);
    const lowH = LOW_RES_HEIGHTS[this.heightIndex]!;
    const lowW = Math.max(1, Math.round((lowH * w) / h));
    this.lowRes.set(lowW, lowH);
    this.target.setSize(lowW, lowH);
    ps1Globals.uResolution.value.copy(this.lowRes);
    this.post.lowRes = this.lowRes;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.setRenderTarget(this.target);
    this.gl.render(scene, camera);
    this.sceneDrawCalls = this.gl.info.render.calls;
    this.gl.setRenderTarget(null);
    this.gl.render(this.post.scene, this.post.camera);
  }

  private makeTarget(w: number, h: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
    });
  }
}
