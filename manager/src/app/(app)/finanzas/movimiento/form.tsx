'use client';
import { dinero } from '@/lib/money';
import { useState } from 'react';
import { FormAccion } from '@/components/form-accion';
import { Aviso, Campo, cx } from '@/components/ui';
import { registrarMovimiento } from '../actions';

const TIPOS = {
  transferencia: { t: 'Transferencia entre cuentas', d: 'Mover dinero entre cuentas propias (ej. depositar la caja en el banco). No es ingreso ni gasto.', origen: true, destino: true },
  aporte: { t: 'Aporte de propietario', d: 'Dinero personal que Brian o Mayra ponen en el negocio. No es venta.', destino: true },
  retiro: { t: 'Retiro de propietario', d: 'Dinero que sale del negocio para uso personal. No es gasto del negocio.', origen: true },
  prestamo_recibido: { t: 'Préstamo recibido', d: 'Dinero de un crédito. Aumenta la deuda; no es venta.', destino: true, ref: true },
  pago_prestamo: { t: 'Pago de cuota de préstamo', d: 'Separa el capital (reduce la deuda) de los intereses (gasto financiero).', origen: true, ref: true, interes: true },
  otro_ingreso: { t: 'Otro ingreso', d: 'Ingresos que no vienen de un pedido (ej. reembolsos, intereses ganados).', destino: true },
} as const;
type Tipo = keyof typeof TIPOS;

export function FormMovimiento({ cuentas, prestamos, hoy }: { cuentas: { id: string; nombre: string }[]; prestamos: string[]; hoy: string }) {
  const [tipo, setTipo] = useState<Tipo>('transferencia');
  const t = TIPOS[tipo] as { t: string; d: string; origen?: boolean; destino?: boolean; ref?: boolean; interes?: boolean };
  if (!cuentas.length) return <Aviso tipo="alerta">Primero crea tus cuentas de dinero en Finanzas → Cuentas.</Aviso>;
  return (
    <div className="tarjeta p-5">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {(Object.keys(TIPOS) as Tipo[]).map((k) => (
          <button key={k} type="button" onClick={() => setTipo(k)} className={cx('min-h-12 rounded-xl border px-3 text-left text-sm font-semibold', tipo === k ? 'border-tinta bg-tinta text-crema' : 'border-[#e3d8c7] bg-white hover:border-oro-500')}>{TIPOS[k].t}</button>
        ))}
      </div>
      <p className="mb-4 rounded-xl bg-crema p-3 text-sm">{t.d}</p>
      <FormAccion key={tipo} accion={registrarMovimiento} boton="Registrar">
        <input type="hidden" name="tipo" value={tipo} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta={t.interes ? 'Capital pagado' : 'Monto'}><input name="monto" inputMode="decimal" required className="campo" placeholder="0.00" /></Campo>
          {t.interes && <Campo etiqueta="Intereses pagados" ayuda="Según el estado de cuenta del banco"><input name="interes" inputMode="decimal" className="campo" placeholder="0.00" /></Campo>}
          <Campo etiqueta="Fecha"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
          {t.origen && <Campo etiqueta={tipo === 'transferencia' ? 'Desde la cuenta' : 'Sale de'}><select name="cuenta_origen" className="campo">{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{'saldo' in c ? ` (${dinero(Number((c as { saldo: number }).saldo))})` : ''}</option>)}</select></Campo>}
          {t.destino && <Campo etiqueta={tipo === 'transferencia' ? 'Hacia la cuenta' : 'Entra a'}><select name="cuenta_destino" defaultValue={tipo === 'transferencia' ? cuentas[1]?.id : undefined} className="campo">{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{'saldo' in c ? ` (${dinero(Number((c as { saldo: number }).saldo))})` : ''}</option>)}</select></Campo>}
          {t.ref && (
            <Campo etiqueta="Préstamo / acreedor">
              <input name="referencia" list="prestamos" required className="campo" placeholder="Ej: Crédito CBE" />
              <datalist id="prestamos">{prestamos.map((p) => <option key={p} value={p} />)}</datalist>
            </Campo>
          )}
        </div>
        <Campo etiqueta="Descripción"><input name="descripcion" required={tipo === 'otro_ingreso'} className="campo" /></Campo>
      </FormAccion>
    </div>
  );
}
