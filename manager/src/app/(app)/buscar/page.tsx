import Link from 'next/link';
import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { Encabezado, Tarjeta, Vacio } from '@/components/ui';
import { EstadoInsignia } from '@/components/pedido-chip';

export const metadata = { title: 'Buscar' };

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirRol(['administrador', 'contabilidad']);
  const q = ((await searchParams).q ?? '').replace(/[%,()]/g, '').trim();
  const supabase = await supabaseServer();
  const dig = q.replace(/\D/g, '');
  const [{ data: pedidos }, { data: clientes }] = q ? await Promise.all([
    supabase.from('v_pedidos').select('id, codigo, cliente_nombre, estado, total, saldo_pendiente').or(`codigo.ilike.%${q}%,cliente_nombre.ilike.%${q}%,numero_guia.ilike.%${q}%`).order('created_at', { ascending: false }).limit(20),
    supabase.from('clientes').select('id, codigo, nombre, whatsapp').or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%${dig.length >= 4 ? `,whatsapp.ilike.%${dig.replace(/^0/, '')}%,identificacion.ilike.%${dig}%` : ''}`).limit(20),
  ]) : [{ data: [] }, { data: [] }];
  return (
    <>
      <Encabezado titulo={`Resultados para “${q}”`} />
      <form className="mb-4"><input name="q" defaultValue={q} className="campo max-w-md" placeholder="Buscar pedido, cliente, guía, cédula o WhatsApp" autoFocus /></form>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo={`Pedidos (${pedidos?.length ?? 0})`}>
          {!pedidos?.length ? <Vacio>Sin pedidos.</Vacio> : <ul className="divide-y divide-[#f4ede2]">{pedidos.map((p) => (
            <li key={p.id}><Link href={`/pedidos/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-oro-50/60"><b>{p.codigo}</b><span className="flex-1 truncate">{p.cliente_nombre}</span><EstadoInsignia estado={p.estado} /><span className="cifra text-sm">{dinero(p.total)}</span></Link></li>
          ))}</ul>}
        </Tarjeta>
        <Tarjeta titulo={`Clientes (${clientes?.length ?? 0})`}>
          {!clientes?.length ? <Vacio>Sin clientes.</Vacio> : <ul className="divide-y divide-[#f4ede2]">{clientes.map((c) => (
            <li key={c.id}><Link href={`/clientes/${c.id}`} className="flex items-center gap-3 py-2.5 hover:bg-oro-50/60"><b>{c.nombre}</b><span className="text-xs text-tinta-3">{c.codigo}</span><span className="ml-auto text-sm">{c.whatsapp?.replace(/^593/, '0')}</span></Link></li>
          ))}</ul>}
        </Tarjeta>
      </div>
    </>
  );
}
