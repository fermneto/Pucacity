import { MeshBuilder, type Paint } from './MeshBuilder';
import { quarterPipe } from './buildings';
import { WORLD } from '../palette';

/** Geometria compartilhada com as trajetórias dos riders (DemoTraffic). Metros. */
export const SPIRAL = { rIn: 2.4, rOut: 5.6, turns: 2, height: 12, segs: 28 };
export const MEGAPIPE = { R: 5, L: 16, segs: 12 };
/** Vulcão de Gel: anéis do cone (y, raio) da base à borda da cratera. */
export const VOLCANO = { sides: 9, rings: [{ y: 0, r: 8 }, { y: 3.4, r: 5.4 }, { y: 7, r: 2.8 }] };

/**
 * Elementos radicais (data/arte/elementos-radicais.json). Até 300 tris cada.
 * Travessias são paramétricas pelo vão `span` (m), atravessando ao longo de +z
 * com o canal entre z = -span/2 e z = +span/2.
 * `o` recebe peças opacas; `g` recebe vidro translúcido.
 */
type B = MeshBuilder;
type V3 = [number, number, number];
const CHROME = WORLD.cromo;
const ZEBRA = { tile: 'zebra' as const, uvScale: 0.5 };
const LIME = WORLD.faixa_aterrissagem;

function gapSign(o: B, color: string) {
  o.prism(0.08, 3, 4, { color: CHROME, gloss: 1, top: false });
  o.at(0, 2.4, 0, 0, (b) => b.box(2.2, 0.8, 0.15, { color, gloss: 1, omit: ['bottom'] }));
}

