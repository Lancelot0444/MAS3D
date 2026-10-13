import { describe, expect, it } from 'vitest';
import { granularidad, rango, sumarDias } from '@/lib/fechas';

describe('fechas', () => {
  it('suma días cruzando meses', () => {
    expect(sumarDias('2026-10-30', 3)).toBe('2026-11-02');
  });
  it('rango personalizado inválido cae en el mes actual', () => {
    expect(rango('personalizado', '2026-10-10', '2026-10-01').periodo).toBe('mes');
    expect(rango('personalizado', '2026-10-01', '2026-10-10')).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-10' });
  });
  it('elige la agrupación de los gráficos según el rango', () => {
    expect(granularidad('2026-10-01', '2026-10-31')).toBe('day');
    expect(granularidad('2026-07-01', '2026-10-01')).toBe('week');
    expect(granularidad('2026-01-01', '2026-12-31')).toBe('month');
  });
});
