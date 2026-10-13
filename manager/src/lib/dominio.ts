/** Catálogos del negocio compartidos por toda la app. */

export const ESTADOS = {
  cotizado: 'Cotizado',
  confirmado: 'Confirmado',
  anticipo_recibido: 'Anticipo recibido',
  en_diseno: 'En diseño',
  boceto_enviado: 'Boceto enviado',
  pendiente_aprobacion: 'Pendiente de aprobación',
  boceto_aprobado: 'Boceto aprobado',
  en_impresion: 'En impresión',
  retiro_soportes: 'Retiro de soportes',
  en_pintura: 'En pintura',
  acabados: 'Acabados finales',
  control_calidad: 'Control de calidad',
  empacado: 'Empacado',
  listo_entrega: 'Listo para entrega',
  enviado: 'Enviado',
  entregado: 'Entregado',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
  devolucion: 'Devolución',
  retrabajo: 'Retrabajo',
} as const;
export type Estado = keyof typeof ESTADOS;

export const FLUJO: Estado[] = [
  'cotizado', 'confirmado', 'anticipo_recibido', 'en_diseno', 'boceto_enviado', 'pendiente_aprobacion', 'boceto_aprobado',
  'en_impresion', 'retiro_soportes', 'en_pintura', 'acabados', 'control_calidad', 'empacado', 'listo_entrega', 'enviado', 'entregado',
];
export const ESPECIALES: Estado[] = ['pausado', 'retrabajo', 'cancelado', 'devolucion'];
export const SOLO_FINANZAS: Estado[] = ['cancelado', 'devolucion', 'cotizado', 'confirmado'];
export const ACTIVOS = (e: Estado) => !['cotizado', 'entregado', 'cancelado', 'devolucion'].includes(e);

/** Columnas del tablero Kanban (agrupan estados parecidos para que quepan en pantalla). */
export const COLUMNAS_KANBAN: { id: string; titulo: string; estados: Estado[]; destino: Estado }[] = [
  { id: 'nuevos', titulo: 'Nuevos', estados: ['cotizado', 'confirmado', 'anticipo_recibido'], destino: 'confirmado' },
  { id: 'diseno', titulo: 'Diseño y boceto', estados: ['en_diseno', 'boceto_enviado', 'pendiente_aprobacion', 'boceto_aprobado'], destino: 'en_diseno' },
  { id: 'impresion', titulo: 'Impresión', estados: ['en_impresion', 'retiro_soportes'], destino: 'en_impresion' },
  { id: 'pintura', titulo: 'Pintura y acabados', estados: ['en_pintura', 'acabados', 'control_calidad', 'retrabajo'], destino: 'en_pintura' },
  { id: 'empaque', titulo: 'Empaque', estados: ['empacado'], destino: 'empacado' },
  { id: 'listo', titulo: 'Listo para entrega', estados: ['listo_entrega'], destino: 'listo_entrega' },
  { id: 'enviado', titulo: 'Enviado', estados: ['enviado'], destino: 'enviado' },
  { id: 'pausado', titulo: 'Pausados', estados: ['pausado'], destino: 'pausado' },
];

export const COLOR_ESTADO: Record<Estado, string> = {
  cotizado: 'bg-stone-100 text-stone-700',
  confirmado: 'bg-sky-50 text-sky-800',
  anticipo_recibido: 'bg-sky-100 text-sky-900',
  en_diseno: 'bg-violet-50 text-violet-800',
  boceto_enviado: 'bg-violet-50 text-violet-800',
  pendiente_aprobacion: 'bg-amber-50 text-amber-800',
  boceto_aprobado: 'bg-violet-100 text-violet-900',
  en_impresion: 'bg-indigo-50 text-indigo-800',
  retiro_soportes: 'bg-indigo-50 text-indigo-800',
  en_pintura: 'bg-pink-50 text-pink-800',
  acabados: 'bg-pink-50 text-pink-800',
  control_calidad: 'bg-teal-50 text-teal-800',
  empacado: 'bg-oro-50 text-oro-800',
  listo_entrega: 'bg-oro-100 text-oro-900',
  enviado: 'bg-emerald-50 text-emerald-800',
  entregado: 'bg-emerald-100 text-emerald-900',
  pausado: 'bg-stone-200 text-stone-700',
  cancelado: 'bg-red-50 text-red-800',
  devolucion: 'bg-red-100 text-red-900',
  retrabajo: 'bg-orange-50 text-orange-800',
};

export const PRIORIDADES = { baja: 'Baja', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' } as const;
export const MODALIDADES = {
  retiro_local: 'Retiro en el local',
  entrega_personal: 'Entrega personal',
  servientrega: 'Servientrega',
  transporte_interprovincial: 'Transporte interprovincial',
  otro_courier: 'Otro courier',
} as const;
export const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', deuna: 'Deuna', paypal: 'PayPal', otro: 'Otro' } as const;
export const CANALES = ['WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'Local', 'Referido', 'Corporativo', 'Feria / evento', 'Otro'];
export const TIPOS_PRODUCTO = [
  'Funko Pop individual', 'Funko Pop pareja', 'Caricatura chibi/Pixar', 'Mascota', 'Familia', 'Figura corporativa',
  'Lámpara', 'Placa conmemorativa', 'Llavero', 'Decorativo', 'Artículo funcional', 'Corte / grabado láser',
  'Sublimación', 'Taller', 'Adicional', 'Otro',
];
export const SUBTIPOS_CUENTA = { efectivo: 'Efectivo', banco: 'Banco', billetera: 'Billetera digital', otro: 'Otro' } as const;
export const CLASIFICACIONES = {
  costo_directo: 'Costo directo',
  gasto_operativo: 'Gasto operativo',
  inversion: 'Inversión (activo)',
  financiero: 'Gasto financiero',
  impuesto: 'Impuesto',
} as const;
export const TIPOS_TX: Record<string, string> = {
  apertura: 'Saldo inicial', cobro: 'Cobro', devolucion_cliente: 'Devolución a cliente', venta: 'Venta',
  reversion_venta: 'Reversión de venta', retencion_anticipo: 'Anticipo retenido', gasto: 'Gasto', pago_gasto: 'Pago de gasto',
  transferencia: 'Transferencia', aporte: 'Aporte de propietario', retiro: 'Retiro de propietario',
  prestamo_recibido: 'Préstamo recibido', pago_prestamo: 'Pago de préstamo', otro_ingreso: 'Otro ingreso',
  ajuste: 'Ajuste de saldo', anulacion: 'Anulación',
};
export const ROLES_LABEL = { administrador: 'Administrador', contabilidad: 'Contabilidad', produccion: 'Producción', pintura: 'Pintura' } as const;
