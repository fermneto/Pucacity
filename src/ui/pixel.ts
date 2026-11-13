/**
 * Arte pixelada da interface: retratos 32×32 dos personagens e ícones 8×8.
 * Tudo é desenhado em canvas, pixel a pixel, e ampliado com vizinho mais próximo
 * (nada de suavização) para combinar com o PS1 cru do jogo.
 */

export type HairStyle = 'curto' | 'coque' | 'bone' | 'careca' | 'capacete' | 'longo';
export type Mood = 'normal' | 'feliz' | 'bravo' | 'preocupado';

/** Descrição de um retrato. As cores são CSS hex (#rrggbb). */
export interface PortraitSpec {
  /** Semente das pequenas variações (sardas, pontilhado do fundo). */
  seed: number | string;
  skin: string;
  hair: string;
  shirt: string;
  /** Cor de destaque: boné, capacete, avental, alça da bolsa. */
  accent?: string;
  /** Fundo do retrato. */
  bg?: string;
  hairStyle?: HairStyle;
  glasses?: boolean;
  mustache?: boolean;
  freckles?: boolean;
  /** Avental (comerciante) ou alça de bolsa de entrega, na cor de destaque. */
  outfit?: 'avental' | 'bolsa' | 'gola';
}

const INK = '#0b2a52';

function hash(seed: number | string): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** PRNG determinístico (mulberry32): o mesmo personagem sempre gera o mesmo retrato. */
function rng(seed: number | string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Escurece (f<1) ou clareia (f>1) uma cor hex. */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Grade de cores (null = fundo) que vira imagem no fim. */
class Grid {
  readonly px: (string | null)[];
  constructor(readonly w: number, readonly h: number) {
    this.px = new Array<string | null>(w * h).fill(null);
  }
  set(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x] ?? null;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }
  /** Elipse cheia; `pick` permite sombrear por posição. */
  ellipse(cx: number, cy: number, rx: number, ry: number, pick: (x: number, y: number) => string | null) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          const c = pick(x, y);
          if (c) this.set(x, y, c);
        }
      }
    }
  }
}

