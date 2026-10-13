import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { Encabezado, Tabla, td, th } from '@/components/ui';

export const metadata = { title: 'Auditoría' };
const TABLAS: Record<string, string> = { pedidos: 'Pedido', pedido_items: 'Producto de pedido', clientes: 'Cliente', transacciones: 'Movimiento', gastos: 'Gasto', cuentas: 'Cuenta', perfiles: 'Usuario', configuracion: 'Configuración', categorias_gasto: 'Categoría', proveedores: 'Proveedor', invitaciones: 'Invitación', adjuntos: 'Archivo' };
const ACC: Record<string, string> = { INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó' };

export default async function Auditoria() {
  await exigirRol(['administrador']);
  const supabase = await supabaseServer();
  const [{ data }, { data: equipo }] = await Promise.all([
    supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(200),
    supabase.from('perfiles').select('id, nombre'),
  ]);
  const nombres = Object.fromEntries((equipo ?? []).map((u) => [u.id, u.nombre]));
  const resumen = (a: { antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }) => {
    const d = a.despues ?? a.antes ?? {};
    const ref = (d.codigo ?? d.nombre ?? d.descripcion ?? d.email ?? (d.numero ? `#${d.numero}` : '')) as string;
    if (!a.antes || !a.despues) return ref;
    const cambios = Object.keys(a.despues).filter((k) => !['updated_at', 'created_at'].includes(k) && JSON.stringify(a.antes![k]) !== JSON.stringify(a.despues![k]));
    return `${ref} — ${cambios.slice(0, 5).join(', ')}`;
  };
  return (
    <>
      <Encabezado titulo="Auditoría" subtitulo="Últimos 200 cambios: quién, qué y cuándo. Este registro no se puede editar." />
      <div className="tarjeta p-2 sm:p-3">
        <Tabla>
          <thead><tr><th className={th}>Fecha</th><th className={th}>Usuario</th><th className={th}>Acción</th><th className={th}>Detalle</th></tr></thead>
          <tbody>{(data ?? []).map((a) => (
            <tr key={a.id}>
              <td className={`${td} whitespace-nowrap text-xs`}>{new Date(a.fecha).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'short', timeStyle: 'short' })}</td>
              <td className={td}>{nombres[a.usuario_id] ?? 'Sistema'}</td>
              <td className={td}>{ACC[a.accion]} {TABLAS[a.tabla] ?? a.tabla}</td>
              <td className={`${td} text-xs text-tinta-3`}>{resumen(a)}</td>
            </tr>
          ))}</tbody>
        </Tabla>
      </div>
    </>
  );
}
