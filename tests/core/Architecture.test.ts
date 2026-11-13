import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regras de arquitetura de src/core (SPEC §6): simulação pura, testável e determinística.
 * (Substitui o ESLint enquanto o typescript-eslint não suporta TypeScript 7.)
 */
const CORE = 'src/core';
const files = readdirSync(CORE, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ name: f, code: readFileSync(join(CORE, f), 'utf8') }));

const RULES: { what: string; pattern: RegExp }[] = [
  { what: 'importar three', pattern: /from\s+['"]three(\/[^'"]*)?['"]/ },
  { what: 'importar render/ ou ui/', pattern: /from\s+['"][^'"]*\/(render|ui)\/[^'"]*['"]/ },
  { what: 'usar Math.random (use Rng)', pattern: /Math\.random\s*\(/ },
  { what: 'usar window/document (DOM)', pattern: /\b(window|document)\./ },
];

describe('arquitetura de src/core', () => {
  it('tem arquivos para checar', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const rule of RULES) {
    it(`nenhum arquivo do core pode ${rule.what}`, () => {
      const offenders = files.filter((f) => rule.pattern.test(f.code)).map((f) => f.name);
      expect(offenders).toEqual([]);
    });
  }
});
