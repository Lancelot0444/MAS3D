import Link from 'next/link';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaLarga, rango } from '@/lib/fechas';
import { TIPOS_TX, METODOS } from '@/lib/dominio';
import { Encabezado, Indicador, Tabla, td, th, Vacio, cx } from '@/components/ui';
import { SelectorPeriodo } from '@/components/selector-periodo';
import { BotonAnular } from '../pedidos/[id]/controles';

export const metadata = { title: 'Finanzas' };

export default async function Movimientos({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const perfil = await exigirRol(['administrador', 'contabilidad']);
  const sp = await searchParams;
  const { periodo, desde, hasta } = rango(sp.periodo, sp.desde, sp.hasta);
  const supabase = await supabaseServer();
  let q = supabase.from('v_movimientos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(500);
  if (sp.cuenta) q = q.eq('cuenta_id', sp.cuenta);
  if (sp.tipo) q = q.eq('tipo', sp.tipo);
  const [{ data: movs }, { data: cuentas }] = await Promise.all([q, supabase.from('v_cuentas_saldo').select('id, nombre, saldo').order('orden')]);
  const validos = (movs ?? []).filter((m) => !m.anulada && m.tipo !== 'anulacion');
  const entradas = validos.reduce((s, m) => s + Number(m.entrada), 0);
  const salidas = validos.reduce((s, m) => s + Number(m.salida), 0);
  const internos = new Set(['transferencia']);

  return (
    <>
      <Encabezado titulo="Movimientos de dinero" subtitulo="Todo lo que entra y sale de caja y bancos" />
      <SelectorPeriodo ruta="/finanzas" periodo={periodo} desde={desde} hasta={hasta} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador etiqueta="Entradas" valor={dinero(entradas)} tono="bien" detalle="Incluye transferencias internas" />
        <Indicador etiqueta="Salidas" valor={dinero(salidas)} tono="mal" />
        <Indicador etiqueta="Flujo neto" valor={dinero(entradas - salidas)} />
        <Indicador etiqueta="Saldo total actual" valor={dinero((cuentas ?? []).reduce((s, c) => s + Number(c.saldo), 0))} tono="oro" href="/finanzas/cuentas" />
      </div>
      <form className="mb-3 flex flex-wrap gap-2">
        <input type="hidden" name="periodo" value={periodo} /><input type="hidden" name="desde" value={desde} /><input type="hidden" name="hasta" value={hasta} />
        <select name="cuenta" defaultValue={sp.cuenta ?? ''} className="campo !w-auto"><option value="">Todas las cuentas</option>{(cuentas ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <select name="tipo" defaultValue={sp.tipo ?? ''} className="campo !w-auto"><option value="">Todos los tipos</option>{Object.entries(TIPOS_TX).filter(([k]) => !['venta', 'reversion_venta', 'retencion_anticipo'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="rounded-xl border border-[#e3d8c7] bg-white px-4 font-semibold">Filtrar</button>
      </form>
      {!movs?.length ? <Vacio>No hay movimientos en este período.</Vacio> : (
        <div className="tarjeta p-2 sm:p-3">
          <Tabla>
            <thead><tr><th className={th}>#</th><th className={th}>Fecha</th><th className={th}>Detalle</th><th className={th}>Cuenta</th><th className={`${th} text-right`}>Entrada</th><th className={`${th} text-right`}>Salida</th><th className={th}></th></tr></thead>
            <tbody>{movs.map((m) => (
              <tr key={`${m.transaccion_id}-${m.cuenta_id}`} className={cx(m.anulada && 'text-tinta-3 line-through', m.tipo === 'anulacion' && 'text-tinta-3 italic')}>
                <td className={`${td} cifra`}>{m.numero}</td>
                <td className={`${td} whitespace-nowrap`}>{fechaLarga(m.fecha)}</td>
                <td className={td}>
                  <div className="font-semibold">{TIPOS_TX[m.tipo]}{internos.has(m.tipo) && <span className="ml-1 text-xs font-normal text-tinta-3">(interno)</span>}</div>
                  <div className="text-xs text-tinta-3">
                    {m.pedido_codigo && <Link href={`/pedidos/${m.pedido_id}`} className="underline">{m.pedido_codigo}</Link>} {m.cliente_nombre ?? m.proveedor_nombre ?? ''} {m.descripcion}
                    {m.metodo_pago && ` · ${METODOS[m.metodo_pago as keyof typeof METODOS]}`} · {m.creado_por_nombre}
                    {m.anulada && m.motivo_anulacion && <span className="no-underline"> · Anulado: {m.motivo_anulacion}</span>}
                  </div>
                </td>
                <td className={td}>{m.cuenta_nombre}</td>
                <td className={`${td} cifra text-right text-emerald-700`}>{Number(m.entrada) > 0 ? dinero(m.entrada) : ''}</td>
                <td className={`${td} cifra text-right text-red-700`}>{Number(m.salida) > 0 ? dinero(m.salida) : ''}</td>
                <td className={`${td} text-right`}>{perfil.rol === 'administrador' && !m.anulada && !['anulacion', 'venta', 'reversion_venta'].includes(m.tipo) && <BotonAnular id={m.transaccion_id} />}</td>
              </tr>
            ))}</tbody>
          </Tabla>
        </div>
      )}
      <p className="mt-3 text-xs text-tinta-3">Los movimientos no se borran: un error se corrige anulándolo (solo administradores) y queda registrado quién y por qué.</p>
    </>
  );
}
