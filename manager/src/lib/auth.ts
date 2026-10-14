import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';

export type Rol = 'administrador' | 'contabilidad' | 'produccion' | 'pintura';
export type Perfil = { id: string; email: string; nombre: string; rol: Rol | null; activo: boolean };

export const ROLES: Record<Rol, string> = {
  administrador: 'Administrador',
  contabilidad: 'Contabilidad',
  produccion: 'Producción',
  pintura: 'Pintura',
};

export const esFinanzas = (r: Rol | null | undefined) => r === 'administrador' || r === 'contabilidad';

/** Perfil del usuario actual (cacheado por petición). */
export const perfilActual = cache(async (): Promise<Perfil | null> => {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('perfiles').select('id, email, nombre, rol, activo').eq('id', user.id).maybeSingle();
  return (data as Perfil) ?? null;
});

/** Exige sesión activa con uno de los roles indicados; si no, redirige. */
export async function exigirRol(roles?: Rol[]): Promise<Perfil> {
  const p = await perfilActual();
  if (!p) redirect('/login');
  // Si tiene verificación en dos pasos y no la completó en esta sesión, se le pide el código
  const supabase = await supabaseServer();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') redirect('/login?paso=2fa');
  if (!p.activo || !p.rol) redirect('/sin-acceso');
  if (roles && !roles.includes(p.rol)) redirect('/?aviso=sin-permiso');
  return p;
}
