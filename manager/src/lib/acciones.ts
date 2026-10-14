import 'server-only';
import type { PostgrestError } from '@supabase/supabase-js';

export type Resultado<T = unknown> = { ok: true; datos?: T; mensaje?: string } | { ok: false; error: string };

const RESTRICCIONES: Record<string, string> = {
  uq_clientes_whatsapp: 'Ya existe un cliente con ese WhatsApp.',
  uq_clientes_identificacion: 'Ya existe un cliente con esa cédula/RUC.',
  chk_cliente_identificacion: 'La cédula o el RUC no es válido.',
  chk_cliente_email: 'El correo electrónico no es válido.',
  uq_proveedores_nombre: 'Ya existe un proveedor con ese nombre.',
  categorias_gasto_nombre_key: 'Ya existe una categoría con ese nombre.',
};

/** Convierte errores de la base de datos en mensajes claros para el usuario. */
export function mensajeError(e: PostgrestError | Error | null | undefined): string {
  if (!e) return 'Ocurrió un error inesperado.';
  const msg = e.message ?? '';
  for (const [k, v] of Object.entries(RESTRICCIONES)) if (msg.includes(k)) return v;
  if ('code' in e && e.code === '42501') return 'No tienes permiso para esta operación.';
  if (msg.includes('row-level security')) return 'No tienes permiso para esta operación.';
  if ('code' in e && e.code === 'P0001') return msg; // mensajes propios de las funciones (ya están en español)
  if (msg.includes('fetch failed')) return 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  return msg || 'Ocurrió un error inesperado.';
}

export const texto = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
export const opcional = (f: FormData, k: string) => texto(f, k) || null;
