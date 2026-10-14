'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';

export type EstadoLogin = { paso: 'credenciales' | '2fa'; error?: string; factorId?: string };

const destinoSeguro = (n: FormDataEntryValue | null) => {
  const s = typeof n === 'string' ? n : '/';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
};

export async function iniciarSesion(_: EstadoLogin, f: FormData): Promise<EstadoLogin> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(f.get('email') ?? '').trim().toLowerCase(),
    password: String(f.get('password') ?? ''),
  });
  if (error) {
    return { paso: 'credenciales', error: error.message.includes('Invalid login') ? 'Correo o contraseña incorrectos.' : 'No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.' };
  }
  // ¿Tiene verificación en dos pasos activada?
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    const { data: factores } = await supabase.auth.mfa.listFactors();
    const totp = factores?.totp?.find((x) => x.status === 'verified');
    if (totp) return { paso: '2fa', factorId: totp.id };
  }
  redirect(destinoSeguro(f.get('next')));
}

export async function verificarCodigo2fa(_: EstadoLogin, f: FormData): Promise<EstadoLogin> {
  const supabase = await supabaseServer();
  const factorId = String(f.get('factorId') ?? '');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: String(f.get('codigo') ?? '').trim() });
  if (error) return { paso: '2fa', factorId, error: 'Código incorrecto o vencido.' };
  redirect(destinoSeguro(f.get('next')));
}

export async function iniciarConGoogle(f: FormData) {
  const supabase = await supabaseServer();
  const h = await headers();
  const origen = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origen}/auth/callback?next=${encodeURIComponent(destinoSeguro(f.get('next')))}` },
  });
  if (error || !data.url) redirect('/login?error=auth');
  redirect(data.url);
}

export async function cerrarSesion() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
