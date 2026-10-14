import Link from 'next/link';
import { Plus } from 'lucide-react';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { fechaLarga } from '@/lib/fechas';
import { BotonLink, Encabezado, Insignia, Tabla, td, th, Vacio, cx } from '@/components/ui';

export const metadata = { title: 'Clientes' };

const FILTROS = { todos: 'Todos', frecuentes: 'Frecuentes', corporativos: 'Corporativos', con_saldo: 'Con saldo', vencidos: 'Saldo vencido' } as const;

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const { q = '', f = 'todos' } = await searchParams;
  const supabase = await supabaseServer();
  let consulta = supabase.from('v_clientes').select('*').eq('activo', true).order('nombre').limit(300);
  if (q) consulta = consulta.or(`nombre.ilike.%${q.replace(/[%,()]/g, '')}%,codigo.ilike.%${q.replace(/[%,()]/g, '')}%,whatsapp.ilike.%${q.replace(/\D/g, '') || '§'}%,identificacion.ilike.%${q.replace(/[%,()]/g, '')}%`);
  if (f === 'frecuentes') consulta = consulta.eq('frecuente', true);
  if (f === 'corporativos') consulta = consulta.eq('tipo', 'corporativo');
  if (f === 'con_saldo') consulta = consulta.gt('saldo_pendiente', 0);
  if (f === 'vencidos') consulta = consulta.gt('saldo_vencido', 0);
  const { data: clientes } = await consulta;

  return (
    <>
      <Encabezado titulo="Clientes" subtitulo={`${clientes?.length ?? 0} clientes`} acciones={<BotonLink href="/clientes/nuevo"><Plus className="size-4" />Nuevo cliente</BotonLink>} />
      <form className="mb-3 flex gap-2">
        <input type="hidden" name="f" value={f} />
        <input name="q" defaultValue={q} placeholder="Nombre, código, WhatsApp o cédula" className="campo max-w-md" />
        <button className="rounded-xl border border-[#e3d8c7] bg-white px-4 font-semibold">Buscar</button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(FILTROS).map(([k, v]) => (
          <Link key={k} href={`/clientes?f=${k}&q=${encodeURIComponent(q)}`} className={cx('rounded-full border px-3 py-1 text-sm font-semibold', f === k ? 'border-tinta bg-tinta text-crema' : 'border-[#e3d8c7] bg-white')}>{v}</Link>
        ))}
      </div>
      {!clientes?.length ? <Vacio accion={<BotonLink href="/clientes/nuevo">Registrar cliente</BotonLink>}>No hay clientes que coincidan.</Vacio> : (
        <div className="tarjeta p-2 sm:p-3">
          <Tabla>
            <thead><tr><th className={th}>Cliente</th><th className={th}>WhatsApp</th><th className={th}>Pedidos</th><th className={`${th} text-right`}>Comprado</th><th className={`${th} text-right`}>Saldo</th><th className={th}>Último pedido</th></tr></thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-oro-50/50">
                  <td className={td}>
                    <Link href={`/clientes/${c.id}`} className="font-semibold hover:text-oro-700">{c.nombre}</Link>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-tinta-3">{c.codigo}
                      {c.frecuente && <Insignia className="bg-oro-100 text-oro-900">Frecuente</Insignia>}
                      {c.tipo === 'corporativo' && <Insignia className="bg-tinta text-crema">Corporativo</Insignia>}
                      {Number(c.saldo_vencido) > 0 && <Insignia className="bg-red-100 text-red-800">Saldo vencido</Insignia>}
                    </div>
                  </td>
                  <td className={td}>{c.whatsapp ? <a className="text-emerald-700 underline" href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener">{c.whatsapp.replace(/^593/, '0')}</a> : '—'}</td>
                  <td className={`${td} cifra`}>{c.n_pedidos}</td>
                  <td className={`${td} cifra text-right`}>{dinero(c.total_comprado)}</td>
                  <td className={`${td} cifra text-right font-semibold ${Number(c.saldo_pendiente) > 0 ? 'text-amber-700' : ''}`}>{dinero(c.saldo_pendiente)}</td>
                  <td className={td}>{fechaLarga(c.ultimo_pedido)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}
    </>
  );
}
