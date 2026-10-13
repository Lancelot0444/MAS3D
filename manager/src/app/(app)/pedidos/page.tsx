import Link from 'next/link';
import { CalendarDays, Columns3, List, Plus } from 'lucide-react';
import { exigirRol, esFinanzas } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaCorta, hoyEC } from '@/lib/fechas';
import { ACTIVOS, COLOR_ESTADO, ESTADOS, PRIORIDADES, type Estado } from '@/lib/dominio';
import { BotonLink, Encabezado, Tabla, td, th, Vacio, cx } from '@/components/ui';
import { EstadoInsignia, Vence } from '@/components/pedido-chip';
import { Kanban, type TarjetaPedido } from './kanban';

export const metadata = { title: 'Pedidos' };

const FILTROS = { activos: 'En curso', atrasados: 'Atrasados', por_cobrar: 'Por cobrar', cotizados: 'Cotizaciones', entregados: 'Entregados', cancelados: 'Cancelados', todos: 'Todos' } as const;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ vista?: string; filtro?: string; q?: string; mes?: string }> }) {
  const perfil = await exigirRol(['administrador', 'contabilidad', 'produccion']);
  const finanzas = esFinanzas(perfil.rol);
  const sp = await searchParams;
  const vista = sp.vista === 'tabla' || sp.vista === 'calendario' ? sp.vista : 'kanban';
  const filtro = (sp.filtro && sp.filtro in FILTROS ? sp.filtro : 'activos') as keyof typeof FILTROS;
  const q = (sp.q ?? '').replace(/[%,()]/g, '').trim();
  const supabase = await supabaseServer();
  const columnas = finanzas
    ? 'id, codigo, cliente_nombre, estado, prioridad, fecha_pedido, fecha_entrega_prometida, atrasado, total, saldo_pendiente, canal'
    : 'id, codigo, cliente_nombre, estado, prioridad, fecha_pedido, fecha_entrega_prometida, atrasado';
  let consulta = supabase.from(finanzas ? 'v_pedidos' : 'v_pedidos_produccion').select(columnas).limit(500);

  const hoy = hoyEC();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : hoy.slice(0, 7);
  if (vista === 'calendario') {
    const [a, m] = mes.split('-').map(Number);
    const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    consulta = consulta.gte('fecha_entrega_prometida', `${mes}-01`).lte('fecha_entrega_prometida', fin).neq('estado', 'cancelado');
  } else if (vista === 'kanban') {
    consulta = consulta.not('estado', 'in', '(entregado,cancelado,devolucion)');
  } else {
    if (filtro === 'activos') consulta = consulta.not('estado', 'in', '(cotizado,entregado,cancelado,devolucion)');
    if (filtro === 'atrasados') consulta = consulta.eq('atrasado', true);
    if (filtro === 'por_cobrar' && finanzas) consulta = consulta.gt('saldo_pendiente', 0);
    if (filtro === 'cotizados') consulta = consulta.eq('estado', 'cotizado');
    if (filtro === 'entregados') consulta = consulta.in('estado', ['entregado', 'enviado']);
    if (filtro === 'cancelados') consulta = consulta.in('estado', ['cancelado', 'devolucion']);
  }
  if (q) consulta = consulta.or(`codigo.ilike.%${q}%,cliente_nombre.ilike.%${q}%`);
  consulta = vista === 'tabla' && ['entregados', 'cancelados', 'todos'].includes(filtro)
    ? consulta.order('fecha_pedido', { ascending: false })
    : consulta.order('fecha_entrega_prometida', { ascending: true, nullsFirst: false });
  const { data } = await consulta;
  const pedidos = (data ?? []) as unknown as (TarjetaPedido & { fecha_pedido: string; canal?: string })[];

  const vistaLink = (v: string) => `/pedidos?vista=${v}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  return (
    <>
      <Encabezado titulo="Pedidos" acciones={finanzas && <BotonLink href="/pedidos/nuevo"><Plus className="size-4" />Nuevo pedido</BotonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-[#e3d8c7] bg-white p-1">
          {[['kanban', 'Tablero', Columns3], ['tabla', 'Tabla', List], ['calendario', 'Calendario', CalendarDays]].map(([v, t, I]) => {
            const Icono = I as typeof List;
            return <Link key={v as string} href={vistaLink(v as string)} className={cx('flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold', vista === v ? 'bg-tinta text-crema' : 'text-tinta-2')}><Icono className="size-4" />{t as string}</Link>;
          })}
        </div>
        <form className="flex basis-full gap-2 sm:basis-auto sm:flex-1">
          <input type="hidden" name="vista" value={vista} /><input type="hidden" name="filtro" value={filtro} />
          <input name="q" defaultValue={q} placeholder="Código o cliente" className="campo !min-h-10 sm:max-w-xs" />
        </form>
      </div>
      {vista === 'tabla' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(FILTROS).filter(([k]) => finanzas || k !== 'por_cobrar').map(([k, v]) => (
            <Link key={k} href={`/pedidos?vista=tabla&filtro=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={cx('rounded-full border px-3 py-1 text-sm font-semibold', filtro === k ? 'border-tinta bg-tinta text-crema' : 'border-[#e3d8c7] bg-white')}>{v}</Link>
          ))}
        </div>
      )}

      {vista === 'kanban' && <Kanban pedidos={pedidos} finanzas={finanzas} />}

      {vista === 'tabla' && (!pedidos.length ? <Vacio>No hay pedidos en esta vista.</Vacio> : (
        <div className="tarjeta p-2 sm:p-3">
          <Tabla>
            <thead><tr><th className={th}>Pedido</th><th className={th}>Cliente</th><th className={th}>Entrega</th><th className={th}>Estado</th><th className={th}>Prioridad</th>
              {finanzas && <><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Saldo</th></>}</tr></thead>
            <tbody>{pedidos.map((p) => (
              <tr key={p.id} className={cx('hover:bg-oro-50/50', p.atrasado && 'bg-red-50/60')}>
                <td className={td}><Link href={`/pedidos/${p.id}`} className="font-semibold hover:text-oro-700">{p.codigo}</Link></td>
                <td className={td}>{p.cliente_nombre}</td>
                <td className={td}><div className="flex flex-wrap items-center gap-1.5">{fechaCorta(p.fecha_entrega_prometida)}<Vence fecha={p.fecha_entrega_prometida} activo={ACTIVOS(p.estado)} /></div></td>
                <td className={td}><EstadoInsignia estado={p.estado} /></td>
                <td className={td}>{PRIORIDADES[p.prioridad as keyof typeof PRIORIDADES]}</td>
                {finanzas && <><td className={`${td} cifra text-right`}>{dinero(p.total)}</td><td className={`${td} cifra text-right ${Number(p.saldo_pendiente) > 0 ? 'font-semibold text-amber-700' : ''}`}>{dinero(p.saldo_pendiente)}</td></>}
              </tr>
            ))}</tbody>
          </Tabla>
        </div>
      ))}

      {vista === 'calendario' && <Calendario mes={mes} hoy={hoy} pedidos={pedidos} />}
    </>
  );
}

