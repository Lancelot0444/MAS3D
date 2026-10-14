import { notFound } from 'next/navigation';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Encabezado } from '@/components/ui';
import { FormCliente } from '../../form';

export const metadata = { title: 'Editar cliente' };

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado titulo={`Editar ${data.codigo}`} />
      <FormCliente cliente={data} />
    </div>
  );
}
