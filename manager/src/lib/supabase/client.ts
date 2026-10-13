'use client';
import { createBrowserClient } from '@supabase/ssr';

let cliente: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente de Supabase en el navegador (tiempo real y subida de archivos). */
export function supabaseBrowser() {
  cliente ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return cliente;
}
