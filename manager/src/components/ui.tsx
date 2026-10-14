import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');
export { cx };

type Variante = 'primario' | 'oscuro' | 'borde' | 'fantasma' | 'peligro';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-gradient-to-b from-oro-400 to-oro-600 text-white shadow-sm hover:from-oro-500 hover:to-oro-700',
  oscuro: 'bg-tinta text-crema hover:bg-tinta-2',
  borde: 'border border-[#e3d8c7] bg-white text-tinta hover:border-oro-500 hover:bg-oro-50',
  fantasma: 'text-tinta-2 hover:bg-crema-2',
  peligro: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
};
const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-semibold transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-oro-300';

export function Boton({ variante = 'primario', chico, className, ...p }: ComponentProps<'button'> & { variante?: Variante; chico?: boolean }) {
  return <button {...p} className={cx(base, VARIANTES[variante], chico && 'min-h-9 px-3 text-sm', className)} />;
}
export function BotonLink({ variante = 'primario', chico, className, ...p }: ComponentProps<typeof Link> & { variante?: Variante; chico?: boolean }) {
  return <Link {...p} className={cx(base, VARIANTES[variante], chico && 'min-h-9 px-3 text-sm', className)} />;
}

export function Tarjeta({ className, titulo, accion, children }: { className?: string; titulo?: ReactNode; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className={cx('tarjeta p-4 sm:p-5', className)}>
      {(titulo || accion) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-[15px] font-bold text-tinta">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Encabezado({ titulo, subtitulo, acciones }: { titulo: ReactNode; subtitulo?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="titulo-marca text-2xl font-bold text-tinta sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-tinta-3">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function Insignia({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', className ?? 'bg-crema-2 text-tinta-2')}>{children}</span>;
}

export function Campo({ etiqueta, ayuda, error, children, className }: { etiqueta: string; ayuda?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="etiqueta">{etiqueta}</span>
      {children}
      {ayuda && !error && <span className="mt-1 block text-xs text-tinta-3">{ayuda}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}

export function Indicador({ etiqueta, valor, detalle, tono = 'normal', href }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: 'normal' | 'bien' | 'mal' | 'oro' | 'alerta'; href?: string }) {
  const color = { normal: 'text-tinta', bien: 'text-emerald-700', mal: 'text-red-700', oro: 'text-oro-700', alerta: 'text-amber-700' }[tono];
  const cuerpo = (
    <>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-tinta-3">{etiqueta}</span>
      <span className={cx('cifra mt-1 block text-[22px] font-bold leading-tight', color)}>{valor}</span>
      {detalle && <span className="mt-0.5 block text-xs text-tinta-3">{detalle}</span>}
    </>
  );
  return href ? <Link href={href} className="tarjeta block p-4 transition hover:border-oro-300">{cuerpo}</Link> : <div className="tarjeta p-4">{cuerpo}</div>;
}

export function Vacio({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e3d8c7] bg-white/60 p-8 text-center text-sm text-tinta-3">
      <p>{children}</p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'error' | 'ok' | 'alerta'; children: ReactNode }) {
  const t = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    alerta: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tipo];
  return <div role={tipo === 'error' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm', t)}>{children}</div>;
}

export function Tabla({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[640px] text-sm">{children}</table></div>;
}
export const th = 'border-b border-[#efe6d8] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-tinta-3';
export const td = 'border-b border-[#f4ede2] px-3 py-3 align-middle';
