'use client';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { AlertTriangle } from 'lucide-react';
import { COLUMNAS_KANBAN, ESTADOS, ACTIVOS, type Estado } from '@/lib/dominio';
import { dinero } from '@/lib/money';
import { fechaCorta } from '@/lib/fechas';
import { Aviso, Insignia, cx } from '@/components/ui';
import { Vence } from '@/components/pedido-chip';
import { cambiarEstado } from './actions';

export type TarjetaPedido = { id: string; codigo: string; cliente_nombre: string; estado: Estado; prioridad: string; fecha_entrega_prometida: string | null; atrasado: boolean; saldo_pendiente?: number; total?: number };

export function Kanban({ pedidos, finanzas }: { pedidos: TarjetaPedido[]; finanzas: boolean }) {
  const [lista, setLista] = useState(pedidos);
  const [msg, setMsg] = useState<{ tipo: 'error' | 'alerta'; texto: string } | null>(null);
  const [, iniciar] = useTransition();
  useEffect(() => setLista(pedidos), [pedidos]);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));

  const alSoltar = (e: DragEndEvent) => {
    const col = COLUMNAS_KANBAN.find((c) => c.id === e.over?.id);
    const p = lista.find((x) => x.id === e.active.id);
    if (!col || !p || col.estados.includes(p.estado)) return;
    if (!finanzas && col.destino === 'confirmado') return;
    const anterior = p.estado;
    setLista((l) => l.map((x) => (x.id === p.id ? { ...x, estado: col.destino } : x)));
    iniciar(async () => {
      const r = await cambiarEstado(p.id, col.destino);
      if (!r.ok) { setLista((l) => l.map((x) => (x.id === p.id ? { ...x, estado: anterior } : x))); setMsg({ tipo: 'error', texto: r.error }); }
      else setMsg(r.datos?.aviso ? { tipo: 'alerta', texto: `${p.codigo}: ${r.datos.aviso}` } : null);
    });
  };

  return (
    <>
      {msg && <div className="mb-3"><Aviso tipo={msg.tipo}>{msg.texto}</Aviso></div>}
      <p className="mb-2 text-xs text-tinta-3">Arrastra una tarjeta a otra columna para cambiar su etapa (en iPad/iPhone: mantén presionado y arrastra).</p>
      <DndContext sensors={sensores} onDragEnd={alSoltar}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {COLUMNAS_KANBAN.map((c) => (
            <Columna key={c.id} id={c.id} titulo={c.titulo} pedidos={lista.filter((p) => c.estados.includes(p.estado))} finanzas={finanzas} />
          ))}
        </div>
      </DndContext>
    </>
  );
}

function Columna({ id, titulo, pedidos, finanzas }: { id: string; titulo: string; pedidos: TarjetaPedido[]; finanzas: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={cx('flex w-72 shrink-0 snap-start flex-col rounded-2xl border p-2 transition', isOver ? 'border-oro-500 bg-oro-50' : 'border-[#efe6d8] bg-crema/60')}>
      <h3 className="flex items-center justify-between px-2 py-1.5 text-sm font-bold">{titulo}<span className="rounded-full bg-white px-2 text-xs text-tinta-3">{pedidos.length}</span></h3>
      <div className="flex min-h-24 flex-col gap-2">
        {pedidos.map((p) => <Tarjeta key={p.id} p={p} finanzas={finanzas} />)}
      </div>
    </section>
  );
}

function Tarjeta({ p, finanzas }: { p: TarjetaPedido; finanzas: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id });
  const estilo = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={estilo} {...listeners} {...attributes}
      className={cx('touch-manipulation rounded-xl border bg-white p-3 text-sm shadow-sm', isDragging && 'z-50 rotate-2 shadow-xl', p.atrasado ? 'border-red-300 ring-1 ring-red-200' : 'border-[#efe6d8]')}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`/pedidos/${p.id}`} className="font-bold hover:text-oro-700" onPointerDown={(e) => e.stopPropagation()}>{p.codigo}</Link>
        {p.atrasado && <AlertTriangle className="size-4 text-red-600" aria-label="Atrasado" />}
        {(p.prioridad === 'alta' || p.prioridad === 'urgente') && <Insignia className={p.prioridad === 'urgente' ? 'bg-red-600 text-white' : 'bg-orange-100 text-orange-900'}>{p.prioridad}</Insignia>}
      </div>
      <div className="mt-0.5 truncate text-tinta-2">{p.cliente_nombre}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-tinta-3">
        <span>{ESTADOS[p.estado]}</span>·<span>{fechaCorta(p.fecha_entrega_prometida)}</span>
        <Vence fecha={p.fecha_entrega_prometida} activo={ACTIVOS(p.estado)} />
      </div>
      {finanzas && Number(p.saldo_pendiente) > 0 && <div className="mt-1.5 text-xs font-semibold text-amber-700">Debe {dinero(p.saldo_pendiente)}</div>}
    </div>
  );
}
