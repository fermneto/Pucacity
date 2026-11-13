import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCity } from '../../src/core/CityLoader';

// Integração Design (PC2) ↔ Engenharia (PC3) ↔ Arte (PC1): todo mapa em src/assets/cities segue o contrato oficial.
const DIR = 'src/assets/cities';
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

describe('mapas em src/assets/cities validam no CityLoader', () => {
  it('existe ao menos um mapa', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(f, () => {
      const r = validateCity(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
      if (!r.ok) throw new Error(`${f}:\n${r.errors.join('\n')}`);
      expect(r.ok).toBe(true);
    });
  }
});