function Calendario({ mes, hoy, pedidos }: { mes: string; hoy: string; pedidos: TarjetaPedido[] }) {
  const [a, m] = mes.split('-').map(Number);
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const offset = (primero.getUTCDay() + 6) % 7;
  const celdas = Array.from({ length: Math.ceil((offset + dias) / 7) * 7 }, (_, i) => i - offset + 1);
  const ant = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
  const sig = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7);
  const porDia = (d: number) => pedidos.filter((p) => p.fecha_entrega_prometida === `${mes}-${String(d).padStart(2, '0')}`);
  return (
    <div className="tarjeta p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/pedidos?vista=calendario&mes=${ant}`} className="rounded-lg px-3 py-1.5 font-semibold hover:bg-crema-2">‹</Link>
        <h2 className="titulo-marca text-xl font-bold">{MESES[m - 1]} {a}</h2>
        <Link href={`/pedidos?vista=calendario&mes=${sig}`} className="rounded-lg px-3 py-1.5 font-semibold hover:bg-crema-2">›</Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-tinta-3">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          const valido = d >= 1 && d <= dias;
          const fecha = valido ? `${mes}-${String(d).padStart(2, '0')}` : '';
          const lista = valido ? porDia(d) : [];
          return (
            <div key={i} className={cx('min-h-20 rounded-lg border p-1 text-left sm:min-h-28', !valido && 'border-transparent', valido && 'border-[#f1e9dc] bg-white', fecha === hoy && 'border-oro-500 ring-1 ring-oro-300')}>
              {valido && <div className={cx('text-xs font-semibold', fecha === hoy ? 'text-oro-700' : 'text-tinta-3')}>{d}</div>}
              <div className="mt-0.5 space-y-0.5">
                {lista.slice(0, 4).map((p) => (
                  <Link key={p.id} href={`/pedidos/${p.id}`} title={`${p.codigo} · ${p.cliente_nombre} · ${ESTADOS[p.estado]}`}
                    className={cx('block truncate rounded px-1 py-0.5 text-[11px] font-semibold', p.atrasado ? 'bg-red-600 text-white' : COLOR_ESTADO[p.estado as Estado])}>
                    {p.codigo.slice(-4)} {p.cliente_nombre.split(' ')[0]}
                  </Link>
                ))}
                {lista.length > 4 && <div className="text-[11px] text-tinta-3">+{lista.length - 4} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