export const RADICAL_BUILDERS: Record<string, (o: B, g: B, span: number) => void> = {
  /** Rampa-Ponte: kicker numa margem, aterrissagem na outra, nos dois sentidos. */
  rad_ramp_bridge: (o, _g, S) => {
    for (const side of [-1, 1]) {
      const x = side * 1.7;
      // kicker sobe em direção ao canal
      o.at(x, 0, side * (-S / 2 - 2.5), side < 0 ? 0 : Math.PI, (b) =>
        b.wedge(3, 1.6, 5, { tile: 'maple', faces: { pz: ZEBRA } }));
      // aterrissagem desce saindo do canal, faixa verde-limão na borda
      o.at(x, 0, -side * (S / 2 + 3), side < 0 ? Math.PI : 0, (b) => {
        b.wedge(3, 1.3, 6, { tile: 'concrete', faces: { pz: { tile: 'concrete' } } });
        b.at(0, 1.3, 2.75, 0, (b) => b.box(3, 0.06, 0.5, { color: LIME, omit: ['bottom'] }));
      });
    }
    o.at(-4.2, 0, -S / 2 - 1.5, 0, (b) => gapSign(b, '#FFE23A'));
  },

  /** Loop Aéreo: pista de vidro ciano com bordas cromadas e pilares. */
  rad_air_loop: (o, g, _S) => {
    const R = 6, W = 4, segs = 16;
    const P = (i: number) => {
      const a = (i / segs) * Math.PI * 2;
      const xo = (i / segs - 0.5) * 4.4; // hélice: entrada e saída lado a lado
      return { a, xo, y: R * (1 - Math.cos(a)), z: R * Math.sin(a) };
    };
    for (let i = 0; i < segs; i++) {
      const p0 = P(i), p1 = P(i + 1);
      const L0: V3 = [p0.xo - W / 2, p0.y, p0.z], R0: V3 = [p0.xo + W / 2, p0.y, p0.z];
      const L1: V3 = [p1.xo - W / 2, p1.y, p1.z], R1: V3 = [p1.xo + W / 2, p1.y, p1.z];
      const ym = (p0.y + p1.y) / 2, zm = (p0.z + p1.z) / 2;
      const inward = [0, R - ym, -zm];
      g.quadXYZ(L0, R0, R1, L1, { color: '#7FE8F8', gloss: 1 }, inward);
      // bordas cromadas (guard-rails) apontando para o centro do loop
      const k = 0.35 / R;
      for (const [A, Bv] of [[L0, L1], [R0, R1]] as const) {
        const A2 = [A[0], A[1] + (R - A[1]) * k, A[2] - A[2] * k];
        const B2 = [Bv[0], Bv[1] + (R - Bv[1]) * k, Bv[2] - Bv[2] * k];
        o.quadXYZ(A, Bv, B2, A2, { color: CHROME, gloss: 1 }, [A === L0 ? -1 : 1, 0, 0]);
        o.quadXYZ(A, Bv, B2, A2, { color: CHROME, gloss: 1 }, [A === L0 ? 1 : -1, 0, 0]);
      }
    }
    for (const sx of [-1, 1]) o.at(sx * (W / 2 + 2.9), 0, 0, 0, (b) => b.prism(0.35, 2 * R + 0.4, 6, { color: CHROME, gloss: 1 }));
    o.at(0, 2 * R + 0.4, 0, 0, (b) => b.box(W + 6.5, 0.4, 0.5, { color: '#3FD0E8', gloss: 1, omit: ['bottom'] }));
  },

  /** Salto Mortal: rampa alta, aterrissagem longa, rede de segurança e placar de recorde. */
  rad_death_jump: (o, g, S) => {
    o.at(0, 0, -S / 2 - 5, 0, (b) => b.wedge(5, 4.5, 10, { tile: 'maple', faces: { pz: ZEBRA, px: { tile: 'graffiti' } } }));
    o.at(0, 0, S / 2 + 5, Math.PI, (b) => {
      b.wedge(5, 2.6, 10, { tile: 'concrete' });
      b.at(0, 2.6, 4.75, 0, (b) => b.box(5, 0.06, 0.5, { color: LIME, omit: ['bottom'] }));
    });
    for (const [x, c] of [[-2.7, '#FF5FA8'], [2.7, '#B8F02A']] as const) {
      o.at(x, 4.5, -S / 2 - 0.4, 0, (b) => {
        b.prism(0.05, 1.6, 3, { color: CHROME, top: false });
        b.triXYZ([0, 1.6, 0], [0, 1.1, 0], [0, 1.35, -0.8], { color: c }, [1, 0, 0]);
        b.triXYZ([0, 1.6, 0], [0, 1.1, 0], [0, 1.35, -0.8], { color: c }, [-1, 0, 0]);
      });
    }
    g.quadXYZ([-2.5, 0.2, -S / 2], [2.5, 0.2, -S / 2], [2.5, 0.2, S / 2], [-2.5, 0.2, S / 2], { color: '#7FD8C8' }, [0, 1, 0]);
    o.at(5, 0, -S / 2 - 3, 0, (b) => {
      b.prism(0.1, 2.6, 4, { color: CHROME, top: false });
      b.at(0, 2.4, 0, 0, (b) => b.box(3.2, 1.8, 0.4, { color: '#3A3F47', faces: { pz: { color: '#00E5FF', gloss: 0.6 } }, omit: ['bottom'] }));
    });
  },

  /** Rail-Passarela: corrimão cromado para grind + passarela de vidro coberta ao lado. */
  rad_rail_walkway: (o, g, S) => {
    const L = S + 6;
    o.at(-1.6, 1.0, 0, 0, (b) => b.box(0.14, 0.14, L, { color: CHROME, gloss: 1, omit: ['bottom'] }));
    for (const z of [-L / 2 + 0.5, L / 2 - 0.5]) o.at(-1.6, 0, z, 0, (b) => b.prism(0.12, 1, 4, { color: CHROME, top: false }));
    for (let i = 0; i < 5; i++) {
      o.at(-1.6, 1.14, -L / 2 + (i + 0.5) * (L / 5), 0, (b) => b.box(0.2, 0.06, 0.3, { color: '#B8F02A', gloss: 1, omit: ['bottom'] }));
    }
    o.at(1.8, 0.5, 0, 0, (b) => b.box(2.8, 0.25, L, { tile: 'sidewalk', omit: ['bottom'] }));
    g.at(1.8, 0.75, 0, 0, (b) => b.box(2.8, 2.4, L, { color: '#9FE8E0', gloss: 1, omit: ['bottom', 'nz', 'pz'] }));
  },

  /** Wallride Tubular: túnel em meia-cana de azulejo. */
  rad_wallride: (o) => {
    const r = 3.5, L = 8, segs = 8;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI, a1 = ((i + 1) / segs) * Math.PI;
      const p = (a: number, z: number) => [Math.cos(a) * r, Math.sin(a) * r, z];
      const am = (a0 + a1) / 2;
      const inward = [-Math.cos(am), -Math.sin(am), 0];
      o.quadXYZ(p(a0, -L / 2), p(a0, L / 2), p(a1, L / 2), p(a1, -L / 2), { tile: 'azulejo' }, inward);
      const q = (a: number, z: number) => [Math.cos(a) * (r + 0.4), Math.sin(a) * (r + 0.4), z];
      o.quadXYZ(q(a0, -L / 2), q(a0, L / 2), q(a1, L / 2), q(a1, -L / 2), { tile: 'graffiti' }, [Math.cos(am), Math.sin(am), 0]);
    }
    for (const z of [-L / 2, L / 2]) o.at(0, r + 0.3, z, 0, (b) => b.box(3, 0.6, 0.25, { color: '#3FD0E8', gloss: 1, omit: ['bottom'] }));
  },

  /** Quarter-pipe de esquina. */
  rad_quarter: (o) => quarterPipe(o, 4, 2),

  /** Funil Bowl: rotatória rebaixada (aqui, elevada em anel) com fonte no centro. */
  rad_bowl: (o) => {
    const Ri = 3.5, Ro = 7, H = 1.4, rim = 0.7, n = 8;
    const at = (r: number, i: number, y: number) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / 8;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    for (let i = 0; i < n; i++) {
      const am = ((i + 0.5) / n) * Math.PI * 2 + Math.PI / 8;
      const out: V3 = [Math.cos(am), 0, Math.sin(am)];
      o.quadXYZ(at(Ri, i, 0), at(Ri, i + 1, 0), at(Ro, i + 1, H), at(Ro, i, H), { tile: 'azulejo' }, [-out[0], 1, -out[2]]);
      o.quadXYZ(at(Ro, i, H), at(Ro, i + 1, H), at(Ro + rim, i + 1, H), at(Ro + rim, i, H), { tile: 'concrete' }, [0, 1, 0]);
      o.quadXYZ(at(Ro + rim, i, 0), at(Ro + rim, i + 1, 0), at(Ro + rim, i + 1, H), at(Ro + rim, i, H), { tile: 'graffiti' }, out);
    }
    for (let i = 1; i < n - 1; i++) o.triXYZ(at(Ri, 0, 0.02), at(Ri, i, 0.02), at(Ri, i + 1, 0.02), { tile: 'concrete' }, [0, 1, 0]);
    o.prism(1.2, 0.6, 8, { tile: 'azulejo', topPaint: { tile: 'water', gloss: 0.6 } });
  },

  /** Elevador de Bolha: duas torres de vidro ligadas por cabo (a cápsula é outro modelo). */
  rad_bubble_lift: (o, g, S) => {
    for (const z of [-S / 2 - 2, S / 2 + 2]) {
      o.at(0, 0, z, 0, (b) => {
        b.prism(1.6, 0.4, 8, { tile: 'concrete' });
        b.at(0, 9, 0, 0, (b) => b.prism(1.6, 0.3, 8, { tile: 'concrete' }));
        b.at(0, 9.3, 0, 0, (b) => b.prism(1.7, 0.15, 8, { color: CHROME, gloss: 1 }));
      });
      g.at(0, 0.4, z, 0, (b) => b.prism(1.1, 8.6, 6, { color: '#9FE8F8', gloss: 1, top: false }));
    }
    o.at(0, 10.4, 0, 0, (b) => b.box(0.08, 0.08, S + 4, { color: CHROME, gloss: 1, omit: ['bottom'] }));
  },

  /** Torre Espiral: rampa em hélice (2 voltas) em volta de um cilindro de vidro; salta-se do topo. */
  rad_spiral_tower: (o, g) => {
    const { rIn, rOut, turns, height, segs } = SPIRAL;
    g.prism(rIn - 0.2, height + 2, 8, { color: '#7FD8E8', gloss: 1, top: false });
    o.at(0, height + 2, 0, 0, (b) => b.prism(rIn, 0.4, 8, { color: '#3FD0E8', gloss: 1 }));
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * turns * Math.PI * 2, a1 = ((i + 1) / segs) * turns * Math.PI * 2;
      const h0 = (i / segs) * height, h1 = ((i + 1) / segs) * height;
      const p = (r: number, a: number, h: number) => [Math.cos(a) * r, h, Math.sin(a) * r];
      const top: Paint = i % 4 < 2 ? { tile: 'maple' } : { tile: 'maple', color: '#FFC2E2' };
      o.quadXYZ(p(rIn, a0, h0), p(rOut, a0, h0), p(rOut, a1, h1), p(rIn, a1, h1), top, [0, 1, 0]);
      o.quadXYZ(p(rIn, a0, h0 - 0.3), p(rOut, a0, h0 - 0.3), p(rOut, a1, h1 - 0.3), p(rIn, a1, h1 - 0.3), { tile: 'concrete' }, [0, -1, 0]);
      const am = (a0 + a1) / 2;
      o.quadXYZ(p(rOut, a0, h0 - 0.3), p(rOut, a1, h1 - 0.3), p(rOut, a1, h1 + 0.35), p(rOut, a0, h0 + 0.35), { color: CHROME, gloss: 1 }, [Math.cos(am), 0, Math.sin(am)]);
    }
    // lábio zebrado de onde se salta no topo
    o.at(Math.cos(0) * (rIn + rOut) / 2, height, 0, Math.PI / 2, (b) => b.wedge(rOut - rIn, 0.5, 1.2, { tile: 'maple', faces: { pz: ZEBRA } }));
  },

  /** Mega Half-pipe: U gigante de madeira com decks, coping cromado e paredes pichadas. */
  rad_megapipe: (o) => {
    const { R, L, segs } = MEGAPIPE;
    const deck = 2;
    const P = (phi: number): [number, number] => [R * Math.sin(phi), R * (1 - Math.cos(phi))]; // [z, y]
    for (let i = 0; i < segs; i++) {
      const p0 = -Math.PI / 2 + (i / segs) * Math.PI, p1 = -Math.PI / 2 + ((i + 1) / segs) * Math.PI;
      const [z0, y0] = P(p0), [z1, y1] = P(p1);
      o.quadXYZ([-L / 2, y0, z0], [L / 2, y0, z0], [L / 2, y1, z1], [-L / 2, y1, z1],
        i === segs / 2 || i === segs / 2 - 1 ? { tile: 'maple', color: '#FFE23A' } : { tile: 'maple' },
        [0, R - (y0 + y1) / 2, -(z0 + z1) / 2]);
      // tampas das pontas (leque a partir do canto externo inferior)
      for (const x of [-L / 2, L / 2]) {
        const cz = z0 + z1 >= 0 ? R + deck : -R - deck;
        o.triXYZ([x, 0, cz], [x, y0, z0], [x, y1, z1], { tile: 'graffiti' }, [Math.sign(x), 0, 0]);
      }
    }
    for (const s of [-1, 1]) {
      for (const x of [-L / 2, L / 2]) o.triXYZ([x, 0, s * (R + deck)], [x, R, s * R], [x, R, s * (R + deck)], { tile: 'graffiti' }, [Math.sign(x), 0, 0]);
      o.at(0, R, s * (R + deck / 2), 0, (b) => b.box(L, 0.3, deck, { tile: 'concrete', omit: ['bottom'] }));
      o.at(0, R, s * R, 0, (b) => b.box(L, 0.18, 0.18, { color: CHROME, gloss: 1, omit: ['bottom'] }));
      o.quadXYZ([-L / 2, 0, s * (R + deck)], [L / 2, 0, s * (R + deck)], [L / 2, R, s * (R + deck)], [-L / 2, R, s * (R + deck)], { tile: 'graffiti' }, [0, 0, s]);
    }
    o.at(0, R + 0.3, R + deck - 0.2, 0, (b) => b.box(6, 1.4, 0.2, { color: '#FF5FA8', gloss: 1, omit: ['bottom'] }));
  },

  /**
   * Vulcão de Gel: cone facetado de rocha/concreto, cratera transbordando "lava" de gel neon
   * lustroso, gotas e bolhas subindo do topo e uma rampa de skate pela encosta (frente = +z).
   */
  rad_volcano: (o, g) => {
    const n = VOLCANO.sides, rings = VOLCANO.rings;
    const jit = [1, 0.92, 1.06, 0.95, 1.08, 0.9, 1.03, 0.97, 1.05];
    const ang = (i: number) => (i / n) * Math.PI * 2 + Math.PI / 2 + Math.PI / n; // +z cai no meio de uma face
    const P = (k: number, i: number): V3 => {
      const ring = rings[k]!, j = jit[(i * (k + 2)) % jit.length]!, a = ang(i);
      const r = ring.r * (k === rings.length - 1 ? 1 : j);
      return [Math.cos(a) * r, ring.y, Math.sin(a) * r];
    };
    const rock: Paint[] = [{ tile: 'concrete', color: '#BDB4A4' }, { tile: 'concrete', color: '#D8C49A' }];
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < n; i++) {
        const am = ang(i + 0.5);
        o.quadXYZ(P(k, i), P(k, i + 1), P(k + 1, i + 1), P(k + 1, i), rock[k % 2]!, [Math.cos(am), 0.6, Math.sin(am)]);
      }
    }
    // cratera: parede interna até o lago de gel
    const top = rings[rings.length - 1]!, lavaY = top.y - 0.5, rIn = top.r * 0.8;
    const C = (i: number): V3 => { const a = ang(i); return [Math.cos(a) * rIn, lavaY, Math.sin(a) * rIn]; };
    for (let i = 0; i < n; i++) {
      const am = ang(i + 0.5);
      o.quadXYZ(P(rings.length - 1, i), P(rings.length - 1, i + 1), C(i + 1), C(i), { tile: 'concrete', color: '#A9A397' }, [-Math.cos(am), 0.5, -Math.sin(am)]);
    }
    const lava: Paint = { color: '#FF5FA8', gloss: 0.55 };
    o.ellipsoid([0, lavaY, 0], [rIn * 1.05, 1.5, rIn * 1.05], n, 3, lava);
    o.at(0.4, lavaY + 0.9, -0.3, 0, (b) => b.sphere(0.8, 6, 3, { color: '#FFE23A', gloss: 0.5 }));
    // escorridos de gel descendo a encosta (sobre as arestas, levemente afastados)
    for (const [i, c] of [[2, '#FF5FA8'], [5, '#FF9F1C'], [7, '#D22D9A']] as const) {
      const up = P(rings.length - 1, i), mid = P(1, i), low = P(0, i);
      const off = (p: V3, f: number, w: number): V3[] => {
        const a = ang(i), tx = -Math.sin(a) * w, tz = Math.cos(a) * w;
        return [[p[0] * f + tx, p[1] + 0.05, p[2] * f + tz], [p[0] * f - tx, p[1] + 0.05, p[2] * f - tz]];
      };
      const [u0, u1] = off(up, 1.04, 1.0) as [V3, V3];
      const [m0, m1] = off(mid, 1.04, 0.8) as [V3, V3];
      const lowP: V3 = [mid[0] + (low[0] - mid[0]) * 0.6, mid[1] + (low[1] - mid[1]) * 0.6, mid[2] + (low[2] - mid[2]) * 0.6];
      const out: V3 = [Math.cos(ang(i)), 0.6, Math.sin(ang(i))];
      o.quadXYZ(u0, u1, m1, m0, { color: c, gloss: 0.5 }, out);
      o.triXYZ(m0, m1, [lowP[0] * 1.04, lowP[1], lowP[2] * 1.04], { color: c, gloss: 0.5 }, out);
    }
    // gotas de gel voando e bolhas de vidro subindo
    for (const [x, y, z, r, c] of [[-1.4, 9.0, 0.6, 0.5, '#B8F02A'], [1.5, 9.8, -0.8, 0.42, '#00E5FF'], [0.3, 10.8, 1.0, 0.36, '#FF9F1C']] as const) {
      o.ellipsoid([x, y, z], [r, r * 1.35, r], 4, 3, { color: c, gloss: 0.5 });
    }
    for (const [x, y, z, r] of [[-0.6, 11.4, -0.4, 0.7], [1.1, 12.5, 0.5, 0.5], [-0.3, 13.4, 0.2, 0.35]] as const) {
      g.at(x, y, z, 0, (b) => b.sphere(r, 6, 3, { color: '#BFF6FF', gloss: 1 }));
    }
    // rampa de skate subindo a encosta pela frente: dois lances de madeira e lábio zebrado
    // a face da frente fica entre os vértices n-1 e 0 de cada anel: a rampa acompanha a encosta
    const zFront = (k: number) => (P(k, n - 1)[2] + P(k, 0)[2]) / 2;
    const W = 1.1, h = 0.3;
    const pts: [number, number][] = [[zFront(0) + 2.4, 0.05], [zFront(1) + 0.1, rings[1]!.y + h], [zFront(2) + 0.05, top.y + h]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [z0, y0] = pts[i]!, [z1, y1] = pts[i + 1]!;
      const deck: Paint = i === 0 ? { tile: 'maple' } : { tile: 'maple', color: '#FFC2E2' };
      o.quadXYZ([-W, y0, z0], [W, y0, z0], [W, y1, z1], [-W, y1, z1], deck, [0, 1, 0.4]);
      for (const sx of [-W, W]) o.quadXYZ([sx, y0 - 0.25, z0], [sx, y1 - 0.25, z1], [sx, y1, z1], [sx, y0, z0], { color: CHROME, gloss: 1 }, [Math.sign(sx), 0, 0]);
    }
    // deck no alto com coping cromado na beira da cratera
    const [zl, yl] = pts[pts.length - 1]!;
    o.at(0, yl - 0.2, zl - 0.5, 0, (b) => b.box(2 * W, 0.2, 1, { tile: 'maple', faces: { pz: ZEBRA }, omit: ['bottom'] }));
    o.at(0, yl, zl - 1.0, 0, (b) => b.box(2 * W, 0.12, 0.12, { color: CHROME, gloss: 1, omit: ['bottom'] }));
  },

  /** Cápsula do elevador (animada à parte). */
  rad_bubble_cabin: (o, g) => {
    g.sphere(1, 8, 5, { color: '#BFF6FF', gloss: 1 });
    o.at(0, 0.9, 0, 0, (b) => b.prism(1.04, 0.14, 8, { color: CHROME, gloss: 1, top: false }));
    o.at(0, 2, 0, 0, (b) => b.box(0.08, 0.4, 0.08, { color: CHROME, omit: ['bottom'] }));
  },
};
