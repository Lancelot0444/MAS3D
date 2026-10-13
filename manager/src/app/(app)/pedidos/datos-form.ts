import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export async function datosFormularioPedido() {
  const supabase = await supabaseServer();
  const [{ data: clientes }, { data: perfiles }, { data: config }] = await Promise.all([
    supabase.from('clientes').select('id, codigo, nombre, whatsapp').eq('activo', true).order('nombre').limit(5000),
    supabase.from('perfiles').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('configuracion').select('iva_activo, iva_tarifa, precios_incluyen_iva, anticipo_porcentaje, envio_referencial, dias_fabricacion').single(),
  ]);
  return { clientes: clientes ?? [], perfiles: perfiles ?? [], config: config! };
}
