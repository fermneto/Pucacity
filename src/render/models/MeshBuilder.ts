import { BufferGeometry, Color, Float32BufferAttribute, Matrix3, Matrix4, Vector3 } from 'three';
import { tileOffset, type TileName } from '../textures/Atlas';

/**
 * Construtor de malhas low-poly no espírito PS1:
 * - faces planas (sem vértices compartilhados) com luz *baked* na cor de vértice;
 * - UV local repetível + canto do tile do atlas (aTile);
 * - marcações por face: aTint (cor sorteada por instância) e aGloss (reflexo Aero).
 * Trabalha em metros; `build(scale)` converte para unidades do mundo.
 */
export interface Paint {
  color?: string | Color;
  tile?: TileName;
  /** 0 fixo · 1 veículo · 2 roupa · 3 pele */
  tint?: 0 | 1 | 2 | 3;
  gloss?: number;
  /** Repetições de textura por metro (padrão 0.25 = 1 repetição a cada 4 m). */
  uvScale?: number;
  /** Escalas separadas: U ao longo de a→b, V ao longo de a→d (ex.: faixas de via). */
  uvU?: number;
  uvV?: number;
}

export type Face = 'top' | 'bottom' | 'px' | 'nx' | 'pz' | 'nz';
export type BoxPaint = Paint & { faces?: Partial<Record<Face, Paint>>; omit?: Face[] };

const v3 = (a: number[]) => new Vector3(a[0], a[1], a[2]);
const LIGHT = new Vector3(0.45, 1, 0.3).normalize();
const WHITE = new Color('#ffffff');

