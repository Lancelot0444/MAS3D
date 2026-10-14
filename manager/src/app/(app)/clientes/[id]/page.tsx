import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircle, Pencil, Plus } from 'lucide-react';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaLarga } from '@/lib/fechas';
import { enlaceWhatsApp } from '@/lib/validaciones';
import { BotonLink, Encabezado, Indicador, Insignia, Tabla, Tarjeta, td, th, Vacio } from '@/components/ui';
import { EstadoInsignia } from '@/components/pedido-chip';
import { Adjuntos } from '@/components/adjuntos';

export const metadata = { title: 'Cliente' };

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const { id } = await params;
  const supabase = await supabaseServer();
  const [{ data: c }, { data: pedidos }] = await Promise.all([
    supabase.from('v_clientes').select('*').eq('id', id).maybeSingle(),
    supabase.from('v_pedidos').select('id, codigo, fecha_pedido, estado, total, cobrado, saldo_pendiente').eq('cliente_id', id).order('fecha_pedido', { ascending: false }),
  ]);
  if (!c) notFound();
  const wa = enlaceWhatsApp(c.whatsapp, `Hola ${c.nombre.split(' ')[0]}, te saludamos de MAS3D 🐼`);
  const ID = { cedula: 'Cédula', ruc: 'RUC', pasaporte: 'Pasaporte', consumidor_final: 'Consumidor final', ninguna: '—' } as Record<string, string>;

  return (
    <>
      <Encabezado
        titulo={c.nombre}
        subtitulo={<span className="flex flex-wrap items-center gap-2">{c.codigo} · cliente desde {fechaLarga(c.created_at)}
          {c.frecuente && <Insignia className="bg-oro-100 text-oro-900">Frecuente</Insignia>}
          {c.tipo === 'corporativo' && <Insignia className="bg-tinta text-crema">Corporativo</Insignia>}</span>}
        acciones={<>
          {wa && <a href={wa} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700"><MessageCircle className="size-4" />WhatsApp</a>}
          <BotonLink href={`/pedidos/nuevo?cliente=${c.id}`}><Plus className="size-4" />Pedido</BotonLink>
          <BotonLink href={`/clientes/${c.id}/editar`} variante="borde"><Pencil className="size-4" />Editar</BotonLink>
        </>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Pedidos" valor={c.n_pedidos} />
        <Indicador etiqueta="Total comprado" valor={dinero(c.total_comprado)} />
        <Indicador etiqueta="Total pagado" valor={dinero(c.total_pagado)} tono="bien" />
        <Indicador etiqueta="Saldo pendiente" valor={dinero(c.saldo_pendiente)} tono={Number(c.saldo_vencido) > 0 ? 'mal' : Number(c.saldo_pendiente) > 0 ? 'alerta' : 'normal'}
          detalle={Number(c.saldo_vencido) > 0 ? `${dinero(c.saldo_vencido)} vencido` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Tarjeta titulo="Datos">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-tinta-3">WhatsApp</dt><dd>{c.whatsapp ? c.whatsapp.replace(/^593/, '0') : '—'}</dd>
            <dt className="text-tinta-3">Teléfono</dt><dd>{c.telefono ?? '—'}</dd>
            <dt className="text-tinta-3">Correo</dt><dd className="break-all">{c.email ?? '—'}</dd>
            <dt className="text-tinta-3">{ID[c.tipo_identificacion]}</dt><dd>{c.identificacion ?? '—'}</dd>
            <dt className="text-tinta-3">Dirección</dt><dd>{[c.direccion, c.ciudad, c.provincia].filter(Boolean).join(', ') || '—'}</dd>
            <dt className="text-tinta-3">Canal</dt><dd>{c.canal ?? '—'}</dd>
          </dl>
          {c.observaciones && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-crema p-3 text-sm">{c.observaciones}</p>}
        </Tarjeta>
        <Tarjeta titulo="Historial de pedidos">
          {!pedidos?.length ? <Vacio>Este cliente aún no tiene pedidos.</Vacio> : (
            <Tabla>
              <thead><tr><th className={th}>Pedido</th><th className={th}>Fecha</th><th className={th}>Estado</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Saldo</th></tr></thead>
              <tbody>{pedidos.map((p) => (
                <tr key={p.id}>
                  <td className={td}><Link href={`/pedidos/${p.id}`} className="font-semibold hover:text-oro-700">{p.codigo}</Link></td>
                  <td className={td}>{fechaLarga(p.fecha_pedido)}</td>
                  <td className={td}><EstadoInsignia estado={p.estado} /></td>
                  <td className={`${td} cifra text-right`}>{dinero(p.total)}</td>
                  <td className={`${td} cifra text-right ${Number(p.saldo_pendiente) > 0 ? 'font-semibold text-amber-700' : ''}`}>{dinero(p.saldo_pendiente)}</td>
                </tr>
              ))}</tbody>
            </Tabla>
          )}
        </Tarjeta>
      </div>
      <div className="mt-4"><Adjuntos entidad="cliente" id={c.id} ruta={`/clientes/${c.id}`} titulo="Fotos y archivos" /></div>
    </>
  );
}
