'use client';
import { useEffect, useState } from 'react';
import { FormAccion } from '@/components/form-accion';
import { Aviso, Boton, Campo } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { cambiarClave, cambiarNombre } from '../actions';

export function FormNombre({ nombre }: { nombre: string }) {
  return (
    <FormAccion accion={cambiarNombre} boton="Guardar">
      <Campo etiqueta="Tu nombre"><input name="nombre" defaultValue={nombre} required className="campo" /></Campo>
    </FormAccion>
  );
}

export function FormClave() {
  return (
    <FormAccion accion={cambiarClave} boton="Cambiar contraseña">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nueva contraseña" ayuda="Mínimo 10 caracteres"><input name="clave" type="password" autoComplete="new-password" required className="campo" /></Campo>
        <Campo etiqueta="Repetir"><input name="repetir" type="password" autoComplete="new-password" required className="campo" /></Campo>
      </div>
    </FormAccion>
  );
}

type Factor = { id: string; friendly_name?: string; status: string };

/** Verificación en dos pasos con una app autenticadora (Google Authenticator, Authy, 1Password…). */
export function DosPasos() {
  const supabase = supabaseBrowser();
  const [factores, setFactores] = useState<Factor[] | null>(null);
  const [alta, setAlta] = useState<{ id: string; qr: string; secreto: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'error' | 'ok'; t: string } | null>(null);

  const cargar = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactores((data?.totp ?? []) as Factor[]);
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const iniciar = async () => {
    setMsg(null);
    for (const f of (factores ?? []).filter((x) => x.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `MAS3D ${new Date().toISOString().slice(0, 10)}` });
    if (error || !data) { setMsg({ tipo: 'error', t: 'No se pudo iniciar la activación. Inténtalo de nuevo.' }); return; }
    setAlta({ id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret });
  };
  const confirmar = async () => {
    if (!alta) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: alta.id, code: codigo.trim() });
    if (error) { setMsg({ tipo: 'error', t: 'Código incorrecto. Revisa la hora de tu teléfono e inténtalo otra vez.' }); return; }
    setAlta(null); setCodigo(''); setMsg({ tipo: 'ok', t: 'Verificación en dos pasos activada. Te pediremos el código al iniciar sesión.' });
    cargar();
  };
  const quitar = async (id: string) => {
    if (!confirm('¿Desactivar la verificación en dos pasos?')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setMsg(error ? { tipo: 'error', t: 'Para desactivarla, cierra sesión y vuelve a entrar con tu código.' } : { tipo: 'ok', t: 'Desactivada.' });
    cargar();
  };

  const activos = (factores ?? []).filter((f) => f.status === 'verified');
  return (
    <div className="space-y-3">
      {msg && <Aviso tipo={msg.tipo}>{msg.t}</Aviso>}
      {factores === null ? <p className="text-sm text-tinta-3">Cargando…</p> : activos.length ? (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-sm"><span>✅ Activada</span><Boton variante="peligro" chico onClick={() => quitar(activos[0].id)}>Desactivar</Boton></div>
      ) : alta ? (
        <div className="space-y-3">
          <p className="text-sm">1. Escanea este código con tu app autenticadora (Google Authenticator, Microsoft Authenticator, Authy…).</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={alta.qr} alt="Código QR para la app autenticadora" width={180} height={180} className="rounded-xl border border-[#efe6d8] bg-white p-2" />
          <p className="text-xs text-tinta-3">¿No puedes escanear? Escribe esta clave: <code className="break-all">{alta.secreto}</code></p>
          <p className="text-sm">2. Escribe el código de 6 dígitos que muestra la app:</p>
          <div className="flex gap-2"><input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" maxLength={6} className="campo !w-40 text-center tracking-widest" aria-label="Código" /><Boton onClick={confirmar}>Confirmar</Boton></div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-tinta-3">Protege tu cuenta: además de la contraseña, se pedirá un código de tu teléfono. Recomendado para administradores.</p>
          <Boton variante="oscuro" onClick={iniciar}>Activar</Boton>
        </div>
      )}
    </div>
  );
}
