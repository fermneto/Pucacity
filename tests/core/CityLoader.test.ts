import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CityValidationError, parseCity, validateCity } from '../../src/core/CityLoader';
import { tinyCity } from './fixtures';

describe('validateCity', () => {
  it('aceita uma cidade válida, sem avisos', () => {
    const r = validateCity(tinyCity());
    expect(r).toMatchObject({ ok: true, warnings: [] });
  });

  it('aceita a cidade-demo publicada', () => {
    const raw = JSON.parse(readFileSync('public/cities/demo.json', 'utf8'));
    const r = validateCity(raw);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.city.crossings.length).toBeGreaterThan(0);
  });

  it('rejeita raiz que não é objeto', () => {
    expect(validateCity(null)).toEqual({ ok: false, errors: ['raiz: precisa ser um objeto'], warnings: [] });
  });

  it('coleta vários erros de uma vez, com caminho legível', () => {
    const c = tinyCity() as unknown as Record<string, any>;
    c.edges[0].to = 99;
    c.edges[1].kind = 'highway'; // não existe mais: cidade sem carros
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

  it('valida faixas por tipo', () => {
    const c = tinyCity() as unknown as Record<string, any>;
    c.edges[0].lanes = { sidewalk: 1, bus: 1 };
    c.edges[1].lanes = { slow: 0 };
    const r = validateCity(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.startsWith('edges[0].lanes.bus: faixa desconhecida'))).toBe(true);
    expect(r.errors).toContain('edges[1].lanes: a via precisa de ao menos 1 faixa');
  });

  it('avisa (sem bloquear) via sem calçada e travessia sem rota acessível', () => {
    const c = tinyCity();
    c.edges[1]!.lanes = { slow: 1, fast: 1 };
    delete c.crossings[0]!.access;
    const r = validateCity(c);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([
      'edges[1]: via sem calçada: pedestres e cadeiras de rodas dividem a faixa lenta',
      'crossings[0]: travessia sem rota acessível (Acessibilidade cai)',
    ]);
  });

  it('valida travessias e bairros', () => {
    const c = tinyCity() as unknown as Record<string, any>;
    c.crossings[0].radical = 'ponte';
    c.crossings[1].to = 77;
    c.districts[0].wheelchairShare = 5;
    c.districts[0].ownership = { car: 50, skate: 120 };
    const r = validateCity(c);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.startsWith('crossings[0].radical'))).toBe(true);
    expect(r.errors).toContain('crossings[1].to: nó 77 não existe');
    expect(r.errors.some((e) => e.startsWith('districts[0].wheelchairShare'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('districts[0].ownership.car: veículo desconhecido'))).toBe(true);
    expect(r.errors).toContain('districts[0].ownership.skate: porcentagem entre 0 e 100');
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
