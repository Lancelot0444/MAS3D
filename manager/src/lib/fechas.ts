/** Fechas en la zona horaria del negocio (America/Guayaquil, UTC-5 sin horario de verano). */
export const ZONA = 'America/Guayaquil';

export function hoyEC(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const aFecha = (s: string) => new Date(`${s}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const sumarDias = (s: string, n: number) => { const d = aFecha(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export type Periodo = 'hoy' | 'semana' | 'mes' | 'anio' | 'personalizado';
export const PERIODOS: Record<Periodo, string> = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', anio: 'Este año', personalizado: 'Personalizado' };

export function rango(periodo: string | undefined, desde?: string, hasta?: string): { periodo: Periodo; desde: string; hasta: string } {
  const hoy = hoyEC();
  const valido = (x?: string) => !!x && /^\d{4}-\d{2}-\d{2}$/.test(x);
  switch (periodo) {
    case 'hoy': return { periodo: 'hoy', desde: hoy, hasta: hoy };
    case 'semana': {
      const dow = (aFecha(hoy).getUTCDay() + 6) % 7; // lunes = 0
      return { periodo: 'semana', desde: sumarDias(hoy, -dow), hasta: hoy };
    }
    case 'anio': return { periodo: 'anio', desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
    case 'personalizado':
      if (valido(desde) && valido(hasta) && desde! <= hasta!) return { periodo: 'personalizado', desde: desde!, hasta: hasta! };
      return { periodo: 'mes', desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
    default: return { periodo: 'mes', desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  }
}

export function granularidad(desde: string, hasta: string): 'day' | 'week' | 'month' {
  const dias = (aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86400000;
  return dias <= 31 ? 'day' : dias <= 120 ? 'week' : 'month';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function fechaCorta(s: string | null | undefined): string {
  if (!s) return '—';
  const d = aFecha(s.slice(0, 10));
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
export function fechaLarga(s: string | null | undefined): string {
  if (!s) return '—';
  const d = aFecha(s.slice(0, 10));
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function etiquetaPeriodo(s: string, g: 'day' | 'week' | 'month'): string {
  const d = aFecha(s);
  if (g === 'month') return `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
export const diasHasta = (s: string) => Math.round((aFecha(s).getTime() - aFecha(hoyEC()).getTime()) / 86400000);
