'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { mensajeError, opcional, texto, type Resultado } from '@/lib/acciones';
import { parseMonto } from '@/lib/money';

const item = z.object({
  id: z.string().optional(),
  es_envio: z.boolean().default(false),
  tipo_producto: z.string().default(''),
  descripcion: z.string().trim().min(1, 'Describe cada producto'),
  cantidad: z.coerce.number().positive('Cantidad inválida').max(100000),
  tamano: z.string().optional(),
  material: z.string().optional(),
  colores: z.string().optional(),
  precio_unitario: z.coerce.number().min(0, 'Precio inválido').max(1_000_000),
  descuento: z.coerce.number().min(0, 'Descuento inválido').default(0),
});
const pedido = z.object({
  id: z.string().optional(),
  idempotency_key: z.uuid(),
  cliente_id: z.uuid('Selecciona un cliente'),
  fecha_pedido: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_entrega_prometida: z.string().optional(),
  estado: z.enum(['cotizado', 'confirmado']).optional(),
  prioridad: z.enum(['baja', 'normal', 'alta', 'urgente']),
  responsable_id: z.string().optional(),
  canal: z.string().optional(),
  modalidad_entrega: z.enum(['retiro_local', 'entrega_personal', 'servientrega', 'transporte_interprovincial', 'otro_courier']),
  direccion_envio: z.string().optional(),
  transportista: z.string().optional(),
  numero_guia: z.string().optional(),
  requiere_boceto: z.boolean(),
  observaciones: z.string().optional(),
  items: z.array(item).min(1, 'Agrega al menos un producto'),
});
export type PedidoEntrada = z.input<typeof pedido>;

export async function guardarPedido(entrada: PedidoEntrada): Promise<Resultado<string>> {
  const p = pedido.safeParse(entrada);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Datos incompletos' };
  for (const it of p.data.items) {
    if (Math.round(it.precio_unitario * 100) !== it.precio_unitario * 100) return { ok: false, error: 'Los precios solo pueden tener 2 decimales' };
    if (it.descuento > it.cantidad * it.precio_unitario) return { ok: false, error: `El descuento de "${it.descripcion}" supera su valor` };
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('guardar_pedido', { p: p.data });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/pedidos');
  revalidatePath('/');
  return { ok: true, datos: data as string };
}

export async function cambiarEstado(id: string, estado: string, nota?: string): Promise<Resultado<{ aviso?: string }>> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('cambiar_estado_pedido', { p_pedido: id, p_estado: estado, p_nota: nota || null });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${id}`);
  revalidatePath('/');
  return { ok: true, datos: { aviso: (data as { aviso?: string })?.aviso ?? undefined } };
}

export async function cambiarEstadoItem(pedidoId: string, itemId: string, estado: string): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('cambiar_estado_item', { p_item: itemId, p_estado: estado });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath(`/pedidos/${pedidoId}`);
  return { ok: true };
}

export async function registrarCobro(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'monto'));
  if (!monto || monto <= 0) return { ok: false, error: 'Escribe un monto válido (máximo 2 decimales).' };
  const pedidoId = texto(f, 'pedido_id');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('registrar_cobro', {
    p_pedido: pedidoId, p_cuenta: texto(f, 'cuenta_id'), p_monto: monto, p_fecha: texto(f, 'fecha'),
    p_metodo: texto(f, 'metodo'), p_subtipo: texto(f, 'subtipo'), p_comprobante: opcional(f, 'comprobante'),
    p_nota: opcional(f, 'nota'), p_idem: texto(f, 'idem'),
  });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath('/');
  return { ok: true, mensaje: 'Cobro registrado.' };
}

export async function devolverDinero(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'monto'));
  if (!monto || monto <= 0) return { ok: false, error: 'Escribe un monto válido.' };
  const pedidoId = texto(f, 'pedido_id');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('registrar_devolucion_cliente', {
    p_pedido: pedidoId, p_cuenta: texto(f, 'cuenta_id'), p_monto: monto, p_fecha: texto(f, 'fecha'),
    p_metodo: texto(f, 'metodo'), p_motivo: texto(f, 'motivo'), p_idem: texto(f, 'idem'),
  });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath(`/pedidos/${pedidoId}`);
  return { ok: true, mensaje: 'Devolución registrada.' };
}

export async function retenerAnticipo(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'monto'));
  if (!monto || monto <= 0) return { ok: false, error: 'Escribe un monto válido.' };
  const pedidoId = texto(f, 'pedido_id');
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('retener_anticipo', { p_pedido: pedidoId, p_monto: monto, p_fecha: texto(f, 'fecha'), p_motivo: texto(f, 'motivo'), p_idem: texto(f, 'idem') });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath(`/pedidos/${pedidoId}`);
  return { ok: true, mensaje: 'Anticipo retenido como ingreso.' };
}
