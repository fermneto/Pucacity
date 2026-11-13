import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CityValidationError, parseCity, validateCity } from '../../src/core/CityLoader';
import { tinyCity } from './fixtures';

describe('validateCity', () => {
  it('aceita uma cidade válida', () => {
    const r = validateCity(tinyCity());
    expect(r.ok).toBe(true);
  });

  it('aceita a cidade-demo publicada', () => {
    const raw = JSON.parse(readFileSync('public/cities/demo.json', 'utf8'));
    const r = validateCity(raw);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.city.nodes.length).toBe(36);
  });

  it('rejeita raiz que não é objeto', () => {
    expect(validateCity(null)).toEqual({ ok: false, errors: ['raiz: precisa ser um objeto'] });
  });

  it('coleta vários erros de uma vez, com caminho legível', () => {
    const c = tinyCity() as unknown as Record<string, any>;
    c.edges[0].to = 99;
    c.edges[1].kind = 'rodovia';
    c.nodes[3].id = 1; // duplicado
    c.buildings[0].rotation = 5;
    const r = validateCity(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('edges[0].to: nó 99 não existe');
    expect(r.errors.some((e) => e.startsWith('edges[1].kind'))).toBe(true);
    expect(r.errors).toContain('nodes[3].id: id 1 repetido');
    expect(r.errors).toContain('buildings[0].rotation: use 0, 1, 2 ou 3');
  });

  it('exige ao menos 1 faixa livre para carros', () => {
    const c = tinyCity();
    c.edges[0]!.lanesReserved = ['bus'];
    const r = validateCity(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('edges[0].lanesReserved: precisa sobrar ao menos 1 faixa para carros');
  });

  it('valida semáforo: arestas existentes e soma dos verdes ≤ ciclo', () => {
    const c = tinyCity();
    c.nodes[0]!.signal = { cycle: 60, phases: [{ edges: [10], green: 40 }, { edges: [777], green: 40 }] };
    const r = validateCity(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('nodes[0].signal.phases[1].edges[0]: aresta 777 não existe');
    expect(r.errors).toContain('nodes[0].signal: soma dos verdes (80s) maior que o ciclo (60s)');
  });

  it('detecta nó fora do mapa e bairro inexistente', () => {
    const c = tinyCity();
    c.nodes[0]!.x = 50;
    c.buildings[0]!.district = 9;
    const r = validateCity(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('nodes[0].x: fora do mapa (0..10)');
    expect(r.errors).toContain('buildings[0].district: bairro 9 não existe');
  });

  it('parseCity lança CityValidationError com a lista de erros', () => {
    const c = tinyCity() as unknown as Record<string, unknown>;
    delete c.name;
    try {
      parseCity(c);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CityValidationError);
      expect((e as CityValidationError).errors).toEqual(['name: texto não vazio obrigatório']);
    }
  });
});
