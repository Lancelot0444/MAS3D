import { notFound } from 'next/navigation';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaLarga, hoyEC } from '@/lib/fechas';
import { CLASIFICACIONES } from '@/lib/dominio';
import { Encabezado, Tarjeta } from '@/components/ui';
import { Adjuntos } from '@/components/adjuntos';
import { BotonAnular } from '../../../pedidos/[id]/controles';
import { FormPagoGasto } from '../../por-pagar/form';

export const metadata = { title: 'Gasto' };

export default async function DetalleGasto({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirRol(['administrador', 'contabilidad']);
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: g }, { data: cuentas }] = await Promise.all([
    supabase.from('v_gastos').select('*').eq('id', id).maybeSingle(),
    supabase.from('v_cuentas_saldo').select('id, nombre, saldo').eq('activa', true).order('orden'),
  ]);
  if (!g) notFound();
  return (
    <>
      <Encabezado titulo={g.descripcion || g.categoria_nombre} subtitulo={`${g.categoria_nombre} · ${CLASIFICACIONES[g.clasificacion as keyof typeof CLASIFICACIONES]} · ${fechaLarga(g.fecha)}`}
        acciones={perfil.rol === 'administrador' && !g.anulado && g.transaccion_id ? <BotonAnular id={g.transaccion_id} /> : undefined} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Detalle">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-tinta-3">Monto</dt><dd className="cifra font-bold">{dinero(g.monto)}</dd>
            <dt className="text-tinta-3">Pendiente</dt><dd className="cifra">{dinero(g.saldo_pendiente)}</dd>
            <dt className="text-tinta-3">Proveedor</dt><dd>{g.proveedor_nombre ?? '—'}</dd>
            <dt className="text-tinta-3">Comprobante</dt><dd>{g.numero_comprobante ?? '—'}</dd>
            <dt className="text-tinta-3">Vence</dt><dd>{fechaLarga(g.fecha_vencimiento)}</dd>
            <dt className="text-tinta-3">Pedido</dt><dd>{g.pedido_codigo ?? '—'}</dd>
            <dt className="text-tinta-3">Registró</dt><dd>{g.responsable_nombre ?? '—'}</dd>
            <dt className="text-tinta-3">Estado</dt><dd>{g.anulado ? 'Anulado' : g.estado_pago}</dd>
          </dl>
          {Number(g.saldo_pendiente) > 0 && !g.anulado && (
            <div className="mt-4 border-t border-[#f4ede2] pt-4"><h3 className="mb-2 text-sm font-bold">Registrar pago</h3>
              <FormPagoGasto gastoId={g.id} saldo={Number(g.saldo_pendiente)} cuentas={cuentas ?? []} hoy={hoyEC()} /></div>
          )}
        </Tarjeta>
        <Adjuntos entidad="gasto" id={g.id} ruta={`/finanzas/gastos/${g.id}`} titulo="Factura o recibo" />
      </div>
    </>
  );
}
