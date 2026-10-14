'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

const P = [
  ['/finanzas', 'Movimientos'], ['/finanzas/cuentas', 'Cuentas'], ['/finanzas/gastos', 'Gastos'],
  ['/finanzas/por-pagar', 'Por pagar'], ['/finanzas/gasto', '+ Gasto'], ['/finanzas/movimiento', '+ Otro movimiento'],
];
export function PestanasFinanzas() {
  const r = usePathname();
  return (
    <nav className="no-imprimir -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Secciones de finanzas">
      {P.map(([h, t]) => (
        <Link key={h} href={h} className={cx('whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold', r === h ? 'bg-tinta text-crema' : 'bg-white text-tinta-2 ring-1 ring-[#efe6d8] hover:ring-oro-400')}>{t}</Link>
      ))}
    </nav>
  );
}
