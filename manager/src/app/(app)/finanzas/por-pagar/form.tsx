'use client';
import { dinero } from '@/lib/money';
import { FormAccion } from '@/components/form-accion';
import { Campo } from '@/components/ui';
import { METODOS } from '@/lib/dominio';
import { pagarGasto } from '../actions';

export function FormPagoGasto({ gastoId, saldo, cuentas, hoy }: { gastoId: string; saldo: number; cuentas: { id: string; nombre: string }[]; hoy: string }) {
  return (
    <FormAccion accion={pagarGasto} boton="Pagar" className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <input type="hidden" name="gasto_id" value={gastoId} />
      <Campo etiqueta="Monto"><input name="monto" inputMode="decimal" defaultValue={saldo.toFixed(2)} className="campo" /></Campo>
      <Campo etiqueta="Fecha"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
      <Campo etiqueta="Desde"><select name="cuenta_id" className="campo">{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{'saldo' in c ? ` (${dinero(Number((c as { saldo: number }).saldo))})` : ''}</option>)}</select></Campo>
      <Campo etiqueta="Método"><select name="metodo" defaultValue="transferencia" className="campo">{Object.entries(METODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
    </FormAccion>
  );
}
