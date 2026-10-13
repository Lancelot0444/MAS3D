'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

export function PestanasConfig({ admin }: { admin: boolean }) {
  const r = usePathname();
  const P = admin
    ? [['/configuracion', 'Negocio'], ['/configuracion/usuarios', 'Usuarios'], ['/configuracion/categorias', 'Categorías de gasto'], ['/configuracion/auditoria', 'Auditoría'], ['/configuracion/cuenta', 'Mi cuenta']]
    : [['/configuracion/cuenta', 'Mi cuenta']];
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {P.map(([h, t]) => <Link key={h} href={h} className={cx('whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold', r === h ? 'bg-tinta text-crema' : 'bg-white ring-1 ring-[#efe6d8]')}>{t}</Link>)}
    </nav>
  );
}
