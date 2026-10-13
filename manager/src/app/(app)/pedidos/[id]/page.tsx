import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircle, Pencil, Printer } from 'lucide-react';
import { exigirRol, esFinanzas } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero, porcentaje } from '@/lib/money';
import { fechaLarga, hoyEC } from '@/lib/fechas';
import { ACTIVOS, ESTADOS, MODALIDADES, PRIORIDADES, TIPOS_TX, type Estado } from '@/lib/dominio';
import { enlaceWhatsApp } from '@/lib/validaciones';
import { Aviso, BotonLink, Encabezado, Insignia, Tabla, Tarjeta, td, th, Vacio, cx } from '@/components/ui';
import { EstadoInsignia, Vence } from '@/components/pedido-chip';
import { Adjuntos } from '@/components/adjuntos';
import { BotonAnular, CambioEstado, EstadoItem } from './controles';
import { FormCobro, FormDevolucion } from './cobros';

export const metadata = { title: 'Pedido' };

export default async function FichaPedido({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirRol(['administrador', 'contabilidad', 'produccion']);
  const finanzas = esFinanzas(perfil.rol);
  const { id } = await params;
  const supabase = await supabaseServer();

  const [{ data: p }, { data: items }, { data: historial }] = await Promise.all([
    finanzas ? supabase.from('v_pedidos').select('*').eq('id', id).maybeSingle() : supabase.from('v_pedidos_produccion').select('*').eq('id', id).maybeSingle(),
    finanzas ? supabase.from('pedido_items').select('*').eq('pedido_id', id).order('linea') : supabase.from('v_items_produccion').select('*').eq('pedido_id', id).order('linea'),
    supabase.from('pedido_historial').select('id, estado_anterior, estado_nuevo, nota, fecha, usuario_id, item_id').eq('pedido_id', id).order('fecha', { ascending: false }).limit(50),
  ]);
  if (!p) notFound();
  const { data: equipo } = await supabase.from('perfiles').select('id, nombre');
  const nombres = Object.fromEntries((equipo ?? []).map((u) => [u.id, u.nombre]));

  let movimientos: { transaccion_id: string; numero: number; fecha: string; tipo: string; subtipo: string | null; metodo_pago: string | null; entrada: number; salida: number; cuenta_nombre: string; anulada: boolean; comprobante: string | null; creado_por_nombre: string | null }[] = [];
  let cuentas: { id: string; nombre: string }[] = [];
  let config: { anticipo_porcentaje: number } | null = null;
  if (finanzas) {
    const [m, c, cfg] = await Promise.all([
      supabase.from('v_movimientos').select('*').eq('pedido_id', id).order('fecha').order('numero'),
      supabase.from('v_cuentas_saldo').select('id, nombre, saldo').eq('activa', true).order('orden'),
      supabase.from('configuracion').select('anticipo_porcentaje').single(),
    ]);
    movimientos = m.data ?? [];
    cuentas = c.data ?? [];
    config = cfg.data;
  }

  const estado = p.estado as Estado;
  const saldo = Number(p.saldo_pendiente ?? 0);
  const aFavor = Number(p.saldo_a_favor ?? 0);
  const hoy = hoyEC();
  const wa = finanzas ? enlaceWhatsApp(p.cliente_whatsapp,
    `Hola ${String(p.cliente_nombre).split(' ')[0]}, te saludamos de MAS3D 🐼\nPedido ${p.codigo}\nTotal: ${dinero(p.total)}\nPagado: ${dinero(p.cobrado)}\nSaldo: ${dinero(saldo)}\nEntrega: ${fechaLarga(p.fecha_entrega_prometida)}`) : null;

  return (
    <>
      <Encabezado
        titulo={<span className="flex flex-wrap items-center gap-3">{p.codigo}<EstadoInsignia estado={estado} /><Vence fecha={p.fecha_entrega_prometida} activo={ACTIVOS(estado)} /></span>}
        subtitulo={<>{finanzas ? <Link href={`/clientes/${p.cliente_id}`} className="font-semibold hover:text-oro-700">{p.cliente_nombre}</Link> : p.cliente_nombre} · pedido el {fechaLarga(p.fecha_pedido)}</>}
        acciones={<>
          {wa && <a href={wa} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700"><MessageCircle className="size-4" />WhatsApp</a>}
          {finanzas && <BotonLink href={`/pedidos/${id}/recibo`} variante="borde"><Printer className="size-4" />Recibo</BotonLink>}
          {finanzas && !['cancelado'].includes(estado) && <BotonLink href={`/pedidos/${id}/editar`} variante="borde"><Pencil className="size-4" />Editar</BotonLink>}
        </>}
      />

      {finanzas && saldo > 0 && ['listo_entrega', 'enviado', 'entregado'].includes(estado) && (
        <div className="mb-4"><Aviso tipo="error"><b>Saldo pendiente de {dinero(saldo)}.</b> Cóbralo antes de entregar o enviar el producto.</Aviso></div>
      )}
      {p.atrasado && <div className="mb-4"><Aviso tipo="error">Este pedido está <b>atrasado</b>: la entrega prometida era el {fechaLarga(p.fecha_entrega_prometida)}.</Aviso></div>}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Tarjeta titulo="Productos">
            <Tabla>
              <thead><tr><th className={th}>Producto</th><th className={th}>Cant.</th><th className={th}>Estado</th>{finanzas && <th className={`${th} text-right`}>Total</th>}</tr></thead>
              <tbody>
                {(items ?? []).map((i) => (
                  <tr key={i.id}>
                    <td className={td}>
                      <div className="font-semibold">{i.descripcion}</div>
                      <div className="text-xs text-tinta-3">{[i.tipo_producto, i.tamano, i.material, i.colores].filter((x) => x && x !== 'Envío').join(' · ')}</div>
                      {finanzas && Number(i.descuento) > 0 && <div className="text-xs text-oro-700">Descuento {dinero(i.descuento)}</div>}
                    </td>
                    <td className={`${td} cifra`}>{Number(i.cantidad)}</td>
                    <td className={td}>{i.es_envio ? <Insignia>Envío</Insignia> : <EstadoItem pedidoId={id} itemId={i.id} estado={i.estado} />}</td>
                    {finanzas && <td className={`${td} cifra text-right`}>{dinero(i.total)}</td>}
                  </tr>
                ))}
              </tbody>
            </Tabla>
            {finanzas && (
              <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
                {Number(p.total_descuentos) > 0 && <div className="flex justify-between text-tinta-3"><span>Descuentos</span><span className="cifra">−{dinero(p.total_descuentos)}</span></div>}
                {Number(p.total_iva) > 0 && <div className="flex justify-between text-tinta-3"><span>IVA</span><span className="cifra">{dinero(p.total_iva)}</span></div>}
                <div className="flex justify-between text-base font-bold"><span>Total</span><span className="cifra">{dinero(p.total)}</span></div>
              </div>
            )}
          </Tarjeta>

          {finanzas && (
            <Tarjeta titulo="Cobros y devoluciones">
              {!movimientos.length ? <Vacio>Aún no se registran cobros.</Vacio> : (
                <Tabla>
                  <thead><tr><th className={th}>#</th><th className={th}>Fecha</th><th className={th}>Tipo</th><th className={th}>Cuenta</th><th className={`${th} text-right`}>Monto</th><th className={th}></th></tr></thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={`${m.transaccion_id}-${m.cuenta_nombre}`} className={cx(m.anulada && 'text-tinta-3 line-through')}>
                        <td className={`${td} cifra`}>{m.numero}</td>
                        <td className={td}>{fechaLarga(m.fecha)}</td>
                        <td className={td}>{TIPOS_TX[m.tipo]}{m.subtipo && m.tipo === 'cobro' ? ` · ${m.subtipo}` : ''}<div className="text-xs text-tinta-3 no-underline">{m.creado_por_nombre}{m.comprobante && ` · ${m.comprobante}`}</div></td>
                        <td className={td}>{m.cuenta_nombre}</td>
                        <td className={cx(td, 'cifra text-right font-semibold', Number(m.entrada) > 0 ? 'text-emerald-700' : 'text-red-700')}>{Number(m.entrada) > 0 ? '+' : '−'}{dinero(Number(m.entrada) || Number(m.salida))}</td>
                        <td className={`${td} text-right`}>{perfil.rol === 'administrador' && !m.anulada && ['cobro', 'devolucion_cliente'].includes(m.tipo) && <BotonAnular id={m.transaccion_id} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              )}
            </Tarjeta>
          )}

          <Adjuntos entidad="pedido" id={id} ruta={`/pedidos/${id}`} titulo="Referencias, bocetos y archivos 3D" categorias={['Referencia', 'Boceto', 'Boceto aprobado', 'STL / 3MF', 'Foto final']} />
        </div>

        <div className="space-y-4">
          {finanzas && (
            <Tarjeta titulo="Dinero">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt>Total</dt><dd className="cifra font-semibold">{dinero(p.total)}</dd></div>
                <div className="flex justify-between"><dt>Cobrado</dt><dd className="cifra font-semibold text-emerald-700">{dinero(p.cobrado)}</dd></div>
                <div className="flex justify-between text-base"><dt className="font-bold">Saldo pendiente</dt><dd className={cx('cifra font-bold', saldo > 0 ? 'text-amber-700' : 'text-emerald-700')}>{dinero(saldo)}</dd></div>
                {aFavor > 0 && <div className="flex justify-between"><dt>Saldo a favor del cliente</dt><dd className="cifra font-semibold text-sky-800">{dinero(aFavor)}</dd></div>}
                <div className="flex justify-between text-xs text-tinta-3"><dt>Venta registrada</dt><dd>{p.venta_reconocida_at ? 'Sí' : 'Al entregar/enviar'}</dd></div>
              </dl>
              {saldo > 0 && !['cancelado', 'cotizado', 'devolucion'].includes(estado) && (
                <div className="mt-4 border-t border-[#f4ede2] pt-4">
                  <h3 className="mb-2 text-sm font-bold">Registrar cobro</h3>
                  <FormCobro pedidoId={id} saldo={saldo} cobrado={Number(p.cobrado)} anticipoSugerido={Math.min(saldo, porcentaje(p.total, Number(config?.anticipo_porcentaje ?? 50)))} cuentas={cuentas} hoy={hoy} />
                </div>
              )}
              {aFavor > 0 && (
                <div className="mt-4 border-t border-[#f4ede2] pt-4">
                  <h3 className="mb-2 text-sm font-bold">Dinero a favor del cliente</h3>
                  <FormDevolucion pedidoId={id} aFavor={aFavor} cuentas={cuentas} hoy={hoy} admin={perfil.rol === 'administrador'} />
                </div>
              )}
            </Tarjeta>
          )}

          <Tarjeta titulo="Estado">
            <CambioEstado id={id} actual={estado} finanzas={finanzas} />
          </Tarjeta>

          <Tarjeta titulo="Entrega">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-tinta-3">Prometida</dt><dd className="font-semibold">{fechaLarga(p.fecha_entrega_prometida)}</dd>
              {p.fecha_entrega_real && <><dt className="text-tinta-3">Entregado</dt><dd>{fechaLarga(p.fecha_entrega_real)}</dd></>}
              <dt className="text-tinta-3">Modalidad</dt><dd>{MODALIDADES[p.modalidad_entrega as keyof typeof MODALIDADES]}</dd>
              {p.transportista && <><dt className="text-tinta-3">Transportista</dt><dd>{p.transportista}</dd></>}
              {p.numero_guia && <><dt className="text-tinta-3">Guía</dt><dd>{p.numero_guia}</dd></>}
              {'direccion_envio' in p && p.direccion_envio && <><dt className="text-tinta-3">Dirección</dt><dd>{p.direccion_envio}</dd></>}
              <dt className="text-tinta-3">Prioridad</dt><dd>{PRIORIDADES[p.prioridad as keyof typeof PRIORIDADES]}</dd>
              <dt className="text-tinta-3">Responsable</dt><dd>{p.responsable_nombre ?? '—'}</dd>
              {'canal' in p && <><dt className="text-tinta-3">Canal</dt><dd>{p.canal ?? '—'}</dd></>}
              <dt className="text-tinta-3">Boceto</dt><dd>{p.requiere_boceto ? (p.boceto_aprobado_at ? `Aprobado el ${fechaLarga(p.boceto_aprobado_at)}` : 'Pendiente de aprobación') : 'No requiere'}</dd>
            </dl>
            {p.observaciones && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-crema p-3 text-sm">{p.observaciones}</p>}
          </Tarjeta>

          <Tarjeta titulo="Historial">
            <ol className="space-y-2.5 text-sm">
              {(historial ?? []).map((h) => (
                <li key={h.id} className="border-l-2 border-oro-200 pl-3">
                  <div className="font-semibold">{h.item_id ? 'Producto → ' : ''}{ESTADOS[h.estado_nuevo as Estado]}</div>
                  <div className="text-xs text-tinta-3">{new Date(h.fecha).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' })} · {nombres[h.usuario_id] ?? 'Sistema'}</div>
                  {h.nota && <div className="text-xs">{h.nota}</div>}
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
