import { describe, expect, it } from 'vitest';
import balance from '../../config/balance.json';
import { BalanceValidationError, loadBalance, validateBalance } from '../../src/core/CityLoader';

const clone = (): any => JSON.parse(JSON.stringify(balance));

describe('config/balance.json', () => {
  it('o arquivo do repositório valida (avisos não bloqueiam)', () => {
    const r = validateBalance(balance);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.balance.time.minutesPerDay).toBe(1440);
    expect(r.balance.lanes.sidewalk.capacityPerWidth).toBeGreaterThan(0);
  });

  it('loadBalance() sem argumento usa o arquivo do repositório', () => {
    const { balance: b } = loadBalance();
    expect(b.congestion.beta).toBe(balance.congestion.beta);
    expect(Object.keys(b.citizens.groups).length).toBeGreaterThan(0);
  });

  it('acusa chaves obrigatórias ausentes, com caminho', () => {
    const raw = clone();
    delete raw.time;
    delete raw.lanes.fast;
    delete raw.modalChoice.weights.diversao;
    const r = validateBalance(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('time: objeto obrigatório');
    expect(r.errors).toContain('lanes.fast: objeto obrigatório');
    expect(r.errors).toContain('modalChoice.weights.diversao: número obrigatório');
  });

  it('acusa tipos e intervalos errados', () => {
    const raw = clone();
    raw.congestion.alpha = 'muito';
    raw.vehicles.skate.fallRisk = 2;
    const r = validateBalance(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('congestion.alpha: número obrigatório');
    expect(r.errors.some((e) => e.startsWith('vehicles.skate.fallRisk'))).toBe(true);
  });

  it('avisa quando a soma dos grupos de cidadãos não é 1', () => {
    const raw = clone();
    raw.citizens.groups.adulto.share = 0.9;
    const r = validateBalance(raw);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('citizens.groups'))).toBe(true);
  });

  it('loadBalance lança BalanceValidationError com todos os erros', () => {
    expect(() => loadBalance({})).toThrow(BalanceValidationError);
    expect(() => loadBalance(42)).toThrow(/raiz/);
  });
});
