'use client';
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { Aviso, Boton } from './ui';

type Res = { ok: true; mensaje?: string; datos?: unknown } | { ok: false; error: string } | null;

/**
 * Formulario para acciones de dinero: incluye una clave única por envío (evita duplicados por doble clic),
 * muestra el resultado y se reinicia tras un registro correcto.
 */
export function FormAccion({ accion, children, boton, variante, className, onOk }: {
  accion: (prev: Res, f: FormData) => Promise<Res>; children: ReactNode; boton: string; variante?: 'primario' | 'oscuro' | 'peligro'; className?: string; onOk?: () => void;
}) {
  const [idem, setIdem] = useState(() => crypto.randomUUID());
  const [estado, ejecutar, pendiente] = useActionState(accion, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) { form.current?.reset(); setIdem(crypto.randomUUID()); onOk?.(); }
  }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form ref={form} action={ejecutar} className={className ?? 'space-y-3'}>
      <input type="hidden" name="idem" value={idem} />
      {estado && !estado.ok && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado?.ok && estado.mensaje && <Aviso tipo="ok">{estado.mensaje}</Aviso>}
      {children}
      <Boton type="submit" variante={variante} disabled={pendiente}>{pendiente ? 'Guardando…' : boton}</Boton>
    </form>
  );
}
