'use client';
import { dinero } from '@/lib/money';
import { FormAccion } from '@/components/form-accion';
import { Campo } from '@/components/ui';
import { METODOS } from '@/lib/dominio';
import { registrarCobro, devolverDinero, retenerAnticipo } from '../actions';

type Cuenta = { id: string; nombre: string };
const metodos = Object.entries(METODOS);

function CuentaYMetodo({ cuentas }: { cuentas: Cuenta[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Cuenta"><select name="cuenta_id" required className="campo">{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{'saldo' in c ? ` (${dinero(Number((c as { saldo: number }).saldo))})` : ''}</option>)}</select></Campo>
      <Campo etiqueta="Método"><select name="metodo" defaultValue="transferencia" className="campo">{metodos.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
    </div>
  );
}

export function FormCobro({ pedidoId, saldo, anticipoSugerido, cobrado, cuentas, hoy }: { pedidoId: string; saldo: number; anticipoSugerido: number; cobrado: number; cuentas: Cuenta[]; hoy: string }) {
  if (!cuentas.length) return <p className="text-sm text-tinta-3">Primero crea una cuenta de dinero en Finanzas → Cuentas.</p>;
  const primero = cobrado === 0;
  return (
    <FormAccion accion={registrarCobro} boton="Registrar cobro">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Monto"><input name="monto" inputMode="decimal" required defaultValue={(primero ? anticipoSugerido : saldo).toFixed(2)} className="campo" /></Campo>
        <Campo etiqueta="Tipo"><select name="subtipo" defaultValue={primero ? 'anticipo' : 'saldo'} className="campo"><option value="anticipo">Anticipo</option><option value="abono">Abono</option><option value="saldo">Saldo final</option></select></Campo>
        <Campo etiqueta="Fecha"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
      </div>
      <CuentaYMetodo cuentas={cuentas} />
      <Campo etiqueta="Comprobante / referencia"><input name="comprobante" className="campo" placeholder="N.º de transferencia, recibo…" /></Campo>
    </FormAccion>
  );
}

export function FormDevolucion({ pedidoId, aFavor, cuentas, hoy, admin }: { pedidoId: string; aFavor: number; cuentas: Cuenta[]; hoy: string; admin: boolean }) {
  return (
    <div className="space-y-4">
      <FormAccion accion={devolverDinero} boton="Devolver dinero al cliente" variante="oscuro">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Monto a devolver"><input name="monto" inputMode="decimal" defaultValue={aFavor.toFixed(2)} className="campo" /></Campo>
          <Campo etiqueta="Fecha"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
        </div>
        <CuentaYMetodo cuentas={cuentas} />
        <Campo etiqueta="Motivo"><input name="motivo" required className="campo" /></Campo>
      </FormAccion>
      {admin && (
        <details className="rounded-xl border border-[#efe6d8] p-3">
          <summary className="cursor-pointer text-sm font-semibold">Retener el anticipo como ingreso (pedido cancelado)</summary>
          <div className="mt-3">
            <FormAccion accion={retenerAnticipo} boton="Retener" variante="peligro">
              <input type="hidden" name="pedido_id" value={pedidoId} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Monto"><input name="monto" inputMode="decimal" defaultValue={aFavor.toFixed(2)} className="campo" /></Campo>
                <Campo etiqueta="Fecha"><input type="date" name="fecha" defaultValue={hoy} max={hoy} className="campo" /></Campo>
              </div>
              <Campo etiqueta="Motivo / acuerdo con el cliente"><input name="motivo" required className="campo" /></Campo>
            </FormAccion>
          </div>
        </details>
      )}
    </div>
  );
}
