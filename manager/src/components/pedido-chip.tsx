import { COLOR_ESTADO, ESTADOS, type Estado } from '@/lib/dominio';
import { Insignia } from './ui';
import { diasHasta } from '@/lib/fechas';

export const EstadoInsignia = ({ estado }: { estado: Estado }) => <Insignia className={COLOR_ESTADO[estado]}>{ESTADOS[estado]}</Insignia>;

export function Vence({ fecha, activo }: { fecha: string | null; activo: boolean }) {
  if (!fecha || !activo) return null;
  const d = diasHasta(fecha);
  if (d < 0) return <Insignia className="bg-red-600 text-white">Atrasado {-d} d</Insignia>;
  if (d === 0) return <Insignia className="bg-amber-500 text-white">Hoy</Insignia>;
  if (d === 1) return <Insignia className="bg-amber-100 text-amber-900">Mañana</Insignia>;
  if (d <= 3) return <Insignia className="bg-oro-100 text-oro-900">En {d} días</Insignia>;
  return null;
}
