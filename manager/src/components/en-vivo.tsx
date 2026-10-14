'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

/**
 * Sincronización en tiempo real: cuando otra persona registra un pedido, pago o gasto,
 * la pantalla se actualiza sola (Supabase Realtime respeta los permisos de cada usuario).
 */
export function EnVivo({ tablas }: { tablas: string[] }) {
  const router = useRouter();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const canal = supabase.channel('mas3d-cambios');
    const refrescar = () => {
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => router.refresh(), 400);
    };
    tablas.forEach((t) => canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, refrescar));
    canal.subscribe();
    const alVolver = () => document.visibilityState === 'visible' && refrescar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      supabase.removeChannel(canal);
    };
  }, [router, tablas.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
