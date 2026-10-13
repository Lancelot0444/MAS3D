/**
 * Dinero: se maneja en centavos enteros para evitar errores de redondeo
 * (0.1 + 0.2 ≠ 0.3 en coma flotante). La base de datos usa numeric(12,2).
 */
export const aCentavos = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100 + Math.sign(n) * 1e-7);
};
export const deCentavos = (c: number): number => c / 100;

/** Interpreta lo que escribe el usuario ("12,50", "$12.5", "12") → número con 2 decimales o null. */
export function parseMonto(texto: string | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto).trim().replace(/[$\s]/g, '');
  if (limpio === '') return null;
  const normal = /,\d{1,2}$/.test(limpio) && !limpio.includes('.') ? limpio.replace(',', '.') : limpio.replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normal)) return null;
  return deCentavos(aCentavos(normal));
}

const fmt = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
export const dinero = (v: number | string | null | undefined): string => {
  const c = aCentavos(v ?? 0);
  return (c < 0 ? '-' : '') + fmt.format(deCentavos(Math.abs(c)));
};

/** Suma exacta de importes. */
export const sumar = (...vals: Array<number | string | null | undefined>) => deCentavos(vals.reduce<number>((s, v) => s + aCentavos(v), 0));

/** Porcentaje de un importe, redondeado al centavo (half-up). */
export const porcentaje = (monto: number | string, pct: number) => deCentavos(Math.round(aCentavos(monto) * pct / 100));

/** Cálculo de una línea de venta, idéntico al de la base de datos (calcular_item). */
export function calcularLinea(l: { cantidad: number; precio_unitario: number; descuento?: number; tarifa_iva?: number; precio_incluye_iva?: boolean }) {
  const bruto = Math.round(l.cantidad * aCentavos(l.precio_unitario));
  const desc = aCentavos(l.descuento ?? 0);
  if (desc > bruto) throw new Error('El descuento no puede ser mayor que el valor de la línea');
  const neto = bruto - desc;
  const tarifa = l.tarifa_iva ?? 0;
  let base: number, iva: number, total: number;
  if (tarifa === 0) { base = neto; iva = 0; total = neto; }
  else if (l.precio_incluye_iva ?? true) { total = neto; base = Math.round(neto / (1 + tarifa / 100)); iva = total - base; }
  else { base = neto; iva = Math.round(neto * tarifa / 100); total = base + iva; }
  return { bruto: deCentavos(bruto), base: deCentavos(base), iva: deCentavos(iva), total: deCentavos(total) };
}
