import Link from 'next/link';
import { Plus } from 'lucide-react';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaLarga, rango } from '@/lib/fechas';
import { CLASIFICACIONES } from '@/lib/dominio';
import { BotonLink, Encabezado, Indicador, Insignia, Tabla, td, th, Vacio, cx } from '@/components/ui';
import { SelectorPeriodo } from '@/components/selector-periodo';

export const metadata = { title: 'Gastos' };
const ESTADO = { pagado: 'bg-emerald-50 text-emerald-800', por_pagar: 'bg-amber-50 text-amber-800', vencido: 'bg-red-100 text-red-800', anulado: 'bg-stone-100 text-stone-500' } as Record<string, string>;
const ESTADO_T = { pagado: 'Pagado', por_pagar: 'Por pagar', vencido: 'Vencido', anulado: 'Anulado' } as Record<string, string>;

export default async function Gastos({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const sp = await searchParams;
  const { periodo, desde, hasta } = rango(sp.periodo, sp.desde, sp.hasta);
  const supabase = await supabaseServer();
  const { data: gastos } = await supabase.from('v_gastos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).limit(500);
  const validos = (gastos ?? []).filter((g) => !g.anulado);
  const suma = (f: (g: (typeof validos)[number]) => boolean) => validos.filter(f).reduce((s, g) => s + Number(g.monto), 0);
  return (
    <>
      <Encabezado titulo="Gastos" acciones={<BotonLink href="/finanzas/gasto"><Plus className="size-4" />Registrar gasto</BotonLink>} />
      <SelectorPeriodo ruta="/finanzas/gastos" periodo={periodo} desde={desde} hasta={hasta} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Costos directos" valor={dinero(suma((g) => g.clasificacion === 'costo_directo'))} />
        <Indicador etiqueta="Gastos operativos" valor={dinero(suma((g) => g.clasificacion === 'gasto_operativo'))} />
        <Indicador etiqueta="Inversiones" valor={dinero(suma((g) => g.clasificacion === 'inversion'))} detalle="No restan utilidad" />
        <Indicador etiqueta="Pendiente de pago" valor={dinero(validos.reduce((s, g) => s + Number(g.saldo_pendiente), 0))} tono="alerta" href="/finanzas/por-pagar" />
      </div>
      {!gastos?.length ? <Vacio accion={<BotonLink href="/finanzas/gasto">Registrar gasto</BotonLink>}>No hay gastos en este período.</Vacio> : (
        <div className="tarjeta p-2 sm:p-3">
          <Tabla>
            <thead><tr><th className={th}>Fecha</th><th className={th}>Categoría</th><th className={th}>Detalle</th><th className={th}>Estado</th><th className={`${th} text-right`}>Monto</th></tr></thead>
            <tbody>{gastos.map((g) => (
              <tr key={g.id} className={cx('hover:bg-oro-50/50', g.anulado && 'text-tinta-3 line-through')}>
                <td className={`${td} whitespace-nowrap`}>{fechaLarga(g.fecha)}</td>
                <td className={td}>{g.categoria_nombre}<div className="text-xs text-tinta-3">{CLASIFICACIONES[g.clasificacion as keyof typeof CLASIFICACIONES]}</div></td>
                <td className={td}><Link href={`/finanzas/gastos/${g.id}`} className="font-semibold hover:text-oro-700">{g.descripcion || 'Sin descripción'}</Link>
                  <div className="text-xs text-tinta-3">{[g.proveedor_nombre, g.numero_comprobante && `Comp. ${g.numero_comprobante}`, g.pedido_codigo, g.responsable_nombre].filter(Boolean).join(' · ')}</div></td>
                <td className={td}><Insignia className={ESTADO[g.estado_pago]}>{ESTADO_T[g.estado_pago]}</Insignia></td>
                <td className={`${td} cifra text-right font-semibold`}>{dinero(g.monto)}</td>
              </tr>
            ))}</tbody>
          </Tabla>
        </div>
      )}
    </>
  );
}
