import Link from 'next/link';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaLarga, hoyEC } from '@/lib/fechas';
import { Encabezado, Insignia, Vacio } from '@/components/ui';
import { FormPagoGasto } from './form';

export const metadata = { title: 'Cuentas por pagar' };

export default async function PorPagar() {
  await exigirRol(['administrador', 'contabilidad']);
  const supabase = await supabaseServer();
  const [{ data: gastos }, { data: cuentas }] = await Promise.all([
    supabase.from('v_gastos').select('*').in('estado_pago', ['por_pagar', 'vencido']).order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
    supabase.from('v_cuentas_saldo').select('id, nombre, saldo').eq('activa', true).order('orden'),
  ]);
  const total = (gastos ?? []).reduce((s, g) => s + Number(g.saldo_pendiente), 0);
  return (
    <>
      <Encabezado titulo="Cuentas por pagar" subtitulo={`Total pendiente: ${dinero(total)}`} />
      {!gastos?.length ? <Vacio>No hay cuentas por pagar. 🎉</Vacio> : (
        <div className="space-y-3">
          {gastos.map((g) => (
            <div key={g.id} className={`tarjeta p-4 ${g.estado_pago === 'vencido' ? 'border-red-300' : ''}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Link href={`/finanzas/gastos/${g.id}`} className="font-bold hover:text-oro-700">{g.descripcion || g.categoria_nombre}</Link>
                <span className="text-sm text-tinta-3">{g.proveedor_nombre ?? ''} · {g.categoria_nombre}</span>
                {g.estado_pago === 'vencido' ? <Insignia className="bg-red-600 text-white">Vencido {fechaLarga(g.fecha_vencimiento)}</Insignia> : g.fecha_vencimiento && <Insignia>Vence {fechaLarga(g.fecha_vencimiento)}</Insignia>}
                <span className="cifra ml-auto text-lg font-bold">{dinero(g.saldo_pendiente)}</span>
              </div>
              <FormPagoGasto gastoId={g.id} saldo={Number(g.saldo_pendiente)} cuentas={cuentas ?? []} hoy={hoyEC()} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
