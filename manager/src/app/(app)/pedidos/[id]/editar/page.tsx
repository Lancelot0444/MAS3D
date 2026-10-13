import { notFound } from 'next/navigation';
import { exigirRol } from '@/lib/auth';
import { hoyEC } from '@/lib/fechas';
import { supabaseServer } from '@/lib/supabase/server';
import { Encabezado } from '@/components/ui';
import { FormPedido, type PedidoExistente } from '../../form-pedido';
import { datosFormularioPedido } from '../../datos-form';

export const metadata = { title: 'Editar pedido' };

export default async function EditarPedido({ params }: { params: Promise<{ id: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: p }, { data: items }, d] = await Promise.all([
    supabase.from('pedidos').select('*').eq('id', id).maybeSingle(),
    supabase.from('pedido_items').select('*').eq('pedido_id', id).order('linea'),
    datosFormularioPedido(),
  ]);
  if (!p) notFound();
  const pedido: PedidoExistente = {
    ...p, venta_reconocida: !!p.venta_reconocida_at,
    items: (items ?? []).map((i) => ({ id: i.id, es_envio: i.es_envio, tipo_producto: i.tipo_producto, descripcion: i.descripcion, cantidad: Number(i.cantidad),
      tamano: i.tamano ?? '', material: i.material ?? '', colores: i.colores ?? '', precio_unitario: Number(i.precio_unitario), descuento: Number(i.descuento) })),
  };
  return (
    <div className="mx-auto max-w-5xl">
      <Encabezado titulo={`Editar ${p.codigo}`} />
      <FormPedido {...d} hoy={hoyEC()} pedido={pedido} />
    </div>
  );
}
