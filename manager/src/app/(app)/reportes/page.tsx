import Link from 'next/link';
import { Download } from 'lucide-react';
import { exigirRol } from '@/lib/auth';
import { obtenerReporte, REPORTES } from '@/lib/reportes';
import { rango, fechaLarga } from '@/lib/fechas';
import { dinero } from '@/lib/money';
import { Encabezado, Tabla, td, th, Vacio, cx } from '@/components/ui';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { BotonImprimir } from '@/components/boton-imprimir';

export const metadata = { title: 'Reportes' };

export default async function Reportes({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const sp = await searchParams;
  const tipo = sp.r && sp.r in REPORTES ? sp.r : 'resultados';
  const { periodo, desde, hasta } = rango(sp.periodo, sp.desde, sp.hasta);
  const rep = (await obtenerReporte(tipo, desde, hasta))!;
  const qs = `r=${tipo}&periodo=${periodo}&desde=${desde}&hasta=${hasta}`;
  const fmt = (v: unknown, t?: string) => v === null || v === undefined || v === '' ? '—' : t === 'dinero' ? dinero(Number(v)) : t === 'fecha' ? fechaLarga(String(v)) : String(v);

  return (
    <>
      <Encabezado titulo="Reportes" acciones={<><a href={`/reportes/exportar?${qs}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e3d8c7] bg-white px-4 font-semibold hover:border-oro-500"><Download className="size-4" />Excel</a><BotonImprimir texto="PDF / imprimir" /></>} />
      <nav className="no-imprimir -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {Object.entries(REPORTES).map(([k, t]) => (
          <Link key={k} href={`/reportes?r=${k}&periodo=${periodo}&desde=${desde}&hasta=${hasta}`} className={cx('whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold', k === tipo ? 'bg-tinta text-crema' : 'bg-white ring-1 ring-[#efe6d8]')}>{t}</Link>
        ))}
      </nav>
      {rep.usaFechas && <SelectorPeriodo ruta="/reportes" periodo={periodo} desde={desde} hasta={hasta} extra={{ r: tipo }} />}
      <section className="tarjeta p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="titulo-marca text-xl font-bold">{rep.titulo}</h2>
          <p className="text-xs text-tinta-3">{rep.usaFechas ? `Del ${fechaLarga(desde)} al ${fechaLarga(hasta)}. ` : ''}{rep.descripcion}</p>
        </div>
        {!rep.filas.length ? <Vacio>Sin datos para este reporte.</Vacio> : (
          <Tabla>
            <thead><tr>{rep.columnas.map((c) => <th key={c.k} className={cx(th, ['dinero', 'numero'].includes(c.tipo ?? '') && 'text-right')}>{c.t}</th>)}</tr></thead>
            <tbody>{rep.filas.map((f, i) => {
              const fuerte = tipo === 'resultados' && !String(f.concepto).startsWith(' ');
              return (
                <tr key={i} className={cx(fuerte && 'bg-crema font-bold')}>
                  {rep.columnas.map((c) => <td key={c.k} className={cx(td, ['dinero', 'numero'].includes(c.tipo ?? '') && 'cifra text-right', c.tipo === 'dinero' && Number(f[c.k]) < 0 && 'text-red-700', tipo === 'resultados' && c.k === 'concepto' && !fuerte && 'pl-8')}>{fmt(f[c.k], c.tipo)}</td>)}
                </tr>
              );
            })}</tbody>
            {rep.totales && <tfoot><tr className="font-bold">{rep.columnas.map((c, i) => <td key={c.k} className={cx(td, 'border-t-2 border-tinta/20', c.tipo && 'cifra text-right')}>{i === 0 ? 'Total' : c.k in rep.totales! ? (c.tipo === 'dinero' ? dinero(rep.totales![c.k]) : rep.totales![c.k]) : ''}</td>)}</tr></tfoot>}
          </Tabla>
        )}
      </section>
    </>
  );
}
