'use client';
import { useTransition } from 'react';
import { FormAccion } from '@/components/form-accion';
import { Campo } from '@/components/ui';
import { CLASIFICACIONES } from '@/lib/dominio';
import { actualizarCategoria, guardarCategoria } from '../actions';

export function FilaCategoria({ c }: { c: { id: string; nombre: string; clasificacion: string; activa: boolean } }) {
  const [p, iniciar] = useTransition();
  const cambiar = (x: { clasificacion?: string; activa?: boolean }) => iniciar(async () => { const r = await actualizarCategoria(c.id, x); if (!r.ok) alert(r.error); });
  return (
    <li className={`flex flex-wrap items-center gap-3 py-2.5 ${c.activa ? '' : 'opacity-50'}`}>
      <span className="flex-1 font-semibold">{c.nombre}</span>
      <select defaultValue={c.clasificacion} disabled={p} onChange={(e) => cambiar({ clasificacion: e.target.value })} className="campo !w-auto !min-h-9 !py-1 !text-sm" aria-label={`Clasificación de ${c.nombre}`}>
        {Object.entries(CLASIFICACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <button disabled={p} onClick={() => cambiar({ activa: !c.activa })} className="text-sm font-semibold text-tinta-3 hover:underline">{c.activa ? 'Ocultar' : 'Mostrar'}</button>
    </li>
  );
}

export function FormCategoria() {
  return (
    <FormAccion accion={guardarCategoria} boton="Crear categoría">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre"><input name="nombre" required className="campo" /></Campo>
        <Campo etiqueta="Clasificación"><select name="clasificacion" className="campo">{Object.entries(CLASIFICACIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
      </div>
    </FormAccion>
  );
}
