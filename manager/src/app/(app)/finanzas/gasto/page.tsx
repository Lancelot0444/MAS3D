import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { hoyEC } from '@/lib/fechas';
import { Encabezado } from '@/components/ui';
import { FormGasto } from './form';

export const metadata = { title: 'Registrar gasto' };

export default async function NuevoGasto() {
  await exigirRol(['administrador', 'contabilidad']);
  const supabase = await supabaseServer();
  const [{ data: categorias }, { data: cuentas }, { data: proveedores }, { data: pedidos }] = await Promise.all([
    supabase.from('categorias_gasto').select('id, nombre, clasificacion').eq('activa', true).order('orden'),
    supabase.from('v_cuentas_saldo').select('id, nombre, saldo').eq('activa', true).order('orden'),
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('v_pedidos').select('id, codigo, cliente_nombre').not('estado', 'in', '(cancelado)').order('created_at', { ascending: false }).limit(100),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado titulo="Registrar gasto" subtitulo="Compras, servicios, sueldos, inversiones…" />
      <FormGasto categorias={categorias ?? []} cuentas={cuentas ?? []} proveedores={proveedores ?? []} pedidos={pedidos ?? []} hoy={hoyEC()} />
    </div>
  );
}
