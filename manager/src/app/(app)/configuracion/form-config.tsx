'use client';
import { FormAccion } from '@/components/form-accion';
import { Campo, Tarjeta } from '@/components/ui';
import { guardarConfiguracion } from './actions';

type Cfg = Record<string, string | number | boolean | null>;
export function FormConfig({ cfg }: { cfg: Cfg }) {
  const t = (k: string) => String(cfg[k] ?? '');
  return (
    <FormAccion accion={guardarConfiguracion} boton="Guardar configuración" className="space-y-4">
      <Tarjeta titulo="Datos del negocio">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre comercial"><input name="nombre_comercial" defaultValue={t('nombre_comercial')} className="campo" /></Campo>
          <Campo etiqueta="Razón social"><input name="razon_social" defaultValue={t('razon_social')} className="campo" /></Campo>
          <Campo etiqueta="RUC"><input name="ruc" defaultValue={t('ruc')} inputMode="numeric" className="campo" /></Campo>
          <Campo etiqueta="Régimen tributario"><input name="regimen" defaultValue={t('regimen')} className="campo" /></Campo>
          <Campo etiqueta="Dirección" className="sm:col-span-2"><input name="direccion" defaultValue={t('direccion')} className="campo" /></Campo>
          <Campo etiqueta="Ciudad"><input name="ciudad" defaultValue={t('ciudad')} className="campo" /></Campo>
          <Campo etiqueta="Provincia"><input name="provincia" defaultValue={t('provincia')} className="campo" /></Campo>
          <Campo etiqueta="WhatsApp comercial"><input name="whatsapp" defaultValue={t('whatsapp')} className="campo" /></Campo>
          <Campo etiqueta="Instagram"><input name="instagram" defaultValue={t('instagram')} className="campo" /></Campo>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Ventas">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Anticipo sugerido (%)"><input name="anticipo_porcentaje" defaultValue={t('anticipo_porcentaje')} inputMode="decimal" className="campo" /></Campo>
          <Campo etiqueta="Envío referencial ($)"><input name="envio_referencial" defaultValue={t('envio_referencial')} inputMode="decimal" className="campo" /></Campo>
          <Campo etiqueta="Días laborables de fabricación"><input name="dias_fabricacion" type="number" min={0} max={90} defaultValue={t('dias_fabricacion')} className="campo" /></Campo>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Impuestos (IVA)">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 font-semibold sm:col-span-3"><input type="checkbox" name="iva_activo" defaultChecked={!!cfg.iva_activo} className="size-5 accent-oro-600" />Cobrar IVA en los pedidos nuevos</label>
          <Campo etiqueta="Tarifa de IVA (%)"><input name="iva_tarifa" defaultValue={t('iva_tarifa')} inputMode="decimal" className="campo" /></Campo>
          <Campo etiqueta="Los precios de venta…" className="sm:col-span-2">
            <select name="precios_incluyen_iva" defaultValue={cfg.precios_incluyen_iva ? 'si' : 'no'} className="campo"><option value="si">ya incluyen el IVA</option><option value="no">se les suma el IVA</option></select>
          </Campo>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="config_tributaria_confirmada" defaultChecked={!!cfg.config_tributaria_confirmada} className="size-5 accent-oro-600" />Nuestro contador confirmó esta configuración</label>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Seguridad">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="exigir_2fa_admin" defaultChecked={!!cfg.exigir_2fa_admin} className="size-5 accent-oro-600" />Recordar a los administradores activar la verificación en dos pasos</label>
      </Tarjeta>
    </FormAccion>
  );
}
