import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { fechaLarga } from '@/lib/fechas';
import { Encabezado, Tarjeta } from '@/components/ui';
import { FilaUsuario, FormInvitar, BotonCancelarInvitacion } from './cliente';

export const metadata = { title: 'Usuarios' };

export default async function Usuarios() {
  const yo = await exigirRol(['administrador']);
  const supabase = await supabaseServer();
  const [{ data: usuarios }, { data: invitaciones }] = await Promise.all([
    supabase.from('perfiles').select('*').order('activo', { ascending: false }).order('nombre'),
    supabase.from('invitaciones').select('*').is('usada_at', null).order('created_at', { ascending: false }),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Encabezado titulo="Usuarios y permisos" subtitulo="Producción y Pintura no ven ganancias, cuentas bancarias, deudas ni sueldos." />
      <Tarjeta titulo="Equipo">
        <ul className="divide-y divide-[#f4ede2]">
          {(usuarios ?? []).map((u) => <FilaUsuario key={u.id} u={u} yo={u.id === yo.id} />)}
        </ul>
      </Tarjeta>
      {!!invitaciones?.length && (
        <Tarjeta titulo="Invitaciones pendientes">
          <ul className="divide-y divide-[#f4ede2] text-sm">
            {invitaciones.map((i) => <li key={i.email} className="flex items-center justify-between gap-2 py-2"><span><b>{i.nombre}</b> · {i.email} · {i.rol} · {fechaLarga(i.created_at)}</span><BotonCancelarInvitacion email={i.email} /></li>)}
          </ul>
        </Tarjeta>
      )}
      <Tarjeta titulo="Invitar a una persona"><FormInvitar /></Tarjeta>
    </div>
  );
}
