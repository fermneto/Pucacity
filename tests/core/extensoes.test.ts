import { describe, expect, it } from 'vitest';
import vitrine from '../../src/assets/cities/vitrine.json';
import vilaNova from '../../src/assets/cities/vila-nova.json';
import { validateCity } from '../../src/core/CityLoader';

// Extensões do contrato (features da Arte, characters do Design): o validador pega erros de digitação.
const clone = <T>(v: T): T => structuredClone(v);
const errorsOf = (raw: unknown): string[] => {
  const r = validateCity(raw);
  return r.ok ? [] : r.errors;
};

describe('features', () => {
  it('kind desconhecido é erro', () => {
    const c = clone(vitrine) as { features: { kind: string }[] };
    c.features[0]!.kind = 'disco_voador';
    expect(errorsOf(c).some((e) => e.startsWith('features[0].kind'))).toBe(true);
  });
  it('rot não numérico é erro', () => {
    const c = clone(vitrine) as unknown as { features: { rot: unknown }[] };
    c.features[0]!.rot = 'norte';
    expect(errorsOf(c).some((e) => e.startsWith('features[0].rot'))).toBe(true);
  });
});

describe('characters', () => {
  it('a Vila Nova tem personagens válidos', () => {
    expect(errorsOf(vilaNova)).toEqual([]);
  });
  it('casa inexistente, veículo inválido e id repetido são erros', () => {
    const c = clone(vilaNova) as unknown as { characters: Record<string, unknown>[] };
    c.characters[0]!.home = 9999;
    c.characters[1]!.vehicle = 'carro';
    c.characters[2]!.id = c.characters[0]!.id;
    const errs = errorsOf(c);
    expect(errs.some((e) => e.startsWith('characters[0].home'))).toBe(true);
    expect(errs.some((e) => e.startsWith('characters[1].vehicle'))).toBe(true);
    expect(errs.some((e) => e.startsWith('characters[2].id'))).toBe(true);
  });
});
