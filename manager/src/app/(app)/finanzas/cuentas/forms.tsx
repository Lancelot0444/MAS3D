'use client';
import { dinero } from '@/lib/money';
import { useState } from 'react';
import { FormAccion } from '@/components/form-accion';
import { Campo, cx } from '@/components/ui';
import { SUBTIPOS_CUENTA } from '@/lib/dominio';
import { ajustarSaldo, crearCuenta, registrarApertura } from '../actions';

type C = { id: string; nombre: string; tiene_apertura: boolean };

export function FormsCuentas({ cuentas, hoy }: { cuentas: C[]; hoy: string }) {
  const [tab, setTab] = useState<'nueva' | 'apertura' | 'ajuste'>(cuentas.some((c) => !c.tiene_apertura) ? 'apertura' : 'nueva');
  const sinApertura = cuentas.filter((c) => !c.tiene_apertura);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {([['nueva', 'Nueva cuenta'], ['apertura', 'Saldo inicial'], ['ajuste', 'Cuadre de caja']] as const).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('rounded-xl px-3 py-1.5 text-sm font-semibold', tab === k ? 'bg-oro-100 text-oro-900' : 'text-tinta-3 hover:bg-crema-2')}>{t}</button>
        ))}
      </div>
      {tab === 'nueva' && (
        <FormAccion accion={crearCuenta} boton="Crear cuenta">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre"><input name="nombre" required className="campo" placeholder="Ej: Caja de efectivo MAS3D" /></Campo>
            <Campo etiqueta="Tipo"><select name="subtipo" className="campo">{Object.entries(SUBTIPOS_CUENTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            <Campo etiqueta="Banco / institución"><input name="institucion" className="campo" placeholder="Ej: Banco Pichincha" /></Campo>
            <Campo etiqueta="Referencia" ayuda="Solo los últimos 4 dígitos, por seguridad"><input name="numero_referencia" className="campo" placeholder="Ej: ****1234" maxLength={12} /></Campo>
          </div>
        </FormAccion>
      )}
      {tab === 'apertura' && (sinApertura.length === 0 ? <p className="text-sm text-tinta-3">Todas las cuentas tienen su saldo inicial.</p> : (
        <FormAccion accion={registrarApertura} boton="Registrar saldo inicial">
          <p className="text-sm text-tinta-3">Escribe el dinero <b>real</b> que hay en la cuenta en la fecha de inicio. Solo se registra una vez por cuenta.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Cuenta"><select name="cuenta_id" className="campo">{sinApertura.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
            <Campo etiqueta="Fecha de corte"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
            <Campo etiqueta="Saldo real"><input name="monto" inputMode="decimal" required className="campo" placeholder="0.00" /></Campo>
          </div>
        </FormAccion>
      ))}
      {tab === 'ajuste' && (
        <FormAccion accion={ajustarSaldo} boton="Ajustar saldo" variante="oscuro">
          <p className="text-sm text-tinta-3">Si al contar la caja el dinero no coincide, registra el saldo real. La diferencia se guarda como “diferencia de caja”.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Cuenta"><select name="cuenta_id" className="campo">{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{'saldo' in c ? ` (${dinero(Number((c as { saldo: number }).saldo))})` : ''}</option>)}</select></Campo>
            <Campo etiqueta="Fecha"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
            <Campo etiqueta="Saldo real contado"><input name="saldo_real" inputMode="decimal" required className="campo" /></Campo>
          </div>
          <Campo etiqueta="Motivo"><input name="motivo" required className="campo" placeholder="Ej: cuadre de caja semanal" /></Campo>
        </FormAccion>
      )}
    </div>
  );
}
