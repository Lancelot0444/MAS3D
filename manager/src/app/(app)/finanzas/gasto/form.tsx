'use client';
import { dinero } from '@/lib/money';
import { useState } from 'react';
import { FormAccion } from '@/components/form-accion';
import { Campo, cx } from '@/components/ui';
import { CLASIFICACIONES, METODOS } from '@/lib/dominio';
import { registrarGasto } from '../actions';

type Cat = { id: string; nombre: string; clasificacion: keyof typeof CLASIFICACIONES };
export function FormGasto({ categorias, cuentas, proveedores, pedidos, hoy }: { categorias: Cat[]; cuentas: { id: string; nombre: string }[]; proveedores: { id: string; nombre: string }[]; pedidos: { id: string; codigo: string; cliente_nombre: string }[]; hoy: string }) {
  const [pagado, setPagado] = useState(true);
  const [cat, setCat] = useState(categorias[0]?.id ?? '');
  const [prov, setProv] = useState('');
  const clasif = categorias.find((c) => c.id === cat)?.clasificacion;
  return (
    <div className="tarjeta p-5">
      <FormAccion accion={registrarGasto} boton="Guardar gasto">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Monto *"><input name="monto" inputMode="decimal" required className="campo text-lg font-semibold" placeholder="0.00" autoFocus /></Campo>
          <Campo etiqueta="Fecha"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
          <Campo etiqueta="Categoría" ayuda={clasif && <>Se registra como <b>{CLASIFICACIONES[clasif]}</b></>}>
            <select name="categoria_id" value={cat} onChange={(e) => setCat(e.target.value)} className="campo">{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </Campo>
        </div>
        <Campo etiqueta="Descripción"><input name="descripcion" className="campo" placeholder="Ej: 27 rollos PLA+ 3DTRONIX" /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Proveedor">
            <select name="proveedor_id" value={prov} onChange={(e) => setProv(e.target.value)} className="campo"><option value="">— Ninguno / nuevo —</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          </Campo>
          {!prov && <Campo etiqueta="Proveedor nuevo (opcional)"><input name="proveedor_nuevo" className="campo" placeholder="Se guarda para la próxima vez" /></Campo>}
          <Campo etiqueta="N.º de factura / comprobante"><input name="comprobante" className="campo" /></Campo>
          <Campo etiqueta="Pedido relacionado (opcional)" ayuda="Para calcular la utilidad de ese pedido">
            <select name="pedido_id" className="campo"><option value="">—</option>{pedidos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.cliente_nombre}</option>)}</select>
          </Campo>
        </div>
        <fieldset>
          <legend className="etiqueta">¿Ya se pagó?</legend>
          <input type="hidden" name="pagado" value={pagado ? 'si' : 'no'} />
          <div className="inline-flex rounded-xl border border-[#e3d8c7] bg-white p-1">
            {[[true, 'Sí, pagado'], [false, 'No, queda por pagar']].map(([v, t]) => (
              <button key={String(v)} type="button" onClick={() => setPagado(v as boolean)} className={cx('min-h-9 rounded-lg px-3 text-sm font-semibold', pagado === v ? 'bg-tinta text-crema' : 'text-tinta-2')}>{t as string}</button>
            ))}
          </div>
        </fieldset>
        {pagado ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Pagado desde"><select name="cuenta_id" required className="campo">{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{'saldo' in c ? ` (${dinero(Number((c as { saldo: number }).saldo))})` : ''}</option>)}</select></Campo>
            <Campo etiqueta="Método"><select name="metodo" defaultValue="efectivo" className="campo">{Object.entries(METODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          </div>
        ) : (
          <Campo etiqueta="Fecha de vencimiento"><input type="date" name="vencimiento" className="campo" min={hoy} /></Campo>
        )}
        <p className="text-xs text-tinta-3">Puedes adjuntar la foto de la factura desde el detalle del gasto, en la lista de gastos.</p>
      </FormAccion>
    </div>
  );
}
