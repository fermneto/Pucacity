import { describe, expect, it } from 'vitest';
import vitrine from '../../src/assets/cities/vitrine.json';
import { validateCity } from '../../src/core/CityLoader';

// Integração Arte ↔ Engenharia: a cidade da vitrine visual precisa seguir o contrato oficial (types.ts).
describe('vitrine.json', () => {
  it('valida no CityLoader sem erros', () => {
    const r = validateCity(vitrine);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.ok).toBe(true);
  });

  it('avisa sobre a travessia sem rota acessível (proposital, para o overlay)', () => {
    const r = validateCity(vitrine);
    expect(r.ok && r.warnings.some((w) => /acess/i.test(w))).toBe(true);
  });
});
