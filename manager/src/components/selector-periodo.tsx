import Link from 'next/link';
import { PERIODOS, type Periodo } from '@/lib/fechas';
import { cx } from './ui';

export function SelectorPeriodo({ ruta, periodo, desde, hasta, extra = {} }: { ruta: string; periodo: Periodo; desde: string; hasta: string; extra?: Record<string, string> }) {
  const mas = Object.entries(extra).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
  return (
    <div className="no-imprimir mb-5 flex flex-wrap items-center gap-2">
      {(Object.keys(PERIODOS) as Periodo[]).filter((p) => p !== 'personalizado').map((p) => (
        <Link key={p} href={`${ruta}?periodo=${p}${mas}`} className={cx('rounded-full border px-3.5 py-1.5 text-sm font-semibold',
          periodo === p ? 'border-tinta bg-tinta text-crema' : 'border-[#e3d8c7] bg-white text-tinta-2 hover:border-oro-500')}>
          {PERIODOS[p]}
        </Link>
      ))}
      <form action={ruta} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="periodo" value="personalizado" />
        {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="date" name="desde" defaultValue={desde} aria-label="Desde" className="campo !min-h-9 !w-auto !py-1 !text-sm" />
        <span className="text-sm text-tinta-3">a</span>
        <input type="date" name="hasta" defaultValue={hasta} aria-label="Hasta" className="campo !min-h-9 !w-auto !py-1 !text-sm" />
        <button className={cx('rounded-full border px-3.5 py-1.5 text-sm font-semibold',
          periodo === 'personalizado' ? 'border-tinta bg-tinta text-crema' : 'border-[#e3d8c7] bg-white hover:border-oro-500')}>Ver</button>
      </form>
    </div>
  );
}
