import { exigirRol } from '@/lib/auth';
import { hoyEC } from '@/lib/fechas';
import { Encabezado } from '@/components/ui';
import { FormPedido } from '../form-pedido';
import { datosFormularioPedido } from '../datos-form';

export const metadata = { title: 'Nuevo pedido' };

export default async function NuevoPedido({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const { cliente } = await searchParams;
  const d = await datosFormularioPedido();
  return (
    <div className="mx-auto max-w-5xl">
      <Encabezado titulo="Nuevo pedido" subtitulo="El código MAS-AAAA-NNNN se asigna al guardar" />
      <FormPedido {...d} hoy={hoyEC()} clienteInicial={cliente} />
    </div>
  );
}
