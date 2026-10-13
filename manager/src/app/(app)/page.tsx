import Link from 'next/link';
import { AlertTriangle, CalendarClock, PackageCheck, Plus } from 'lucide-react';
import { exigirRol, esFinanzas } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { etiquetaPeriodo, fechaCorta, granularidad, hoyEC, rango, sumarDias } from '@/lib/fechas';
import { ACTIVOS, type Estado } from '@/lib/dominio';
import { Aviso, BotonLink, Encabezado, Indicador, Tarjeta, Vacio } from '@/components/ui';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { EstadoInsignia, Vence } from '@/components/pedido-chip';
import { DistribucionGastos, EvolucionVentas, IngresosVsGastos } from '@/components/graficos';

export const metadata = { title: 'Inicio' };

type Resumen = Record<string, number> & { hoy: Record<string, number> };

export default async function Inicio({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const perfil = await exigirRol();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: rp } = await supabase.rpc('resumen_pedidos');
  const ped = (rp ?? {}) as Record<string, number>;
  const limite = sumarDias(hoyEC(), 7);

  if (!esFinanzas(perfil.rol)) {
    const { data: proximos } = await supabase.from('v_pedidos_produccion').select('*')
      .not('estado', 'in', '(cotizado,entregado,cancelado,devolucion)').lte('fecha_entrega_prometida', limite)
      .order('fecha_entrega_prometida').limit(20);
    return (
      <>
        <Encabezado titulo={`Hola, ${perfil.nombre}`} subtitulo="Producción de hoy" />
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Indicador etiqueta="Pedidos activos" valor={ped.activos ?? 0} href="/pedidos" />
          <Indicador etiqueta="En producción" valor={ped.en_produccion ?? 0} href="/pedidos" />
          <Indicador etiqueta="Atrasados" valor={ped.atrasados ?? 0} tono={ped.atrasados ? 'mal' : 'normal'} href="/pedidos?vista=tabla&filtro=atrasados" />
          <Indicador etiqueta="Listos para entregar" valor={ped.listos ?? 0} tono="oro" href="/pedidos" />
        </div>
        <ListaEntregas pedidos={proximos ?? []} conDinero={false} />
      </>
    );
  }

  const { periodo, desde, hasta } = rango(sp.periodo, sp.desde, sp.hasta);
  const g = granularidad(desde, hasta);
  const [{ data: r }, { data: serie }, { data: cats }, { data: proximos }, { data: listosConSaldo }, { data: cfg }, { data: cuentas }] = await Promise.all([
    supabase.rpc('resumen_financiero', { p_desde: desde, p_hasta: hasta }),
    supabase.rpc('serie_financiera', { p_desde: desde, p_hasta: hasta, p_granularidad: g }),
    supabase.rpc('gastos_por_categoria', { p_desde: desde, p_hasta: hasta }),
    supabase.from('v_pedidos').select('*').not('estado', 'in', '(cotizado,entregado,cancelado,devolucion)')
      .lte('fecha_entrega_prometida', limite).order('fecha_entrega_prometida').limit(10),
    supabase.from('v_pedidos').select('id, codigo, cliente_nombre, saldo_pendiente').in('estado', ['listo_entrega', 'enviado', 'entregado']).gt('saldo_pendiente', 0).limit(10),
    supabase.from('configuracion').select('config_tributaria_confirmada').single(),
    supabase.from('v_cuentas_saldo').select('id, tiene_apertura').eq('activa', true),
  ]);
  const res = (r ?? {}) as Resumen;
  const puntos = (serie ?? []).map((s: { periodo: string; ventas: number; cobrado: number; gastos: number }) => ({
    etiqueta: etiquetaPeriodo(s.periodo, g), ventas: Number(s.ventas), cobrado: Number(s.cobrado), gastos: Number(s.gastos),
  }));
  const sinApertura = (cuentas ?? []).filter((c) => !c.tiene_apertura).length;

  return (
    <>
      <Encabezado titulo={`Hola, ${perfil.nombre}`} subtitulo="Resumen del negocio"
        acciones={<><BotonLink href="/pedidos/nuevo"><Plus className="size-4" />Pedido</BotonLink><BotonLink href="/finanzas/gasto" variante="borde">Registrar gasto</BotonLink></>} />

      <div className="mb-5 space-y-2">
        {(cuentas ?? []).length === 0 && (
          <Aviso tipo="alerta">Para empezar, crea tus cuentas de dinero (caja, banco, Deuna…) y registra su saldo real en <Link className="font-semibold underline" href="/finanzas/cuentas">Finanzas → Cuentas</Link>.</Aviso>
        )}
        {sinApertura > 0 && (cuentas ?? []).length > 0 && (
          <Aviso tipo="alerta">{sinApertura} cuenta(s) aún no tienen saldo inicial. <Link className="font-semibold underline" href="/finanzas/cuentas">Registrarlo</Link></Aviso>
        )}
        {cfg && !cfg.config_tributaria_confirmada && (
          <Aviso tipo="info">La configuración del IVA está <b>pendiente de confirmar con su contador</b>. <Link className="font-semibold underline" href="/configuracion">Revisar</Link></Aviso>
        )}
        {(listosConSaldo ?? []).length > 0 && (
          <Aviso tipo="error">
            <b>Saldo por cobrar en pedidos listos o entregados:</b>{' '}
            {(listosConSaldo ?? []).map((p, i) => (
              <span key={p.id}>{i > 0 && ', '}<Link href={`/pedidos/${p.id}`} className="font-semibold underline">{p.codigo}</Link> ({p.cliente_nombre}: {dinero(p.saldo_pendiente)})</span>
            ))}
          </Aviso>
        )}
        {res.gastos_vencidos > 0 && <Aviso tipo="alerta">{res.gastos_vencidos} cuenta(s) por pagar vencidas. <Link className="font-semibold underline" href="/finanzas/por-pagar">Ver</Link></Aviso>}
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-tinta-3">Hoy</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Ventas de hoy" valor={dinero(res.hoy?.ventas_realizadas)} detalle="Pedidos entregados/enviados" />
        <Indicador etiqueta="Cobrado hoy" valor={dinero(res.hoy?.cobrado)} tono="bien" />
        <Indicador etiqueta="Gastos de hoy" valor={dinero(res.hoy?.gastos)} />
        <Indicador etiqueta="Caja y bancos" valor={dinero(res.caja_bancos)} tono="oro" href="/finanzas/cuentas" detalle="Saldo disponible" />
      </div>

      <SelectorPeriodo ruta="/" periodo={periodo} desde={desde} hasta={hasta} />
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Ventas realizadas" valor={dinero(res.ventas_realizadas)} detalle="Entregadas o enviadas" />
        <Indicador etiqueta="Ventas pactadas" valor={dinero(res.ventas_pactadas)} detalle={`${res.pedidos_nuevos ?? 0} pedidos confirmados`} />
        <Indicador etiqueta="Cobrado" valor={dinero(res.cobrado)} tono="bien" detalle="Incluye anticipos" />
        <Indicador etiqueta="Gastos" valor={dinero(res.gastos_total)} detalle={res.inversiones ? `+ ${dinero(res.inversiones)} en inversiones` : undefined} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Utilidad bruta" valor={dinero(res.utilidad_bruta)} tono={res.utilidad_bruta < 0 ? 'mal' : 'normal'} detalle="Ventas − costos directos" />
        <Indicador etiqueta="Utilidad operativa" valor={dinero(res.utilidad_operativa)} tono={res.utilidad_operativa < 0 ? 'mal' : 'normal'} detalle="− gastos operativos" />
        <Indicador etiqueta="Utilidad neta" valor={dinero(res.utilidad_neta)} tono={res.utilidad_neta < 0 ? 'mal' : 'bien'} detalle="Preliminar: sin impuesto a la renta" />
        <Indicador etiqueta="Anticipos recibidos" valor={dinero(res.saldos_a_favor_clientes)} detalle="Dinero de pedidos aún no entregados" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Por cobrar" valor={dinero(res.por_cobrar)} tono="alerta" href="/pedidos?vista=tabla&filtro=por_cobrar" detalle="Saldos de pedidos activos" />
        <Indicador etiqueta="Por pagar" valor={dinero(res.por_pagar)} href="/finanzas/por-pagar" detalle="Proveedores" />
        <Indicador etiqueta="Préstamos" valor={dinero(res.prestamos)} detalle="Saldo de deudas registradas" />
        <Indicador etiqueta="Pedidos" valor={`${ped.activos ?? 0} activos`} detalle={`${ped.atrasados ?? 0} atrasados · ${ped.listos ?? 0} listos`} tono={ped.atrasados ? 'mal' : 'normal'} href="/pedidos" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Cobrado vs. gastos">{puntos.length ? <IngresosVsGastos datos={puntos} /> : <Vacio>Sin movimientos en este período.</Vacio>}</Tarjeta>
        <Tarjeta titulo="Evolución de ventas">{puntos.length ? <EvolucionVentas datos={puntos} /> : <Vacio>Sin ventas en este período.</Vacio>}</Tarjeta>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListaEntregas pedidos={proximos ?? []} conDinero />
        <Tarjeta titulo="Distribución de gastos">
          {(cats ?? []).length ? <DistribucionGastos datos={(cats ?? []).map((c: { categoria: string; total: number }) => ({ categoria: c.categoria, total: Number(c.total) }))} />
            : <Vacio>Sin gastos en este período.</Vacio>}
        </Tarjeta>
      </div>
    </>
  );
}

