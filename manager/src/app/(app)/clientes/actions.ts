'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { mensajeError, texto, type Resultado } from '@/lib/acciones';
import { validarCedula, validarRuc } from '@/lib/validaciones';

const esquema = z.object({
  nombre: z.string().min(2, 'Escribe el nombre completo'),
  telefono: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.union([z.literal(''), z.email('Correo no válido')]),
  tipo_identificacion: z.enum(['cedula', 'ruc', 'pasaporte', 'consumidor_final', 'ninguna']),
  identificacion: z.string().optional(),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  provincia: z.string().optional(),
  canal: z.string().optional(),
  tipo: z.enum(['persona', 'corporativo']),
  observaciones: z.string().optional(),
}).superRefine((d, ctx) => {
  const id = (d.identificacion ?? '').replace(/\s/g, '');
  if (d.tipo_identificacion === 'cedula' && !validarCedula(id)) ctx.addIssue({ code: 'custom', path: ['identificacion'], message: 'Cédula no válida' });
  if (d.tipo_identificacion === 'ruc' && !validarRuc(id)) ctx.addIssue({ code: 'custom', path: ['identificacion'], message: 'RUC no válido' });
  if (d.tipo_identificacion === 'pasaporte' && id.length < 5) ctx.addIssue({ code: 'custom', path: ['identificacion'], message: 'Pasaporte no válido' });
});

export type EstadoCliente = { error?: string; campos?: Record<string, string>; similares?: { id: string; codigo: string; nombre: string; motivo: string }[] };

export async function guardarCliente(_: EstadoCliente, f: FormData): Promise<EstadoCliente> {
  const id = texto(f, 'id') || null;
  const datos = Object.fromEntries(['nombre', 'telefono', 'whatsapp', 'email', 'tipo_identificacion', 'identificacion', 'direccion', 'ciudad', 'provincia', 'canal', 'tipo', 'observaciones'].map((k) => [k, texto(f, k)]));
  const p = esquema.safeParse(datos);
  if (!p.success) {
    return { error: 'Revisa los datos marcados.', campos: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const supabase = await supabaseServer();
  // Aviso de posibles duplicados (solo al crear y si no se confirmó)
  if (!id && texto(f, 'confirmar_duplicado') !== '1') {
    const { data: sim } = await supabase.rpc('clientes_similares', {
      p_nombre: p.data.nombre, p_whatsapp: p.data.whatsapp || p.data.telefono || null, p_identificacion: p.data.identificacion || null,
    });
    if (sim && sim.length) return { similares: sim };
  }
  const fila = Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, v === '' ? null : v]));
  const q = id ? supabase.from('clientes').update(fila).eq('id', id).select('id').single() : supabase.from('clientes').insert(fila).select('id').single();
  const { data, error } = await q;
  if (error) return { error: mensajeError(error) };
  revalidatePath('/clientes');
  const volver = texto(f, 'volver');
  if (volver === 'pedido') redirect(`/pedidos/nuevo?cliente=${data.id}`);
  redirect(`/clientes/${data.id}`);
}

export async function cambiarActivoCliente(id: string, activo: boolean): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from('clientes').update({ activo }).eq('id', id);
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}
