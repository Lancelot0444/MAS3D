'use client';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Truck, UserPlus } from 'lucide-react';
import { guardarPedido, type PedidoEntrada } from './actions';
import { Aviso, Boton, Campo, cx } from '@/components/ui';
import { calcularLinea, dinero, porcentaje, sumar } from '@/lib/money';
import { CANALES, MODALIDADES, PRIORIDADES, TIPOS_PRODUCTO } from '@/lib/dominio';

type Cliente = { id: string; codigo: string; nombre: string; whatsapp: string | null };
type Config = { iva_activo: boolean; iva_tarifa: number; precios_incluyen_iva: boolean; anticipo_porcentaje: number; envio_referencial: number; dias_fabricacion: number };
type Linea = { key: string; id?: string; es_envio: boolean; tipo_producto: string; descripcion: string; cantidad: string; tamano: string; material: string; colores: string; precio_unitario: string; descuento: string };
export type PedidoExistente = Omit<PedidoEntrada, 'items' | 'idempotency_key'> & { id: string; codigo: string; venta_reconocida: boolean; items: (Omit<Linea, 'key' | 'cantidad' | 'precio_unitario' | 'descuento'> & { cantidad: number; precio_unitario: number; descuento: number })[] };

const nuevaLinea = (envio = false, precio = ''): Linea => ({
  key: crypto.randomUUID(), es_envio: envio, tipo_producto: envio ? 'Envío' : '', descripcion: envio ? 'Envío' : '', cantidad: '1',
  tamano: '', material: '', colores: '', precio_unitario: precio, descuento: '',
});

function sumarLaborables(desde: string, dias: number) {
  const d = new Date(`${desde}T12:00:00Z`);
  let n = 0;
  while (n < dias) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++; }
  return d.toISOString().slice(0, 10);
}

