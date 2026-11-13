import type { IconId } from './pixel';

/**
 * Rótulos e ícones dos KPIs mostrados na interface (docs/design/problemas.md §1).
 * Só apresentação: os valores vêm do core. `better` diz se subir é bom ou ruim.
 */
export interface KpiMeta {
  /** Problema do catálogo (P1–P8) ou indicador geral. */
  problem: string;
  label: string;
  icon: IconId;
  better: 'up' | 'down';
}

export type UiKpiId =
  | 'tempo' | 'quedas' | 'energia' | 'ruido' | 'equidade' | 'acesso' | 'resiliencia' | 'comercio'
  | 'saldo' | 'satisfacao' | 'radical' | 'fila';

export const KPI_META: Record<UiKpiId, KpiMeta> = {
  tempo: { problem: 'P1', label: 'Tempo médio de viagem', icon: 'faixas', better: 'down' },
  quedas: { problem: 'P2', label: 'Quedas / 1.000 viagens', icon: 'queda', better: 'down' },
  energia: { problem: 'P3', label: 'Energia atendida', icon: 'energia', better: 'up' },
  ruido: { problem: 'P4', label: 'Ruído e calor', icon: 'calor', better: 'down' },
  equidade: { problem: 'P5', label: 'Diferença entre bairros', icon: 'equidade', better: 'down' },
  acesso: { problem: 'P6', label: 'Acessibilidade', icon: 'acesso', better: 'up' },
  resiliencia: { problem: 'P7', label: 'Recuperação após crise', icon: 'clima', better: 'down' },
  comercio: { problem: 'P8', label: 'Movimento do comércio', icon: 'comercio', better: 'up' },
  saldo: { problem: '$', label: 'Saldo', icon: 'saldo', better: 'up' },
  satisfacao: { problem: '♥', label: 'Satisfação', icon: 'satisfacao', better: 'up' },
  radical: { problem: '★', label: 'Radicalidade', icon: 'radical', better: 'up' },
  fila: { problem: 'P6', label: 'Fila do Elevador', icon: 'tempo', better: 'down' },
};

/** Ordem dos 8 problemas na tela de balanço. */
export const PROBLEM_KPIS: UiKpiId[] = ['tempo', 'quedas', 'energia', 'ruido', 'equidade', 'acesso', 'resiliencia', 'comercio'];

/** Atalho para criar elementos com classe e texto (texto sempre via textContent). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text?: string,
  ...children: (Node | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  for (const c of children) if (c) e.appendChild(c);
  return e;
}

/** `<span>` acima do reflexo do gel (o `.gel::after` cobre o resto). */
export function gelSpan(cls = '', text?: string, ...children: (Node | null | undefined)[]): HTMLSpanElement {
  return el('span', cls, text, ...children);
}
