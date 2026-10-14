'use client';
import { useActionState, useState } from 'react';
import { iniciarSesion, iniciarConGoogle, verificarCodigo2fa, type EstadoLogin } from './actions';
import { Aviso, Boton, Campo } from '@/components/ui';

const ERRORES: Record<string, string> = {
  auth: 'No se pudo completar el inicio de sesión. Inténtalo de nuevo.',
  'sin-acceso': 'Tu cuenta todavía no tiene acceso. Pide a un administrador que te invite.',
};

export function FormLogin({ next, errorInicial, factorId }: { next: string; errorInicial?: string; factorId?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoLogin, FormData>(iniciarSesion, factorId ? { paso: '2fa', factorId } : { paso: 'credenciales' });
  const [estado2fa, accion2fa, verificando] = useActionState<EstadoLogin, FormData>(verificarCodigo2fa, { paso: '2fa' });
  const [verClave, setVerClave] = useState(false);

  if (estado.paso === '2fa') {
    return (
      <form action={accion2fa} className="space-y-4">
        <h1 className="text-lg font-bold">Verificación en dos pasos</h1>
        <p className="text-sm text-tinta-3">Escribe el código de 6 dígitos de tu app autenticadora.</p>
        {estado2fa.error && <Aviso tipo="error">{estado2fa.error}</Aviso>}
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="factorId" value={estado.factorId} />
        <Campo etiqueta="Código">
          <input name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="campo text-center text-2xl tracking-[0.4em]" />
        </Campo>
        <Boton type="submit" className="w-full" disabled={verificando}>{verificando ? 'Verificando…' : 'Verificar'}</Boton>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Iniciar sesión</h1>
      {(estado.error || errorInicial) && <Aviso tipo="error">{estado.error ?? ERRORES[errorInicial!] ?? errorInicial}</Aviso>}
      <form action={iniciarConGoogle}>
        <input type="hidden" name="next" value={next} />
        <Boton type="submit" variante="borde" className="w-full">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continuar con Google
        </Boton>
      </form>
      <div className="flex items-center gap-3 text-xs text-tinta-3"><span className="h-px flex-1 bg-[#efe6d8]" />o con tu correo<span className="h-px flex-1 bg-[#efe6d8]" /></div>
      <form action={accion} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <Campo etiqueta="Correo electrónico">
          <input name="email" type="email" autoComplete="email" autoCapitalize="none" required className="campo" />
        </Campo>
        <Campo etiqueta="Contraseña">
          <div className="relative">
            <input name="password" type={verClave ? 'text' : 'password'} autoComplete="current-password" required className="campo pr-20" />
            <button type="button" onClick={() => setVerClave((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-tinta-3 hover:bg-crema-2">
              {verClave ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </Campo>
        <Boton type="submit" variante="oscuro" className="w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Boton>
      </form>
    </div>
  );
}