type PedidoLista = { id: string; codigo: string; cliente_nombre: string; estado: Estado; fecha_entrega_prometida: string | null; saldo_pendiente?: number; atrasado: boolean };

function ListaEntregas({ pedidos, conDinero }: { pedidos: PedidoLista[]; conDinero: boolean }) {
  return (
    <Tarjeta titulo={<span className="flex items-center gap-2"><CalendarClock className="size-5 text-oro-600" />Próximas entregas (7 días)</span>}
      accion={<Link href="/pedidos?vista=calendario" className="text-sm font-semibold text-oro-700">Calendario</Link>}>
      {pedidos.length === 0 ? <Vacio>No hay entregas pendientes en los próximos 7 días.</Vacio> : (
        <ul className="divide-y divide-[#f4ede2]">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link href={`/pedidos/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-oro-50/60">
                {p.atrasado ? <AlertTriangle className="size-5 shrink-0 text-red-600" /> : <PackageCheck className="size-5 shrink-0 text-oro-600" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><b>{p.codigo}</b><span className="truncate text-tinta-2">{p.cliente_nombre}</span></div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-tinta-3">
                    {fechaCorta(p.fecha_entrega_prometida)} <EstadoInsignia estado={p.estado} /> <Vence fecha={p.fecha_entrega_prometida} activo={ACTIVOS(p.estado)} />
                  </div>
                </div>
                {conDinero && Number(p.saldo_pendiente) > 0 && <span className="cifra text-sm font-semibold text-amber-700">Debe {dinero(p.saldo_pendiente)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
