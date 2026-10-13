import { FormLogin } from './form';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Iniciar sesión' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; paso?: string }> }) {
  const sp = await searchParams;
  let factorId: string | undefined;
  if (sp.paso === '2fa') {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.mfa.listFactors();
    factorId = data?.totp?.find((f) => f.status === 'verified')?.id;
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-crema to-[#fffdf9] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-600.jpg" alt="MAS3D — Figuras personalizadas" width={220} height={220} className="mx-auto rounded-3xl mix-blend-multiply" />
          <p className="mt-1 text-sm font-semibold tracking-[0.25em] text-tinta-3">MANAGER</p>
        </div>
        <div className="tarjeta p-6">
          <FormLogin next={sp.next ?? '/'} errorInicial={sp.error} factorId={factorId} />
        </div>
        <p className="mt-6 text-center text-xs text-tinta-3">Acceso solo para el equipo de MAS3D.</p>
      </div>
    </main>
  );
}
