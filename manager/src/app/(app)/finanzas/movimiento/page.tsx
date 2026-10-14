import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { hoyEC } from '@/lib/fechas';
import { Encabezado } from '@/components/ui';
import { FormMovimiento } from './form';

export const metadata = { title: 'Otro movimiento' };

export default async function Movimiento() {
  await exigirRol(['administrador', 'contabilidad']);
  const supabase = await supabaseServer();
  const [{ data: cuentas }, { data: prestamos }] = await Promise.all([
    supabase.from('v_cuentas_saldo').select('id, nombre, saldo').eq('activa', true).order('orden'),
    supabase.from('transacciones').select('referencia').eq('tipo', 'prestamo_recibido').eq('anulada', false),
  ]);
  const refs = Array.from(new Set((prestamos ?? []).map((p) => p.referencia).filter(Boolean))) as string[];
  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado titulo="Otro movimiento de dinero" subtitulo="Lo que no es una venta ni un gasto" />
      <FormMovimiento cuentas={cuentas ?? []} prestamos={refs} hoy={hoyEC()} />
    </div>
  );
}
