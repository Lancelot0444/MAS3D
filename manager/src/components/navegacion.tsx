'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, Home, LogOut, Menu, Package, Search, Settings, Users, Wallet, X } from 'lucide-react';
import { cerrarSesion } from '@/app/login/actions';
import { cx } from './ui';

type Item = { href: string; texto: string; icono: typeof Home; finanzas?: boolean; admin?: boolean };
const ITEMS: Item[] = [
  { href: '/', texto: 'Inicio', icono: Home },
  { href: '/pedidos', texto: 'Pedidos', icono: Package },
  { href: '/clientes', texto: 'Clientes', icono: Users, finanzas: true },
  { href: '/finanzas', texto: 'Finanzas', icono: Wallet, finanzas: true },
  { href: '/reportes', texto: 'Reportes', icono: BarChart3, finanzas: true },
  { href: '/configuracion', texto: 'Configuración', icono: Settings },
];

export function Navegacion({ nombre, rol, finanzas, admin }: { nombre: string; rol: string; finanzas: boolean; admin: boolean }) {
  const ruta = usePathname();
  const router = useRouter();
  const [mas, setMas] = useState(false);
  const items = ITEMS.filter((i) => (!i.finanzas || finanzas) && (!i.admin || admin));
  const activo = (href: string) => (href === '/' ? ruta === '/' : ruta.startsWith(href));
  const barra = items.slice(0, 4);
  const resto = items.slice(4);

  const buscar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q');
    if (typeof q === 'string' && q.trim()) router.push(`/buscar?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      {/* Escritorio / iPad horizontal */}
      <aside className="no-imprimir fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#efe6d8] bg-crema/60 backdrop-blur lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 pb-4 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" width={44} height={44} className="rounded-2xl" />
          <span className="titulo-marca text-2xl font-bold leading-none">Más<span className="dorado">3D</span></span>
        </Link>
        {finanzas && (
          <form onSubmit={buscar} className="px-4 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-3" />
              <input name="q" placeholder="Buscar pedido o cliente" className="campo !min-h-10 pl-9 !text-sm" aria-label="Búsqueda global" />
            </div>
          </form>
        )}
        <nav className="flex-1 space-y-1 px-3">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className={cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition',
              activo(i.href) ? 'bg-tinta text-crema' : 'text-tinta-2 hover:bg-crema-2')}>
              <i.icono className={cx('size-5', activo(i.href) ? 'text-oro-300' : 'text-oro-600')} />{i.texto}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[#efe6d8] p-4">
          <Link href="/configuracion/cuenta" className="block rounded-xl px-2 py-1 hover:bg-crema-2">
            <span className="block truncate text-sm font-bold">{nombre}</span>
            <span className="block text-xs text-tinta-3">{rol}</span>
          </Link>
          <form action={cerrarSesion}>
            <button className="mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-tinta-3 hover:bg-crema-2"><LogOut className="size-4" />Cerrar sesión</button>
          </form>
        </div>
      </aside>

      {/* iPhone / iPad vertical */}
      <header className="no-imprimir sticky top-0 z-30 flex items-center gap-3 border-b border-[#efe6d8] bg-crema/90 px-4 py-2.5 backdrop-blur lg:hidden" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" width={34} height={34} className="rounded-xl" />
          <span className="titulo-marca text-xl font-bold">Más<span className="dorado">3D</span></span>
        </Link>
        {finanzas && (
          <form onSubmit={buscar} className="ml-auto max-w-xs flex-1">
            <input name="q" placeholder="Buscar…" className="campo !min-h-10 !py-1.5" aria-label="Búsqueda global" />
          </form>
        )}
      </header>
      <nav className="no-imprimir fixed inset-x-0 bottom-0 z-30 grid border-t border-[#efe6d8] bg-white/95 backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${barra.length + (resto.length ? 1 : 0)}, 1fr)`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {barra.map((i) => (
          <Link key={i.href} href={i.href} className={cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', activo(i.href) ? 'text-oro-700' : 'text-tinta-3')}>
            <i.icono className="size-6" />{i.texto}
          </Link>
        ))}
        {resto.length > 0 && (
          <button onClick={() => setMas(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-tinta-3">
            <Menu className="size-6" />Más
          </button>
        )}
      </nav>
      {mas && (
        <div className="fixed inset-0 z-40 bg-tinta/40 lg:hidden" onClick={() => setMas(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div><b>{nombre}</b><span className="ml-2 text-sm text-tinta-3">{rol}</span></div>
              <button onClick={() => setMas(false)} aria-label="Cerrar" className="rounded-full p-2 hover:bg-crema-2"><X className="size-5" /></button>
            </div>
            {[...resto, { href: '/configuracion/cuenta', texto: 'Mi cuenta', icono: Users } as Item].map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setMas(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold hover:bg-crema-2">
                <i.icono className="size-5 text-oro-600" />{i.texto}
              </Link>
            ))}
            <form action={cerrarSesion}><button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 font-semibold text-tinta-3 hover:bg-crema-2"><LogOut className="size-5" />Cerrar sesión</button></form>
          </div>
        </div>
      )}
    </>
  );
}