function paint(grid: Grid, bg: (x: number, y: number) => string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = grid.w;
  c.height = grid.h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      ctx.fillStyle = grid.get(x, y) ?? bg(x, y);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Amplia um canvas pequeno por vizinho mais próximo. */
export function upscale(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d');
  if (!ctx) return src;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  c.style.imageRendering = 'pixelated';
  return c;
}

/**
 * Desenha o retrato 32×32 e devolve um canvas já ampliado (padrão ×3 = 96 px).
 * O mesmo `spec` gera sempre o mesmo retrato; `mood` muda sobrancelhas e boca.
 */
export function drawPortrait(spec: PortraitSpec, mood: Mood = 'normal', scale = 3): HTMLCanvasElement {
  const S = 32;
  const r = rng(spec.seed);
  const g = new Grid(S, S);
  const skin = spec.skin, skinD = shade(skin, 0.78), hair = spec.hair, hairD = shade(hair, 0.72);
  const shirt = spec.shirt, shirtD = shade(shirt, 0.75);
  const accent = spec.accent ?? '#ff5fa8';
  const style = spec.hairStyle ?? 'curto';

  // Tronco e ombros
  g.ellipse(16, 33, 13, 9, (x) => (x < 7 || x > 24 ? shirtD : shirt));
  if (spec.outfit === 'avental') {
    g.rect(12, 26, 8, 6, accent);
    g.rect(11, 25, 1, 3, accent);
    g.rect(20, 25, 1, 3, accent);
  } else if (spec.outfit === 'bolsa') {
    for (let i = 0; i < 9; i++) g.set(8 + i, 24 + Math.floor(i * 0.9), accent);
    for (let i = 0; i < 9; i++) g.set(9 + i, 24 + Math.floor(i * 0.9), shade(accent, 0.8));
  } else if (spec.outfit === 'gola') {
    g.rect(13, 25, 6, 1, shade(shirt, 1.35));
    g.set(16, 26, shade(shirt, 1.35));
  }
  // Pescoço
  g.rect(13, 21, 6, 4, skinD);
  // Cabelo longo atrás da cabeça
  if (style === 'longo' || style === 'bone') g.ellipse(16, 15, 9, 10, (_x, y) => (y > 6 ? hairD : null));
  // Cabeça (sombra no lado direito e no queixo)
  g.ellipse(16, 14, 7.2, 8.6, (x, y) => (x >= 21 || y >= 21 ? skinD : skin));
  // Orelhas
  g.rect(8, 13, 1, 3, skinD);
  g.rect(23, 13, 1, 3, skinD);

  // Cabelo / chapéu
  switch (style) {
    case 'coque':
      g.ellipse(16, 4.5, 3.5, 3, (x) => (x > 17 ? hairD : hair));
      g.ellipse(16, 10, 8, 5.2, (x, y) => (y <= 10 ? (x > 20 ? hairD : hair) : null));
      g.rect(8, 10, 2, 5, hair);
      g.rect(22, 10, 2, 5, hairD);
      break;
    case 'curto':
      g.ellipse(16, 9.5, 8, 5, (x, y) => (y <= 10 ? (x > 20 ? hairD : hair) : null));
      for (let x = 10; x < 22; x += 3) g.rect(x, 10, 2, 1, hair);
      g.rect(8, 9, 1, 4, hair);
      g.rect(23, 9, 1, 4, hairD);
      break;
    case 'longo':
      g.ellipse(16, 9.5, 8.2, 5.2, (x, y) => (y <= 10 ? (x > 20 ? hairD : hair) : null));
      g.rect(8, 9, 2, 12, hair);
      g.rect(22, 9, 2, 12, hairD);
      break;
    case 'careca':
      g.rect(8, 11, 2, 5, hair);
      g.rect(22, 11, 2, 5, hairD);
      g.set(12, 7, shade(skin, 1.25));
      g.set(13, 7, shade(skin, 1.25));
      break;
    case 'bone': {
      // boné virado para trás: copa na cor de destaque e aba saindo atrás (à direita)
      const a = accent, aD = shade(accent, 0.72);
      g.ellipse(16, 9, 8.2, 5, (x, y) => (y <= 9 ? (x > 20 ? aD : a) : null));
      g.rect(22, 8, 5, 2, aD);
      g.rect(9, 10, 14, 1, aD);
      g.rect(13, 5, 3, 1, shade(accent, 1.4));
      g.rect(8, 11, 1, 6, hair); // mechas soltas
      g.rect(23, 11, 1, 6, hairD);
      break;
    }
    case 'capacete': {
      const a = accent, aD = shade(accent, 0.72);
      g.ellipse(16, 9, 9, 6.5, (x, y) => (y <= 10 ? (x > 21 ? aD : a) : null));
      g.rect(7, 10, 18, 2, aD);
      g.rect(15, 3, 2, 8, '#ffffff'); // listra
      g.rect(8, 12, 1, 4, hair);
      break;
    }
  }

  // Sardas (variação por semente)
  if (spec.freckles) {
    for (let i = 0; i < 4; i++) g.set(10 + Math.floor(r() * 3) + (i % 2) * 9, 16 + Math.floor(r() * 2), skinD);
  }

  // Olhos
  const eyeY = 14;
  for (const ex of [12, 19]) {
    g.set(ex, eyeY, '#ffffff');
    g.set(ex + 1, eyeY, INK);
    g.set(ex + 1, eyeY + 1, INK);
    g.set(ex, eyeY + 1, '#d8e8f4');
  }
  // Sobrancelhas conforme o humor
  const brow = style === 'careca' ? hairD : shade(hair, 0.6);
  if (mood === 'bravo') {
    g.rect(11, 12, 2, 1, brow); g.set(13, 13, brow);
    g.rect(20, 12, 2, 1, brow); g.set(19, 13, brow);
  } else if (mood === 'preocupado') {
    g.set(11, 13, brow); g.rect(12, 12, 2, 1, brow);
    g.set(21, 13, brow); g.rect(19, 12, 2, 1, brow);
  } else {
    g.rect(11, 12, 3, 1, brow);
    g.rect(19, 12, 3, 1, brow);
  }
  // Óculos
  if (spec.glasses) {
    const f = '#c9a227';
    for (const ox of [10, 17]) {
      g.rect(ox, 13, 5, 1, f); g.rect(ox, 16, 5, 1, f);
      g.rect(ox, 13, 1, 4, f); g.rect(ox + 4, 13, 1, 4, f);
    }
    g.rect(15, 14, 2, 1, f);
  }
  // Nariz e bochechas
  g.set(16, 16, skinD);
  g.set(16, 17, skinD);
  if (!spec.mustache) {
    g.set(10, 18, shade('#ff8fa8', 1));
    g.set(22, 18, shade('#ff8fa8', 0.95));
  }
  // Bigode
  if (spec.mustache) {
    g.rect(13, 18, 7, 1, hair);
    g.rect(12, 19, 2, 1, hair);
    g.rect(19, 19, 2, 1, hairD);
  }
  // Boca
  const m = '#8a2a3a';
  const my = spec.mustache ? 20 : 19;
  if (mood === 'feliz') {
    g.set(14, my, m); g.rect(15, my + 1, 3, 1, m); g.set(18, my, m);
    g.rect(15, my, 3, 1, '#ffffff');
  } else if (mood === 'bravo' || mood === 'preocupado') {
    g.set(14, my + 1, m); g.rect(15, my, 3, 1, m); g.set(18, my + 1, m);
  } else {
    g.rect(15, my, 3, 1, m);
  }

  // Contorno escuro da silhueta (1 px), típico de sprite
  const outline: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (g.get(x, y)) continue;
      if (g.get(x - 1, y) || g.get(x + 1, y) || g.get(x, y - 1) || g.get(x, y + 1)) outline.push([x, y]);
    }
  }
  for (const [x, y] of outline) g.set(x, y, INK);

  // Fundo de céu Aero com pontilhado ordenado (dither 2×2)
  const bg = spec.bg ?? '#9fd4ff';
  const bgL = shade(bg, 1.35), bgD = shade(bg, 0.88);
  const off = Math.floor(r() * 2);
  const canvas = paint(g, (x, y) => {
    const band = y < 10 ? 0 : y < 20 ? 1 : 2;
    const odd = (x + y + off) % 2 === 0;
    if (band === 0) return odd ? bgL : bg;
    if (band === 1) return bg;
    return odd ? bgD : bg;
  });
  return scale === 1 ? canvas : upscale(canvas, scale);
}

