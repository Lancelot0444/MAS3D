'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { guardarCliente, type EstadoCliente } from './actions';
import { Aviso, Boton, Campo } from '@/components/ui';
import { CANALES } from '@/lib/dominio';

type Cliente = Record<string, string | null>;
const PROVINCIAS = ['Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'];

export function FormCliente({ cliente, volver }: { cliente?: Cliente; volver?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoCliente, FormData>(guardarCliente, {});
  const [tipoId, setTipoId] = useState(cliente?.tipo_identificacion ?? 'ninguna');
  const c = cliente ?? {};
  const err = (k: string) => estado.campos?.[k];

  return (
    <form action={accion} className="tarjeta space-y-5 p-5">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      {volver && <input type="hidden" name="volver" value={volver} />}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado.similares && (
        <Aviso tipo="alerta">
          <p className="font-semibold">¿Es alguno de estos clientes? Revisa para no duplicarlo:</p>
          <ul className="mt-2 space-y-1">
            {estado.similares.map((s) => (
              <li key={s.id}><Link href={`/clientes/${s.id}`} className="font-semibold underline">{s.codigo} · {s.nombre}</Link> <span className="text-xs">({s.motivo})</span></li>
            ))}
          </ul>
          <input type="hidden" name="confirmar_duplicado" value="1" />
          <p className="mt-2 text-xs">Si es una persona distinta, pulsa <b>Guardar</b> otra vez.</p>
        </Aviso>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo *" error={err('nombre')} className="sm:col-span-2">
          <input name="nombre" defaultValue={c.nombre ?? ''} required className="campo" autoComplete="off" />
        </Campo>
        <Campo etiqueta="WhatsApp" ayuda="Ej: 0983890036">
          <input name="whatsapp" type="tel" defaultValue={c.whatsapp ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Otro teléfono">
          <input name="telefono" type="tel" defaultValue={c.telefono ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Correo electrónico" error={err('email')}>
          <input name="email" type="email" defaultValue={c.email ?? ''} className="campo" autoCapitalize="none" />
        </Campo>
        <Campo etiqueta="Tipo de cliente">
          <select name="tipo" defaultValue={c.tipo ?? 'persona'} className="campo">
            <option value="persona">Persona</option><option value="corporativo">Corporativo / empresa</option>
          </select>
        </Campo>
        <Campo etiqueta="Identificación">
          <select name="tipo_identificacion" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="campo">
            <option value="ninguna">Sin identificación</option><option value="cedula">Cédula</option><option value="ruc">RUC</option>
            <option value="pasaporte">Pasaporte</option><option value="consumidor_final">Consumidor final</option>
          </select>
        </Campo>
        {['cedula', 'ruc', 'pasaporte'].includes(tipoId) && (
          <Campo etiqueta={tipoId === 'ruc' ? 'Número de RUC' : tipoId === 'cedula' ? 'Número de cédula' : 'Pasaporte'} error={err('identificacion')}>
            <input name="identificacion" inputMode={tipoId === 'pasaporte' ? 'text' : 'numeric'} defaultValue={c.identificacion ?? ''} className="campo" />
          </Campo>
        )}
        <Campo etiqueta="Dirección" className="sm:col-span-2">
          <input name="direccion" defaultValue={c.direccion ?? ''} className="campo" />
        </Campo>
        <Campo etiqueta="Ciudad"><input name="ciudad" defaultValue={c.ciudad ?? ''} className="campo" list="ciudades" /></Campo>
        <Campo etiqueta="Provincia">
          <select name="provincia" defaultValue={c.provincia ?? ''} className="campo"><option value="">—</option>{PROVINCIAS.map((p) => <option key={p}>{p}</option>)}</select>
        </Campo>
        <datalist id="ciudades">{['Azogues', 'Cuenca', 'Biblián', 'Cañar', 'La Troncal', 'Déleg', 'Quito', 'Guayaquil'].map((x) => <option key={x} value={x} />)}</datalist>
        <Campo etiqueta="¿Cómo nos conoció?">
          <select name="canal" defaultValue={c.canal ?? ''} className="campo"><option value="">—</option>{CANALES.map((x) => <option key={x}>{x}</option>)}</select>
        </Campo>
        <Campo etiqueta="Observaciones internas" className="sm:col-span-2" ayuda="Solo visible para administración y contabilidad">
          <textarea name="observaciones" rows={3} defaultValue={c.observaciones ?? ''} className="campo" />
        </Campo>
      </div>
      <div className="flex gap-2">
        <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cliente'}</Boton>
        <Link href={c.id ? `/clientes/${c.id}` : '/clientes'} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-tinta-3">Cancelar</Link>
      </div>
    </form>
  );
}
