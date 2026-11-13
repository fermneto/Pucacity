import * as THREE from 'three';

/**
 * Acumula quads planos (no plano XZ, altura y) em uma única BufferGeometry com cor de vértice.
 * Mapeamento: city.x → x, city.y → z.
 */
export class QuadBuilder {
  private pos: number[] = [];
  private uv: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  get quadCount(): number {
    return this.pos.length / 12;
  }

  /**
   * Quad ao longo do segmento A→B com a largura dada.
   * uv: u atravessa (0..1), v corre ao longo (comprimento / vScale).
   * Retorna o índice do quad (para recolorir depois).
   */
  segment(ax: number, ay: number, bx: number, by: number, width: number, y: number, color: THREE.Color, vScale = 2): number {
    const len = Math.hypot(bx - ax, by - ay) || 1e-6;
    const dx = (bx - ax) / len;
    const dy = (by - ay) / len;
    const nx = -dy * (width / 2);
    const ny = dx * (width / 2);
    const base = this.pos.length / 3;
    const v = len / vScale;
    this.pos.push(
      ax + nx, y, ay + ny,
      ax - nx, y, ay - ny,
      bx + nx, y, by + ny,
      bx - nx, y, by - ny,
    );
    this.uv.push(0, 0, 1, 0, 0, v, 1, v);
    for (let i = 0; i < 4; i++) this.col.push(color.r, color.g, color.b);
    this.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    return base / 4;
  }

  /** Quadrado centrado em (cx, cy). */
  square(cx: number, cy: number, size: number, y: number, color: THREE.Color): number {
    const h = size / 2;
    return this.segment(cx - h, cy, cx + h, cy, size, y, color, size);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Recolore os 4 vértices de um quad numa geometria construída pelo QuadBuilder. */
export function setQuadColor(geometry: THREE.BufferGeometry, quad: number, color: THREE.Color): void {
  const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < 4; i++) attr.setXYZ(quad * 4 + i, color.r, color.g, color.b);
  attr.needsUpdate = true;
}
