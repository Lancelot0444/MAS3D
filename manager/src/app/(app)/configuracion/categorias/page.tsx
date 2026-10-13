import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Encabezado, Tarjeta } from '@/components/ui';
import { FilaCategoria, FormCategoria } from './cliente';

export const metadata = { title: 'Categorías de gasto' };

export default async function Categorias() {
  await exigirRol(['administrador']);
  const supabase = await supabaseServer();
  const { data } = await supabase.from('categorias_gasto').select('*').order('activa', { ascending: false }).order('orden').order('nombre');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Encabezado titulo="Categorías de gasto" subtitulo="La clasificación define cómo afecta a la utilidad. Los cambios aplican a los gastos nuevos." />
      <Tarjeta><ul className="divide-y divide-[#f4ede2]">{(data ?? []).map((c) => <FilaCategoria key={c.id} c={c} />)}</ul></Tarjeta>
      <Tarjeta titulo="Nueva categoría"><FormCategoria /></Tarjeta>
    </div>
  );
}
