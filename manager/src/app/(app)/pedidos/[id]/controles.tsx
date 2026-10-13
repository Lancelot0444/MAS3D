'use client';
import { useState, useTransition } from 'react';
import { cambiarEstado, cambiarEstadoItem } from '../actions';
import { anularMovimiento } from '../../finanzas/actions';
import { Aviso, Boton } from '@/components/ui';
import { ESPECIALES, ESTADOS, FLUJO, SOLO_FINANZAS, type Estado } from '@/lib/dominio';

export function CambioEstado({ id, actual, finanzas }: { id: string; actual: Estado; finanzas: boolean }) {
  const idx = FLUJO.indexOf(actual);
  const sugerido = idx >= 0 && idx < FLUJO.length - 1 ? FLUJO[idx + 1] : actual;
  const [estado, setEstado] = useState<Estado>(sugerido);
  const [nota, setNota] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'error' | 'alerta' | 'ok'; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const opciones = [...FLUJO, ...ESPECIALES].filter((e) => e !== actual && (finanzas || !SOLO_FINANZAS.includes(e)));
  const requiereNota = estado === 'cancelado' || estado === 'devolucion';

  const aplicar = () => iniciar(async () => {
    setMsg(null);
    const r = await cambiarEstado(id, estado, nota);
    if (!r.ok) setMsg({ tipo: 'error', texto: r.error });
    else if (r.datos?.aviso) setMsg({ tipo: 'alerta', texto: r.datos.aviso });
    else setMsg({ tipo: 'ok', texto: `Estado cambiado a “${ESTADOS[estado]}”.` });
    setNota('');
  });

  return (
    <div className="space-y-3">
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {sugerido !== actual && (
        <Boton className="w-full" disabled={pendiente} onClick={() => { setEstado(sugerido); iniciar(async () => {
          setMsg(null);
          const r = await cambiarEstado(id, sugerido);
          if (!r.ok) setMsg({ tipo: 'error', texto: r.error });
          else if (r.datos?.aviso) setMsg({ tipo: 'alerta', texto: r.datos.aviso });
        }); }}>Avanzar a: {ESTADOS[sugerido]}</Boton>
      )}
      <details className="rounded-xl border border-[#efe6d8] p-3">
        <summary className="cursor-pointer text-sm font-semibold">Otro estado…</summary>
        <div className="mt-3 space-y-2">
          <select value={estado} onChange={(e) => setEstado(e.target.value as Estado)} className="campo" aria-label="Nuevo estado">
            {opciones.map((e) => <option key={e} value={e}>{ESTADOS[e]}</option>)}
          </select>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className="campo" placeholder={requiereNota ? 'Motivo (obligatorio)' : 'Nota (opcional)'} />
          {(estado === 'enviado' || estado === 'entregado') && <p className="text-xs text-tinta-3">Al marcarlo como {ESTADOS[estado].toLowerCase()} se registra la venta en la contabilidad.</p>}
          {requiereNota && <p className="text-xs text-tinta-3">Si la venta ya estaba registrada se revierte, y lo cobrado queda como saldo a favor del cliente para devolver o retener.</p>}
          <Boton variante={requiereNota ? 'peligro' : 'oscuro'} disabled={pendiente || (requiereNota && !nota.trim())} onClick={aplicar}>Aplicar</Boton>
        </div>
      </details>
    </div>
  );
}

export function EstadoItem({ pedidoId, itemId, estado }: { pedidoId: string; itemId: string; estado: Estado }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const opciones = FLUJO.filter((e) => !['cotizado', 'enviado', 'entregado'].includes(e)).concat(['pausado', 'retrabajo']);
  return (
    <div>
      <select defaultValue={estado} disabled={pendiente} aria-label="Estado del producto" className="campo !min-h-9 !py-1 !text-sm"
        onChange={(e) => iniciar(async () => { const r = await cambiarEstadoItem(pedidoId, itemId, e.target.value); setError(r.ok ? null : r.error); })}>
        {!opciones.includes(estado) && <option value={estado}>{ESTADOS[estado]}</option>}
        {opciones.map((e) => <option key={e} value={e}>{ESTADOS[e]}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function BotonAnular({ id }: { id: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button disabled={pendiente} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
      onClick={() => {
        const motivo = prompt('Motivo de la anulación (quedará registrado):');
        if (!motivo?.trim()) return;
        iniciar(async () => { const r = await anularMovimiento(id, motivo); if (!r.ok) alert(r.error); });
      }}>Anular</button>
  );
}