export class MeshBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private tile: number[] = [];
  private tint: number[] = [];
  private gloss: number[] = [];
  private stack: Matrix4[] = [new Matrix4()];

  get matrix(): Matrix4 {
    return this.stack[this.stack.length - 1];
  }

  /** Empilha uma transformação (translação/rotação/escala) para as próximas peças. */
  push(m: Matrix4): this {
    this.stack.push(this.matrix.clone().multiply(m));
    return this;
  }
  pop(): this {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }
  at(x: number, y: number, z: number, rotY = 0, fn?: (b: this) => void): this {
    this.push(new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(rotY)));
    if (fn) { fn(this); this.pop(); }
    return this;
  }

  get triCount(): number {
    return this.pos.length / 9;
  }

  /** Triângulo em espaço local; `outward` (opcional) corrige a ordem dos vértices. */
  tri(a: Vector3, b: Vector3, c: Vector3, uva: number[], uvb: number[], uvc: number[], p: Paint, outward?: Vector3) {
    const m = this.matrix;
    const A = a.clone().applyMatrix4(m), B = b.clone().applyMatrix4(m), C = c.clone().applyMatrix4(m);
    const n = new Vector3().subVectors(B, A).cross(new Vector3().subVectors(C, A)).normalize();
    let verts = [A, B, C], uvs = [uva, uvb, uvc];
    if (outward) {
      const ow = outward.clone().applyMatrix3(new Matrix3().getNormalMatrix(m));
      if (n.dot(ow) < 0) { verts = [A, C, B]; uvs = [uva, uvc, uvb]; n.negate(); }
    }
    const base = p.tint ? WHITE : new Color(p.color ?? '#ffffff');
    // Luz baked: ambiente + difusa + leve escurecimento embaixo.
    const shade = 0.58 + 0.42 * Math.max(0, n.dot(LIGHT)) - (n.y < -0.5 ? 0.12 : 0);
    const [tu, tv] = tileOffset(p.tile ?? 'white');
    for (let i = 0; i < 3; i++) {
      this.pos.push(verts[i].x, verts[i].y, verts[i].z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(base.r * shade, base.g * shade, base.b * shade);
      this.tile.push(tu, tv);
      this.tint.push(p.tint ?? 0);
      this.gloss.push(p.gloss ?? 0);
    }
  }

  /** Quadrilátero a→b→c→d (perímetro). UV proporcional às arestas × uvScale. */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, p: Paint, outward?: Vector3) {
    const s = p.uvScale ?? 0.25;
    const lu = a.distanceTo(b) * (p.uvU ?? s), lv = a.distanceTo(d) * (p.uvV ?? s);
    const ua = [0, 0], ub = [lu, 0], uc = [lu, lv], ud = [0, lv];
    const ow = outward ?? new Vector3().subVectors(b, a).cross(new Vector3().subVectors(d, a));
    this.tri(a, b, c, ua, ub, uc, p, ow);
    this.tri(a, c, d, ua, uc, ud, p, ow);
  }

  /** Atalhos com arrays [x,y,z] (curvas geradas por fórmula). */
  quadXYZ(a: number[], b: number[], c: number[], d: number[], p: Paint, outward?: number[]) {
    this.quad(v3(a), v3(b), v3(c), v3(d), p, outward ? v3(outward) : undefined);
  }
  triXYZ(a: number[], b: number[], c: number[], p: Paint, outward?: number[]) {
    const s = p.uvScale ?? 0.25;
    this.tri(v3(a), v3(b), v3(c), [a[2] * s, a[1] * s], [b[2] * s, b[1] * s], [c[2] * s, c[1] * s], p, outward ? v3(outward) : undefined);
  }

  /** Caixa centrada em x/z, base em y=0. Faces podem ser omitidas para economizar triângulos. */
  box(w: number, h: number, d: number, p: BoxPaint): this {
    const x = w / 2, z = d / 2;
    const v = (X: number, Y: number, Z: number) => new Vector3(X, Y, Z);
    const faces: [Face, Vector3[], Vector3][] = [
      ['top', [v(-x, h, z), v(x, h, z), v(x, h, -z), v(-x, h, -z)], v(0, 1, 0)],
      ['bottom', [v(-x, 0, -z), v(x, 0, -z), v(x, 0, z), v(-x, 0, z)], v(0, -1, 0)],
      ['pz', [v(-x, 0, z), v(x, 0, z), v(x, h, z), v(-x, h, z)], v(0, 0, 1)],
      ['nz', [v(x, 0, -z), v(-x, 0, -z), v(-x, h, -z), v(x, h, -z)], v(0, 0, -1)],
      ['px', [v(x, 0, z), v(x, 0, -z), v(x, h, -z), v(x, h, z)], v(1, 0, 0)],
      ['nx', [v(-x, 0, -z), v(-x, 0, z), v(-x, h, z), v(-x, h, -z)], v(-1, 0, 0)],
    ];
    for (const [name, [a, b, c, dd], out] of faces) {
      if (p.omit?.includes(name)) continue;
      this.quad(a, b, c, dd, { ...p, ...(p.faces?.[name] ?? {}) }, out);
    }
    return this;
  }

  /** Prisma/tronco de N lados (cilindro low-poly). Base em y=0. */
  prism(radius: number, h: number, sides: number, p: Paint & { radiusTop?: number; top?: boolean; bottom?: boolean; topPaint?: Paint }): this {
    const rt = p.radiusTop ?? radius;
    const ring = (r: number, y: number) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i / sides) * Math.PI * 2;
        return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      });
    const lo = ring(radius, 0), hi = ring(rt, h);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const mid = lo[i].clone().add(lo[j]).setY(0);
      if (rt === 0) this.tri(lo[i], lo[j], hi[i], [0, 0], [1, 0], [0.5, 1], p, mid);
      else this.quad(lo[i], lo[j], hi[j], hi[i], p, mid);
    }
    const cap = (pts: Vector3[], out: Vector3, pp: Paint) => {
      for (let i = 1; i < sides - 1; i++) {
        this.tri(pts[0], pts[i], pts[i + 1], [pts[0].x * 0.25, pts[0].z * 0.25], [pts[i].x * 0.25, pts[i].z * 0.25], [pts[i + 1].x * 0.25, pts[i + 1].z * 0.25], pp, out);
      }
    };
    if (p.top !== false && rt > 0) cap(hi, new Vector3(0, 1, 0), p.topPaint ?? p);
    if (p.bottom) cap(lo, new Vector3(0, -1, 0), p);
    return this;
  }

  /** Disco plano de N lados no plano YZ (rodas vistas de lado), dupla face. */
  disc(radius: number, sides: number, p: Paint): this {
    const pts = Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2;
      return new Vector3(0, Math.sin(a) * radius + radius, Math.cos(a) * radius);
    });
    for (const out of [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]) {
      for (let i = 1; i < sides - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], [0, 0], [1, 0], [1, 1], p, out);
    }
    return this;
  }

  /** Rampa (cunha) subindo ao longo de +z: comprimento d, altura h. */
  wedge(w: number, h: number, d: number, p: BoxPaint): this {
    const x = w / 2, z = d / 2;
    const v = (X: number, Y: number, Z: number) => new Vector3(X, Y, Z);
    const slope = { ...p, ...(p.faces?.top ?? {}) };
    this.quad(v(-x, 0, -z), v(x, 0, -z), v(x, h, z), v(-x, h, z), slope, v(0, d, -h));
    if (!p.omit?.includes('pz')) this.quad(v(-x, 0, z), v(x, 0, z), v(x, h, z), v(-x, h, z), { ...p, ...(p.faces?.pz ?? {}) }, v(0, 0, 1));
    const side = { ...p, ...(p.faces?.px ?? {}) };
    this.tri(v(x, 0, -z), v(x, 0, z), v(x, h, z), [0, 0], [d * 0.25, 0], [d * 0.25, h * 0.25], side, v(1, 0, 0));
    this.tri(v(-x, 0, -z), v(-x, 0, z), v(-x, h, z), [0, 0], [d * 0.25, 0], [d * 0.25, h * 0.25], side, v(-1, 0, 0));
    return this;
  }

  /** Esfera low-poly (lat×lon), útil para copas, bolhas e nuvens. */
  sphere(radius: number, lon: number, lat: number, p: Paint): this {
    const pt = (i: number, j: number) => {
      const th = (j / lat) * Math.PI, ph = (i / lon) * Math.PI * 2;
      return new Vector3(Math.sin(th) * Math.cos(ph) * radius, Math.cos(th) * radius + radius, Math.sin(th) * Math.sin(ph) * radius);
    };
    const center = new Vector3(0, radius, 0);
    for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      const out = a.clone().add(c).multiplyScalar(0.5).sub(center);
      if (j === 0) this.tri(a, c, d, [0, 0], [1, 1], [0, 1], p, out);
      else if (j === lat - 1) this.tri(a, b, c, [0, 0], [1, 0], [1, 1], p, out);
      else this.quad(a, b, c, d, p, out);
    }
    return this;
  }

  /** Copia uma geometria já construída (mesmo layout de atributos) com a matriz atual. */
  addGeometry(g: BufferGeometry, m = new Matrix4()) {
    const full = this.matrix.clone().multiply(m);
    const nm = new Matrix3().getNormalMatrix(full);
    const P = g.getAttribute('position'), N = g.getAttribute('normal');
    const t = new Vector3();
    for (let i = 0; i < P.count; i++) {
      t.fromBufferAttribute(P, i).applyMatrix4(full);
      this.pos.push(t.x, t.y, t.z);
      t.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      this.nor.push(t.x, t.y, t.z);
    }
    const copy = (name: string, arr: number[]) => {
      const a = g.getAttribute(name);
      for (let i = 0; i < a.count * a.itemSize; i++) arr.push(a.array[i] as number);
    };
    copy('uv', this.uv); copy('color', this.col); copy('aTile', this.tile); copy('aTint', this.tint); copy('aGloss', this.gloss);
  }

  build(scale = 1): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos.map((v) => v * scale), 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aTile', new Float32BufferAttribute(this.tile, 2));
    g.setAttribute('aTint', new Float32BufferAttribute(this.tint, 1));
    g.setAttribute('aGloss', new Float32BufferAttribute(this.gloss, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

export function triCount(g: BufferGeometry | undefined): number {
  return g ? g.getAttribute('position').count / 3 : 0;
}