// ---------------------------------------------------------------------------
// Ícones 8×8 (cada string é uma linha; '#' = tinta, '+' = brilho, '.' = vazio)

export type IconId =
  | 'faixas' | 'queda' | 'energia' | 'calor' | 'equidade' | 'acesso' | 'clima' | 'comercio'
  | 'saldo' | 'satisfacao' | 'radical' | 'tempo' | 'sobe' | 'desce' | 'igual' | 'estrela'
  | 'onda' | 'alerta';

const ICONS: Record<IconId, string[]> = {
  faixas: ['#.#..#.#', '#.#..#.#', '#....#.#', '#.#..#.#', '#.#....#', '#....#.#', '#.#..#.#', '#.#..#.#'],
  queda: ['....##..', '....##..', '..#.....', '.####...', '#..#.#..', '..#..#..', '.#...+..', '#..#####'],
  energia: ['....##..', '...##...', '..##....', '.######.', '....##..', '...##...', '..##....', '.##.....'],
  calor: ['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
  equidade: ['...#....', '#######.', '#..#..#.', '#..#..#.', '##.#.##.', '...#....', '...#....', '.#####..'],
  acesso: ['...##...', '...##...', '..###...', '..#.###.', '.#...#..', '#..+..#.', '#.....#.', '.#####..'],
  clima: ['..####..', '.######.', '########', '...#....', '...#....', '...#....', '.#.#....', '..#.....'],
  comercio: ['########', '#+#+#+#+', '########', '#......#', '#.##.#.#', '#.##.#.#', '#.##...#', '########'],
  saldo: ['..####..', '.#+..##.', '#.+##..#', '#.##...#', '#...##.#', '#..##..#', '.##..##.', '..####..'],
  satisfacao: ['.##..##.', '#++##..#', '#+.....#', '#......#', '.#....#.', '..#..#..', '...##...', '........'],
  radical: ['...#....', '...#....', '..###...', '#######.', '.#####..', '..#.#...', '.#...#..', '#.....#.'],
  tempo: ['..####..', '.#....#.', '#...#..#', '#...#..#', '#..##..#', '#......#', '.#....#.', '..####..'],
  sobe: ['...##...', '..####..', '.######.', '########', '..####..', '..####..', '..####..', '..####..'],
  desce: ['..####..', '..####..', '..####..', '..####..', '########', '.######.', '..####..', '...##...'],
  igual: ['........', '........', '########', '........', '........', '########', '........', '........'],
  estrela: ['...##...', '...##...', '########', '.######.', '..####..', '.######.', '.##..##.', '##....##'],
  onda: ['.#....#.', '#..##..#', '#.#..#.#', '#.#..#.#', '#..##..#', '.#.##.#.', '...##...', '..####..'],
  alerta: ['...##...', '..#..#..', '..#..#..', '.#.##.#.', '.#.##.#.', '#......#', '#..##..#', '########'],
};

const iconCache = new Map<string, string>();

/** Ícone pixelado como data URL (para `<img>` ou `background-image`), ampliado ×scale. */
export function iconUrl(id: IconId, color = INK, scale = 2): string {
  const key = `${id}|${color}|${scale}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const rows = ICONS[id];
  const g = new Grid(8, 8);
  rows.forEach((row, y) => {
    for (let x = 0; x < 8; x++) {
      const ch = row[x];
      if (ch === '#') g.set(x, y, color);
      else if (ch === '+') g.set(x, y, '#ffffff');
    }
  });
  const small = document.createElement('canvas');
  small.width = 8;
  small.height = 8;
  const ctx = small.getContext('2d');
  if (ctx) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const c = g.get(x, y);
        if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
      }
    }
  }
  const url = upscale(small, scale).toDataURL();
  iconCache.set(key, url);
  return url;
}

/** `<img>` de ícone pronto para inserir no DOM. */
export function icon(id: IconId, color = INK, scale = 2, cls = 'px-icon'): HTMLImageElement {
  const img = document.createElement('img');
  img.src = iconUrl(id, color, scale);
  img.width = 8 * scale;
  img.height = 8 * scale;
  img.alt = '';
  img.className = cls;
  img.draggable = false;
  return img;
}