export function FormPedido({ clientes, perfiles, config, hoy, pedido, clienteInicial }: {
  clientes: Cliente[]; perfiles: { id: string; nombre: string }[]; config: Config; hoy: string; pedido?: PedidoExistente; clienteInicial?: string;
}) {
  const router = useRouter();
  const [idem] = useState(() => crypto.randomUUID());
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState(pedido?.cliente_id ?? clienteInicial ?? '');
  const [busca, setBusca] = useState('');
  const [fechaPedido, setFechaPedido] = useState(pedido?.fecha_pedido ?? hoy);
  const [entrega, setEntrega] = useState(pedido?.fecha_entrega_prometida ?? sumarLaborables(hoy, config.dias_fabricacion));
  const [modalidad, setModalidad] = useState<string>(pedido?.modalidad_entrega ?? 'retiro_local');
  const [lineas, setLineas] = useState<Linea[]>(() => pedido?.items.length
    ? pedido.items.map((i) => ({ ...i, key: crypto.randomUUID(), cantidad: String(i.cantidad), precio_unitario: String(i.precio_unitario), descuento: i.descuento ? String(i.descuento) : '', tamano: i.tamano ?? '', material: i.material ?? '', colores: i.colores ?? '' }))
    : [nuevaLinea()]);
  const bloqueado = !!pedido?.venta_reconocida;

  const cliente = clientes.find((c) => c.id === clienteId);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    const dig = q.replace(/\D/g, '');
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || (dig.length >= 4 && c.whatsapp?.includes(dig))).slice(0, 8);
  }, [busca, clientes]);

  const tarifa = config.iva_activo ? Number(config.iva_tarifa) : 0;
  const calculos = lineas.map((l) => {
    try {
      return calcularLinea({ cantidad: Number(l.cantidad) || 0, precio_unitario: Number(l.precio_unitario) || 0, descuento: Number(l.descuento) || 0, tarifa_iva: tarifa, precio_incluye_iva: config.precios_incluyen_iva });
    } catch { return null; }
  });
  const total = sumar(...calculos.map((c) => c?.total ?? 0));
  const iva = sumar(...calculos.map((c) => c?.iva ?? 0));
  const anticipo = porcentaje(total, Number(config.anticipo_porcentaje));
  const tieneEnvio = lineas.some((l) => l.es_envio);

  const cambiar = (key: string, campo: keyof Linea, valor: string) => setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? '').trim();
    const datos: PedidoEntrada = {
      id: pedido?.id, idempotency_key: idem, cliente_id: clienteId, fecha_pedido: fechaPedido, fecha_entrega_prometida: entrega || undefined,
      estado: (g('estado') || undefined) as PedidoEntrada['estado'], prioridad: g('prioridad') as PedidoEntrada['prioridad'],
      responsable_id: g('responsable_id') || undefined, canal: g('canal') || undefined, modalidad_entrega: modalidad as PedidoEntrada['modalidad_entrega'],
      direccion_envio: g('direccion_envio') || undefined, transportista: g('transportista') || undefined, numero_guia: g('numero_guia') || undefined,
      requiere_boceto: f.get('requiere_boceto') === 'on', observaciones: g('observaciones') || undefined,
      items: lineas.map((l) => ({ id: l.id, es_envio: l.es_envio, tipo_producto: l.tipo_producto, descripcion: l.descripcion, cantidad: l.cantidad || '1',
        tamano: l.tamano || undefined, material: l.material || undefined, colores: l.colores || undefined, precio_unitario: l.precio_unitario || '0', descuento: l.descuento || '0' })),
    };
    if (!clienteId) { setError('Selecciona un cliente.'); return; }
    if (calculos.some((c) => c === null)) { setError('Hay un descuento mayor que el valor de su producto.'); return; }
    iniciar(async () => {
      const r = await guardarPedido(datos);
      if (!r.ok) { setError(r.error); return; }
      router.push(`/pedidos/${r.datos}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {bloqueado && <Aviso tipo="info">La venta de este pedido ya está registrada: solo puedes cambiar datos de entrega y observaciones. Para cambiar precios, primero márcalo como devolución.</Aviso>}

      <section className="tarjeta p-5">
        <h2 className="mb-3 font-bold">Cliente</h2>
        {cliente ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-crema p-3">
            <div className="flex-1"><div className="font-semibold">{cliente.nombre}</div><div className="text-xs text-tinta-3">{cliente.codigo}{cliente.whatsapp && ` · ${cliente.whatsapp.replace(/^593/, '0')}`}</div></div>
            {!bloqueado && <Boton type="button" variante="borde" chico onClick={() => setClienteId('')}>Cambiar</Boton>}
          </div>
        ) : (
          <div className="relative">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca por nombre, código o WhatsApp" className="campo" autoFocus aria-label="Buscar cliente" />
            {filtrados.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[#e3d8c7] bg-white shadow-lg">
                {filtrados.map((c) => (
                  <li key={c.id}><button type="button" onClick={() => { setClienteId(c.id); setBusca(''); }} className="block w-full px-4 py-2.5 text-left hover:bg-oro-50">
                    <b>{c.nombre}</b> <span className="text-xs text-tinta-3">{c.codigo}</span></button></li>
                ))}
              </ul>
            )}
            <Link href="/clientes/nuevo?volver=pedido" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-oro-700"><UserPlus className="size-4" />Registrar cliente nuevo</Link>
          </div>
        )}
      </section>

      <section className="tarjeta p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Productos</h2>
          {tarifa > 0 && <span className="text-xs text-tinta-3">Precios {config.precios_incluyen_iva ? 'con' : 'más'} IVA {tarifa}%</span>}</div>
        <div className="space-y-3">
          {lineas.map((l, i) => (
            <div key={l.key} className={cx('rounded-xl border p-3', l.es_envio ? 'border-sky-200 bg-sky-50/40' : 'border-[#efe6d8]')}>
              <div className="grid gap-3 sm:grid-cols-12">
                {!l.es_envio && (
                  <Campo etiqueta="Tipo" className="sm:col-span-3">
                    <input list="tipos" value={l.tipo_producto} onChange={(e) => cambiar(l.key, 'tipo_producto', e.target.value)} disabled={bloqueado} className="campo" />
                  </Campo>
                )}
                <Campo etiqueta={l.es_envio ? 'Envío' : 'Descripción *'} className={l.es_envio ? 'sm:col-span-7' : 'sm:col-span-4'}>
                  <input value={l.descripcion} onChange={(e) => cambiar(l.key, 'descripcion', e.target.value)} required className="campo" placeholder={l.es_envio ? '' : 'Ej: Funko de pareja con su perrito'} />
                </Campo>
                {!l.es_envio && (
                  <Campo etiqueta="Cant." className="sm:col-span-1">
                    <input value={l.cantidad} onChange={(e) => cambiar(l.key, 'cantidad', e.target.value)} inputMode="decimal" disabled={bloqueado} className="campo" />
                  </Campo>
                )}
                <Campo etiqueta={l.es_envio ? 'Costo cobrado' : 'Precio unit.'} className="sm:col-span-2">
                  <input value={l.precio_unitario} onChange={(e) => cambiar(l.key, 'precio_unitario', e.target.value)} inputMode="decimal" disabled={bloqueado} className="campo" placeholder="0.00" />
                </Campo>
                <Campo etiqueta="Descuento $" className="sm:col-span-2">
                  <input value={l.descuento} onChange={(e) => cambiar(l.key, 'descuento', e.target.value)} inputMode="decimal" disabled={bloqueado} className="campo" placeholder="0.00" />
                </Campo>
                {!l.es_envio && (<>
                  <Campo etiqueta="Tamaño" className="sm:col-span-3"><input value={l.tamano} onChange={(e) => cambiar(l.key, 'tamano', e.target.value)} className="campo" placeholder="Ej: 13 cm" /></Campo>
                  <Campo etiqueta="Material" className="sm:col-span-3"><input value={l.material} onChange={(e) => cambiar(l.key, 'material', e.target.value)} className="campo" placeholder="Ej: PLA+" /></Campo>
                  <Campo etiqueta="Colores" className="sm:col-span-4"><input value={l.colores} onChange={(e) => cambiar(l.key, 'colores', e.target.value)} className="campo" /></Campo>
                </>)}
                <div className="flex items-end justify-between gap-2 sm:col-span-2">
                  <span className="cifra pb-3 text-sm font-bold">{calculos[i] ? dinero(calculos[i]!.total) : <span className="text-red-700">Revisar</span>}</span>
                  {!bloqueado && lineas.length > 1 && (
                    <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))} className="mb-1.5 rounded-lg p-2 text-tinta-3 hover:bg-red-50 hover:text-red-700" aria-label="Quitar producto"><Trash2 className="size-4" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <datalist id="tipos">{TIPOS_PRODUCTO.map((t) => <option key={t} value={t} />)}</datalist>
        {!bloqueado && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton type="button" variante="borde" chico onClick={() => setLineas((ls) => [...ls.filter((x) => !x.es_envio), nuevaLinea(), ...ls.filter((x) => x.es_envio)])}><Plus className="size-4" />Agregar producto</Boton>
            {!tieneEnvio && <Boton type="button" variante="borde" chico onClick={() => setLineas((ls) => [...ls, nuevaLinea(true, String(config.envio_referencial))])}><Truck className="size-4" />Agregar envío ({dinero(config.envio_referencial)})</Boton>}
          </div>
        )}
        <div className="mt-4 grid gap-1 rounded-xl bg-crema p-4 text-sm sm:ml-auto sm:max-w-xs">
          {iva > 0 && <div className="flex justify-between"><span>IVA incluido</span><span className="cifra">{dinero(iva)}</span></div>}
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="cifra">{dinero(total)}</span></div>
          <div className="flex justify-between text-tinta-3"><span>Anticipo sugerido ({Number(config.anticipo_porcentaje)}%)</span><span className="cifra">{dinero(anticipo)}</span></div>
          <div className="flex justify-between text-tinta-3"><span>Saldo contra entrega</span><span className="cifra">{dinero(sumar(total, -anticipo))}</span></div>
        </div>
      </section>

      <section className="tarjeta p-5">
        <h2 className="mb-3 font-bold">Producción y entrega</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Fecha del pedido"><input type="date" value={fechaPedido} onChange={(e) => setFechaPedido(e.target.value)} className="campo" /></Campo>
          <Campo etiqueta="Entrega prometida" ayuda={`Sugerida: ${config.dias_fabricacion} días laborables`}>
            <input type="date" value={entrega} min={fechaPedido} onChange={(e) => setEntrega(e.target.value)} className="campo" />
          </Campo>
          {!pedido && (
            <Campo etiqueta="Estado inicial">
              <select name="estado" defaultValue="confirmado" className="campo"><option value="confirmado">Confirmado</option><option value="cotizado">Solo cotización</option></select>
            </Campo>
          )}
          <Campo etiqueta="Prioridad"><select name="prioridad" defaultValue={pedido?.prioridad ?? 'normal'} className="campo">{Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          <Campo etiqueta="Responsable"><select name="responsable_id" defaultValue={pedido?.responsable_id ?? ''} className="campo"><option value="">—</option>{perfiles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
          <Campo etiqueta="Canal de venta"><select name="canal" defaultValue={pedido?.canal ?? ''} className="campo"><option value="">—</option>{CANALES.map((c) => <option key={c}>{c}</option>)}</select></Campo>
          <Campo etiqueta="Modalidad de entrega"><select value={modalidad} onChange={(e) => setModalidad(e.target.value)} className="campo">{Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          {modalidad !== 'retiro_local' && (<>
            <Campo etiqueta="Dirección de envío" className="sm:col-span-2"><input name="direccion_envio" defaultValue={pedido?.direccion_envio ?? ''} className="campo" /></Campo>
            <Campo etiqueta="Transportista"><input name="transportista" defaultValue={pedido?.transportista ?? (modalidad === 'servientrega' ? 'Servientrega' : '')} className="campo" /></Campo>
            <Campo etiqueta="Número de guía"><input name="numero_guia" defaultValue={pedido?.numero_guia ?? ''} className="campo" /></Campo>
          </>)}
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold sm:col-span-3">
            <input type="checkbox" name="requiere_boceto" defaultChecked={pedido?.requiere_boceto ?? false} className="size-5 accent-oro-600" />Requiere boceto digital para aprobación del cliente
          </label>
          <Campo etiqueta="Observaciones" className="sm:col-span-3"><textarea name="observaciones" rows={3} defaultValue={pedido?.observaciones ?? ''} className="campo" placeholder="Detalles de personalización, caja MDF, dedicatoria…" /></Campo>
        </div>
      </section>

      <div className="no-imprimir sticky bottom-16 z-10 flex gap-2 rounded-2xl border border-[#efe6d8] bg-white/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <Boton type="submit" disabled={pendiente} className="flex-1 sm:flex-none">{pendiente ? 'Guardando…' : pedido ? 'Guardar cambios' : 'Crear pedido'}</Boton>
        <span className="cifra ml-auto self-center font-bold">{dinero(total)}</span>
      </div>
    </form>
  );
}
