'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { perfilActual } from '@/lib/auth';
import { mensajeError, texto, type Resultado } from '@/lib/acciones';
import { parseMonto } from '@/lib/money';
import { validarRuc } from '@/lib/validaciones';

async function soloAdmin() {
  const p = await perfilActual();
  if (p?.rol !== 'administrador' || !p.activo) throw new Error('Solo un administrador puede hacer esto.');
  return p;
}

export async function guardarConfiguracion(_: Resultado | null, f: FormData): Promise<Resultado> {
  try { await soloAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const ruc = texto(f, 'ruc');
  if (ruc && !validarRuc(ruc)) return { ok: false, error: 'El RUC no es válido.' };
  const num = (k: string) => parseMonto(texto(f, k));
  const datos = {
    nombre_comercial: texto(f, 'nombre_comercial'), razon_social: texto(f, 'razon_social'), ruc, regimen: texto(f, 'regimen'),
    direccion: texto(f, 'direccion'), ciudad: texto(f, 'ciudad'), provincia: texto(f, 'provincia'), whatsapp: texto(f, 'whatsapp'), instagram: texto(f, 'instagram'),
    iva_activo: f.get('iva_activo') === 'on', iva_tarifa: num('iva_tarifa') ?? 15, precios_incluyen_iva: texto(f, 'precios_incluyen_iva') === 'si',
    config_tributaria_confirmada: f.get('config_tributaria_confirmada') === 'on',
    anticipo_porcentaje: num('anticipo_porcentaje') ?? 50, envio_referencial: num('envio_referencial') ?? 7, dias_fabricacion: Number(texto(f, 'dias_fabricacion')) || 5,
    exigir_2fa_admin: f.get('exigir_2fa_admin') === 'on',
  };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('configuracion').update(datos).eq('id', 1);
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/', 'layout');
  return { ok: true, mensaje: 'Configuración guardada. Los cambios de IVA aplican a los pedidos nuevos.' };
}

const invitacion = z.object({ email: z.email('Correo no válido'), nombre: z.string().min(2, 'Escribe el nombre'), rol: z.enum(['administrador', 'contabilidad', 'produccion', 'pintura']) });

export async function invitarUsuario(_: Resultado | null, f: FormData): Promise<Resultado> {
  let admin;
  try { admin = await soloAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const p = invitacion.safeParse({ email: texto(f, 'email').toLowerCase(), nombre: texto(f, 'nombre'), rol: texto(f, 'rol') });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await supabaseServer();
  // Si la persona ya entró antes (por ejemplo con Google), se le asigna el rol directamente
  const { data: existente } = await supabase.from('perfiles').select('id').eq('email', p.data.email).maybeSingle();
  if (existente) {
    const { error } = await supabase.from('perfiles').update({ rol: p.data.rol, activo: true, nombre: p.data.nombre }).eq('id', existente.id);
    if (error) return { ok: false, error: mensajeError(error) };
    revalidatePath('/configuracion/usuarios');
    return { ok: true, mensaje: `${p.data.nombre} ya tenía cuenta: se le asignó el rol y ya puede entrar.` };
  }
  const { error } = await supabase.from('invitaciones').upsert({ ...p.data, invitado_por: admin.id, usada_at: null });
  if (error) return { ok: false, error: mensajeError(error) };
  let correo = '';
  try {
    const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    const r = await supabaseAdmin().auth.admin.inviteUserByEmail(p.data.email, { redirectTo: `${sitio}/auth/callback?next=/configuracion/cuenta`, data: { name: p.data.nombre } });
    correo = r.error ? ` (no se pudo enviar el correo: ${r.error.message}; puede entrar con Google usando ese correo)` : ' Le llegará un correo para crear su contraseña.';
  } catch {
    correo = ' Puede entrar con “Continuar con Google” usando ese correo.';
  }
  revalidatePath('/configuracion/usuarios');
  return { ok: true, mensaje: `Invitación creada para ${p.data.email}.${correo}` };
}

export async function cambiarUsuario(id: string, cambios: { rol?: string; activo?: boolean }): Promise<Resultado> {
  try { await soloAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = await supabaseServer();
  const { error } = await supabase.from('perfiles').update(cambios).eq('id', id);
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}

export async function cancelarInvitacion(email: string): Promise<Resultado> {
  try { await soloAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = await supabaseServer();
  const { error } = await supabase.from('invitaciones').delete().eq('email', email);
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/configuracion/usuarios');
  return { ok: true };
}

export async function guardarCategoria(_: Resultado | null, f: FormData): Promise<Resultado> {
  try { await soloAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = await supabaseServer();
  const nombre = texto(f, 'nombre');
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la categoría.' };
  const { error } = await supabase.from('categorias_gasto').insert({ nombre, clasificacion: texto(f, 'clasificacion'), orden: 90 });
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/configuracion/categorias');
  return { ok: true, mensaje: 'Categoría creada.' };
}

export async function actualizarCategoria(id: string, cambios: { clasificacion?: string; activa?: boolean }): Promise<Resultado> {
  try { await soloAdmin(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const supabase = await supabaseServer();
  const { error } = await supabase.from('categorias_gasto').update(cambios).eq('id', id);
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/configuracion/categorias');
  return { ok: true };
}

export async function cambiarNombre(_: Resultado | null, f: FormData): Promise<Resultado> {
  const p = await perfilActual();
  if (!p) return { ok: false, error: 'Sesión vencida.' };
  const nombre = texto(f, 'nombre');
  if (nombre.length < 2) return { ok: false, error: 'Escribe tu nombre.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('perfiles').update({ nombre }).eq('id', p.id);
  if (error) return { ok: false, error: mensajeError(error) };
  revalidatePath('/', 'layout');
  return { ok: true, mensaje: 'Nombre actualizado.' };
}

export async function cambiarClave(_: Resultado | null, f: FormData): Promise<Resultado> {
  const clave = String(f.get('clave') ?? '');
  if (clave.length < 10) return { ok: false, error: 'Usa al menos 10 caracteres.' };
  if (clave !== String(f.get('repetir') ?? '')) return { ok: false, error: 'Las contraseñas no coinciden.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) return { ok: false, error: error.message.includes('different') ? 'La nueva contraseña debe ser distinta de la anterior.' : 'No se pudo cambiar la contraseña. Si activaste la verificación en dos pasos, vuelve a iniciar sesión.' };
  return { ok: true, mensaje: 'Contraseña actualizada.' };
}
