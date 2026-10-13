'use client';
import { useTransition } from 'react';
import { FormAccion } from '@/components/form-accion';
import { Campo, Insignia } from '@/components/ui';
import { ROLES_LABEL } from '@/lib/dominio';
import { cambiarUsuario, cancelarInvitacion, invitarUsuario } from '../actions';

const DESCRIPCION: Record<string, string> = {
  administrador: 'Todo, incluido anular movimientos y administrar usuarios',
  contabilidad: 'Clientes, pedidos, cobros, gastos, cuentas y reportes',
  produccion: 'Pedidos y su avance, sin precios ni dinero',
  pintura: 'Solo trabajos de pintura (se habilita en la Fase 2)',
};

export function FilaUsuario({ u, yo }: { u: { id: string; nombre: string; email: string; rol: string | null; activo: boolean }; yo: boolean }) {
  const [pend, iniciar] = useTransition();
  const cambiar = (c: { rol?: string; activo?: boolean }) => iniciar(async () => { const r = await cambiarUsuario(u.id, c); if (!r.ok) alert(r.error); });
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1"><div className="font-semibold">{u.nombre} {yo && <Insignia>Tú</Insignia>}</div><div className="truncate text-xs text-tinta-3">{u.email}</div></div>
      <select defaultValue={u.rol ?? ''} disabled={pend || yo} onChange={(e) => cambiar({ rol: e.target.value, activo: true })} className="campo !w-auto !min-h-9 !py-1 !text-sm" aria-label={`Rol de ${u.nombre}`}>
        <option value="" disabled>Sin rol</option>{Object.entries(ROLES_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {!yo && <button disabled={pend} onClick={() => cambiar({ activo: !u.activo })} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${u.activo ? 'text-red-700 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}>{u.activo ? 'Desactivar' : 'Activar'}</button>}
    </li>
  );
}

export function FormInvitar() {
  return (
    <FormAccion accion={invitarUsuario} boton="Invitar">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Nombre"><input name="nombre" required className="campo" /></Campo>
        <Campo etiqueta="Correo (Gmail u otro)"><input name="email" type="email" required className="campo" autoCapitalize="none" /></Campo>
        <Campo etiqueta="Rol"><select name="rol" defaultValue="produccion" className="campo">{Object.entries(ROLES_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
      </div>
      <ul className="text-xs text-tinta-3">{Object.entries(DESCRIPCION).map(([k, v]) => <li key={k}><b>{ROLES_LABEL[k as keyof typeof ROLES_LABEL]}:</b> {v}</li>)}</ul>
    </FormAccion>
  );
}

export function BotonCancelarInvitacion({ email }: { email: string }) {
  const [p, iniciar] = useTransition();
  return <button disabled={p} onClick={() => iniciar(async () => { await cancelarInvitacion(email); })} className="text-xs font-semibold text-red-700">Cancelar</button>;
}
