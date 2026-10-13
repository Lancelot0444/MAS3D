import { notFound } from 'next/navigation';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaLarga, hoyEC } from '@/lib/fechas';
import { TIPOS_TX } from '@/lib/dominio';
import { BotonImprimir } from '@/components/boton-imprimir';

export const metadata = { title: 'Recibo' };

export default async function Recibo({ params }: { params: Promise<{ id: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: p }, { data: items }, { data: movs }, { data: cfg }] = await Promise.all([
    supabase.from('v_pedidos').select('*').eq('id', id).maybeSingle(),
    supabase.from('pedido_items').select('*').eq('pedido_id', id).order('linea'),
    supabase.from('v_movimientos').select('*').eq('pedido_id', id).eq('anulada', false).in('tipo', ['cobro', 'devolucion_cliente']).order('fecha'),
    supabase.from('configuracion').select('*').single(),
  ]);
  if (!p || !cfg) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-imprimir mb-4 flex justify-end"><BotonImprimir /></div>
      <article className="tarjeta p-8 print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-[#efe6d8] pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark.jpg" alt="MAS3D Figuras personalizadas" width={220} className="mix-blend-multiply" />
          <div className="text-right text-xs text-tinta-3">
            <div>{cfg.direccion}</div><div>{cfg.ciudad}, {cfg.provincia}</div><div>WhatsApp {cfg.whatsapp} · {cfg.instagram}</div>
            {cfg.ruc && <div>RUC {cfg.ruc}</div>}
          </div>
        </header>
        <div className="my-5 flex justify-between text-sm">
          <div><div className="text-xs uppercase tracking-wider text-tinta-3">Cliente</div><div className="font-semibold">{p.cliente_nombre}</div></div>
          <div className="text-right"><div className="text-xs uppercase tracking-wider text-tinta-3">Pedido</div><div className="font-semibold">{p.codigo}</div><div className="text-xs">Emitido {fechaLarga(hoyEC())}</div></div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#efe6d8] text-left text-xs uppercase text-tinta-3"><th className="py-2">Descripción</th><th>Cant.</th><th className="text-right">P. unit.</th><th className="text-right">Total</th></tr></thead>
          <tbody>{(items ?? []).map((i) => (
            <tr key={i.id} className="border-b border-[#f4ede2]"><td className="py-2">{i.descripcion}{Number(i.descuento) > 0 && <span className="text-xs text-tinta-3"> (desc. {dinero(i.descuento)})</span>}</td><td>{Number(i.cantidad)}</td><td className="cifra text-right">{dinero(i.precio_unitario)}</td><td className="cifra text-right">{dinero(i.total)}</td></tr>
          ))}</tbody>
        </table>
        <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
          {Number(p.total_iva) > 0 && <div className="flex justify-between"><span>IVA incluido</span><span className="cifra">{dinero(p.total_iva)}</span></div>}
          <div className="flex justify-between text-base font-bold"><span>Total</span><span className="cifra">{dinero(p.total)}</span></div>
          {(movs ?? []).map((m) => (
            <div key={m.transaccion_id} className="flex justify-between text-tinta-3"><span>{TIPOS_TX[m.tipo]} {m.subtipo ?? ''} {fechaLarga(m.fecha)}</span><span className="cifra">{m.tipo === 'cobro' ? '−' : '+'}{dinero(Number(m.entrada) || Number(m.salida))}</span></div>
          ))}
          <div className="flex justify-between border-t border-[#efe6d8] pt-1 text-base font-bold"><span>Saldo pendiente</span><span className="cifra">{dinero(p.saldo_pendiente)}</span></div>
        </div>
        <p className="mt-6 text-center text-xs text-tinta-3">Entrega estimada: {fechaLarga(p.fecha_entrega_prometida)}</p>
        <p className="mt-4 rounded-lg bg-crema p-2 text-center text-[11px] text-tinta-3">Comprobante interno de pedido y pagos. <b>No es una factura</b> ni un comprobante de venta autorizado por el SRI.</p>
      </article>
    </div>
  );
}
