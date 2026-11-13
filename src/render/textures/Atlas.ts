import { CanvasTexture, NearestFilter, RepeatWrapping } from 'three';
import { makeRng, type Rng } from '../util';

/**
 * Atlas procedural 256×256 = 4×4 tiles de 64×64 (SPEC §5: texturas 32/64 px, sem filtro).
 * Tudo é desenhado em código com seed fixa: nenhum asset de terceiros, 100% reprodutível.
 * Quando entrarem texturas CC0 (docs/referencias.md), basta trocar o desenho de um tile.
 */
export const TILE_NAMES = [
  'white', 'concrete', 'asphalt', 'sidewalk',
  'lane_slow', 'lane_fast', 'lane_transit', 'grass',
  'water', 'glass', 'facade', 'brick',
  'azulejo', 'zebra', 'graffiti', 'maple',
] as const;
export type TileName = (typeof TILE_NAMES)[number];

export const TILE_PX = 64;
const GRID = 4;
export const TILE_UV = 1 / GRID;

export const TILE_DESCRICAO: Record<TileName, string> = {
  white: 'Branco liso (peças só com cor de vértice)',
  concrete: 'Concreto cru com juntas e rachaduras',
  asphalt: 'Asfalto (sarjetas e cruzamentos)',
  sidewalk: 'Calçada de placas',
  lane_slow: 'Faixa rodinha lenta (turquesa)',
  lane_fast: 'Faixa rodinha rápida (azul royal)',
  lane_transit: 'Faixa coletiva (roxo, hachurada)',
  grass: 'Gramado verde-limão Aero',
  water: 'Água turquesa do canal',
  glass: 'Vidro de torre Aero',
  facade: 'Fachada de concreto com janelas',
  brick: 'Tijolo (Pátio Industrial)',
  azulejo: 'Azulejo de bowl/túnel',
  zebra: 'Zebrado de lançamento',
  graffiti: 'Muro pichado (tags originais)',
  maple: 'Madeira de rampa',
};

/** Offset UV (canto inferior esquerdo) de um tile, já considerando flipY. */
export function tileOffset(name: TileName): [number, number] {
  const i = TILE_NAMES.indexOf(name);
  const col = i % GRID;
  const row = Math.floor(i / GRID);
  return [col * TILE_UV, 1 - (row + 1) * TILE_UV];
}

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, c: string, w = 1, h = 1) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Ruído "cru": pontos de ±variação sobre a cor base. */
function noise(ctx: Ctx, rng: Rng, base: string, amount: number, density = 1) {
  px(ctx, 0, 0, base, TILE_PX, TILE_PX);
  for (let i = 0; i < TILE_PX * TILE_PX * density; i++) {
    const x = Math.floor(rng() * TILE_PX);
    const y = Math.floor(rng() * TILE_PX);
    px(ctx, x, y, shade(base, 1 + (rng() - 0.5) * amount));
  }
}

function laneDashes(ctx: Ctx, color: string) {
  // Tracejado na borda esquerda: repete ao longo do comprimento da faixa.
  for (let y = 0; y < TILE_PX; y += 32) px(ctx, 1, y + 4, color, 3, 16);
}

