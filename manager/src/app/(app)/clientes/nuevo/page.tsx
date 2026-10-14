import { exigirRol } from '@/lib/auth';
import { Encabezado } from '@/components/ui';
import { FormCliente } from '../form';

export const metadata = { title: 'Nuevo cliente' };

export default async function NuevoCliente({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const { volver } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado titulo="Nuevo cliente" />
      <FormCliente volver={volver} />
    </div>
  );
}
