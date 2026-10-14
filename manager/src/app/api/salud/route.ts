import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Chequeo de salud para Coolify/Docker. No expone datos ni claves:
 * solo confirma que la app responde y que Supabase es alcanzable.
 */
export async function GET() {
  const inicio = Date.now();
  let supabase: 'ok' | 'sin_conexion' = 'sin_conexion';
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (r.ok) supabase = 'ok';
  } catch {
    // se informa abajo
  }
  return NextResponse.json(
    { app: 'ok', supabase, version: process.env.APP_VERSION ?? 'dev', ms: Date.now() - inicio },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
