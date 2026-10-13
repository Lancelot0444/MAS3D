import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Cliente con la clave de servicio. SOLO para invitar usuarios desde el servidor. */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