const DRAW: Record<TileName, (ctx: Ctx, rng: Rng) => void> = {
  white: (ctx) => px(ctx, 0, 0, '#FFFFFF', TILE_PX, TILE_PX),

  concrete: (ctx, rng) => {
    noise(ctx, rng, '#C8C2B6', 0.18, 0.6);
    px(ctx, 0, 0, '#9A958B', TILE_PX, 1);
    px(ctx, 0, 0, '#9A958B', 1, TILE_PX);
    let x = 10 + rng() * 40, y = 6;
    for (let i = 0; i < 14; i++) { // rachadura
      px(ctx, Math.round(x), Math.round(y), '#8C877E');
      x += (rng() - 0.5) * 3; y += 1 + rng() * 2;
    }
  },

  asphalt: (ctx, rng) => noise(ctx, rng, '#4A5059', 0.35, 0.9),

  sidewalk: (ctx, rng) => {
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const b = shade('#D9CFBC', 0.94 + rng() * 0.1);
      px(ctx, gx * 16, gy * 16, b, 16, 16);
      px(ctx, gx * 16, gy * 16, '#A89F8E', 16, 1);
      px(ctx, gx * 16, gy * 16, '#A89F8E', 1, 16);
    }
    for (let i = 0; i < 4; i++) px(ctx, rng() * 60, rng() * 60, '#F2A6C8', 2, 2); // chiclete
  },

  lane_slow: (ctx, rng) => { noise(ctx, rng, '#1E9C8F', 0.12, 0.4); laneDashes(ctx, '#E9FFF8'); },
  lane_fast: (ctx, rng) => { noise(ctx, rng, '#2F48B8', 0.12, 0.4); laneDashes(ctx, '#FFE23A'); },
  lane_transit: (ctx, rng) => {
    noise(ctx, rng, '#6A3FC0', 0.12, 0.4);
    for (let i = -TILE_PX; i < TILE_PX; i += 12) for (let k = 0; k < TILE_PX; k++) {
      if (i + k >= 0 && i + k < TILE_PX) px(ctx, i + k, k, '#7F57D6', 3, 1);
    }
    px(ctx, 0, 0, '#F2F8FC', 2, TILE_PX);
    px(ctx, TILE_PX - 2, 0, '#F2F8FC', 2, TILE_PX);
  },

  grass: (ctx, rng) => {
    noise(ctx, rng, '#7BD13A', 0.2, 0.5);
    for (let i = 0; i < 90; i++) {
      const x = rng() * TILE_PX, y = rng() * TILE_PX;
      px(ctx, x, y, rng() > 0.5 ? '#9BE84F' : '#5FB02C', 1, 2);
    }
  },

  water: (ctx, rng) => {
    px(ctx, 0, 0, '#1FB5A6', TILE_PX, TILE_PX);
    for (let y = 0; y < TILE_PX; y += 8) for (let x = 0; x < TILE_PX; x++) {
      const yy = y + Math.round(Math.sin((x / TILE_PX) * Math.PI * 4 + y) * 2);
      px(ctx, x, (yy + TILE_PX) % TILE_PX, '#5FE0D2');
    }
    for (let i = 0; i < 12; i++) px(ctx, rng() * 62, rng() * 62, '#C9FFF6', 2, 1);
  },

  glass: (ctx) => {
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      for (let y = 0; y < 16; y++) {
        const t = y / 16;
        px(ctx, gx * 16, gy * 16 + y, shade('#7FD8E8', 1.15 - t * 0.35), 16, 1);
      }
      px(ctx, gx * 16 + 2, gy * 16 + 2, '#F2FFFF', 2, 6); // highlight Aero
      px(ctx, gx * 16, gy * 16, '#D6DEE6', 16, 1);
      px(ctx, gx * 16, gy * 16, '#D6DEE6', 1, 16);
    }
  },

  facade: (ctx, rng) => {
    noise(ctx, rng, '#BDB4A4', 0.12, 0.4);
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const lit = rng() > 0.7;
      px(ctx, gx * 16 + 4, gy * 16 + 4, lit ? '#FFE9A8' : '#34465E', 9, 8);
      px(ctx, gx * 16 + 4, gy * 16 + 4, lit ? '#FFF6D6' : '#5F7896', 9, 2);
      px(ctx, gx * 16 + 3, gy * 16 + 12, '#8E8678', 11, 1);
    }
  },

  brick: (ctx, rng) => {
    px(ctx, 0, 0, '#8E7F6E', TILE_PX, TILE_PX);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const off = r % 2 ? 8 : 0;
      px(ctx, c * 16 + off + 1, r * 8 + 1, shade('#A8553A', 0.85 + rng() * 0.3), 15, 7);
    }
  },

  azulejo: (ctx, rng) => {
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
      const blue = (gx + gy) % 5 === 0;
      px(ctx, gx * 8, gy * 8, blue ? '#2E8BEA' : shade('#F2F8FC', 0.95 + rng() * 0.05), 8, 8);
      px(ctx, gx * 8, gy * 8, '#B9C6D2', 8, 1);
      px(ctx, gx * 8, gy * 8, '#B9C6D2', 1, 8);
    }
  },

  zebra: (ctx) => {
    for (let y = 0; y < TILE_PX; y++) for (let x = 0; x < TILE_PX; x++) {
      px(ctx, x, y, Math.floor((x + y) / 8) % 2 ? '#1A1B1E' : '#FFD400');
    }
  },

  graffiti: (ctx, rng) => {
    noise(ctx, rng, '#B5AEA2', 0.15, 0.5);
    const spray = ['#FF5FA8', '#00E5FF', '#B8F02A', '#FF7A1A', '#7B4FD6', '#FFE23A'];
    for (let tag = 0; tag < 3; tag++) {
      const c = spray[Math.floor(rng() * spray.length)];
      let x = 6 + rng() * 40, y = 10 + tag * 18;
      for (let i = 0; i < 26; i++) { // letras "bolha" originais, sem copiar arte de ninguém
        const r = 2 + rng() * 3;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        px(ctx, x - r, y + r, '#1A1B1E', r * 2, 1);
        x += 1.5 + rng() * 1.5; y += (rng() - 0.5) * 4;
        if (rng() > 0.85) px(ctx, x, y, c, 1, 4 + rng() * 6); // escorrido
      }
    }
  },

  maple: (ctx, rng) => {
    for (let y = 0; y < TILE_PX; y += 8) {
      px(ctx, 0, y, shade('#C68A4E', 0.9 + rng() * 0.2), TILE_PX, 8);
      px(ctx, 0, y + 7, '#8E5E33', TILE_PX, 1);
      for (let i = 0; i < 10; i++) px(ctx, rng() * TILE_PX, y + 1 + rng() * 5, '#B07A42', 3, 1);
    }
  },
};

let cached: { texture: CanvasTexture; canvas: HTMLCanvasElement } | null = null;

export function getAtlas(): { texture: CanvasTexture; canvas: HTMLCanvasElement } {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE_PX * GRID;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  TILE_NAMES.forEach((name, i) => {
    ctx.save();
    ctx.translate((i % GRID) * TILE_PX, Math.floor(i / GRID) * TILE_PX);
    ctx.beginPath(); ctx.rect(0, 0, TILE_PX, TILE_PX); ctx.clip();
    DRAW[name](ctx, makeRng(1000 + i));
    ctx.restore();
  });
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  cached = { texture, canvas };
  return cached;
}
