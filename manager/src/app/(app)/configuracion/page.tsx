import { redirect } from 'next/navigation';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Aviso, Encabezado } from '@/components/ui';
import { FormConfig } from './form-config';

export const metadata = { title: 'Configuración' };

export default async function Configuracion() {
  const p = await exigirRol();
  if (p.rol !== 'administrador') redirect('/configuracion/cuenta');
  const supabase = await supabaseServer();
  const { data: cfg } = await supabase.from('configuracion').select('*').single();
  return (
    <div className="mx-auto max-w-4xl">
      <Encabezado titulo="Configuración del negocio" />
      {!cfg?.config_tributaria_confirmada && (
        <div className="mb-4"><Aviso tipo="alerta">
          <b>Importante:</b> según la normativa vigente que conocemos, los contribuyentes <b>RIMPE Emprendedor</b> sí generan IVA en bienes gravados (tarifa general 15%),
          a diferencia de los <i>Negocios Populares</i>. Confirmen con su contador si sus precios actuales deben incluir IVA antes de activarlo. Mientras tanto el IVA está desactivado.
        </Aviso></div>
      )}
      <FormConfig cfg={cfg!} />
    </div>
  );
}
