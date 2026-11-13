import {
  Camera, ColorManagement, LinearSRGBColorSpace, NearestFilter, Scene, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { ps1Shared } from './ps1/Ps1Material';
import { PostFx } from './ps1/PostFx';

ColorManagement.enabled = false; // hex da paleta = cor na tela, sem conversões

export interface Ps1Settings {
  /** Altura interna em pixels (240 = PS1). A largura acompanha a proporção da janela. */
  internalHeight: number;
  jitter: number;
  affine: number;
  dither: number;
  quantize15bit: boolean;
  /** Desliga tudo para comparar com/sem efeitos. */
  ps1: boolean;
}

export const defaultSettings: Ps1Settings = {
  internalHeight: 240,
  jitter: 1,
  affine: 0.6,
  dither: 1,
  quantize15bit: true,
  ps1: true,
};

/** Renderização em baixa resolução + pós-processo (SPEC §7.1). */
export class Ps1Renderer {
  readonly gl: WebGLRenderer;
  readonly target: WebGLRenderTarget;
  readonly post: PostFx;
  settings: Ps1Settings = { ...defaultSettings };
  width = 320;
  height = 240;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    this.gl.outputColorSpace = LinearSRGBColorSpace;
    this.gl.setPixelRatio(1);
    this.target = new WebGLRenderTarget(320, 240, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
    });
    this.post = new PostFx(this.target.texture);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  apply(s: Partial<Ps1Settings>) {
    Object.assign(this.settings, s);
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.gl.setSize(w, h, false);
    const s = this.settings;
    const ih = s.ps1 ? Math.min(s.internalHeight, h) : h;
    this.height = Math.round(ih);
    this.width = Math.round(ih * (w / h));
    this.target.setSize(this.width, this.height);
    ps1Shared.uSnapRes.value.set(this.width, this.height);
    ps1Shared.uJitter.value = s.ps1 ? s.jitter : 0;
    ps1Shared.uAffine.value = s.ps1 ? s.affine : 0;
    const u = this.post.material.uniforms;
    const uniform = (name: string) => {
      const v = u[name];
      if (!v) throw new Error(`PostFx: uniform '${name}' não existe`);
      return v;
    };
    uniform('uLowRes').value.set(this.width, this.height);
    uniform('uDither').value = s.ps1 ? s.dither : 0;
    uniform('uQuant').value = s.ps1 && s.quantize15bit ? 1 : 0;
  }

  get aspect() {
    return innerWidth / innerHeight;
  }

  /** Começa um quadro: limpa a imagem de baixa resolução. */
  begin(clearColor = 0x9fd4ff) {
    const t = this.target;
    t.scissorTest = false;
    t.viewport.set(0, 0, this.width, this.height);
    this.gl.setRenderTarget(t);
    this.gl.setClearColor(clearColor, 1);
    this.gl.clear();
  }

  /**
   * Desenha uma cena. `rect` em pixels de tela (CSS) permite várias vistas (laboratório).
   */
  draw(scene: Scene, camera: Camera, rect?: { x: number; y: number; w: number; h: number }) {
    const g = this.gl;
    const t = this.target;
    g.autoClear = false;
    if (rect) {
      const k = this.height / innerHeight;
      const x = Math.floor(rect.x * k), w = Math.ceil(rect.w * k), h = Math.ceil(rect.h * k);
      const y = Math.floor((innerHeight - rect.y - rect.h) * k);
      t.viewport.set(x, y, w, h);
      t.scissor.set(x, y, w, h);
      t.scissorTest = true;
      g.setRenderTarget(t);
      g.clearDepth();
    } else {
      t.viewport.set(0, 0, this.width, this.height);
      t.scissorTest = false;
      g.setRenderTarget(t);
    }
    g.render(scene, camera);
  }

  /** Termina: amplia com nearest + dither + 15 bits para a tela. */
  end() {
    const g = this.gl;
    g.setScissorTest(false);
    g.setRenderTarget(null);
    g.setViewport(0, 0, innerWidth, innerHeight);
    g.render(this.post.scene, this.post.camera);
  }
}
