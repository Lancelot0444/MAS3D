'use server';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { mensajeError, type Resultado } from '@/lib/acciones';

const ENTIDADES = ['cliente', 'pedido', 'gasto', 'transaccion'] as const;
type Entidad = (typeof ENTIDADES)[number];

/** Registra en la base un archivo ya subido al almacenamiento privado. */
export async function registrarAdjunto(a: { entidad: Entidad; entidad_id: string; ruta: string; nombre: string; tipo_mime: string; tamano_bytes: number; categoria?: string; ruta_pagina: string }): Promise<Resultado> {
  if (!ENTIDADES.includes(a.entidad) || !a.ruta.startsWith(`${a.entidad}/${a.entidad_id}/`)) return { ok: false, error: 'Ruta de archivo no válida' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('adjuntos').insert({
    entidad: a.entidad, entidad_id: a.entidad_id, ruta: a.ruta, nombre: a.nombre.slice(0, 200), tipo_mime: a.tipo_mime, tamano_bytes: a.tamano_bytes, categoria: a.categoria ?? null,
  });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath(a.ruta_pagina);
  return { ok: true };
}
