'use client';
import { Aviso, Boton } from '@/components/ui';

export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <Aviso tipo="error">Algo salió mal al cargar esta pantalla. Si no tienes internet, revisa tu conexión. {error.digest && <span className="text-xs">(Ref. {error.digest})</span>}</Aviso>
      <Boton onClick={reset}>Reintentar</Boton>
    </div>
  );
}
