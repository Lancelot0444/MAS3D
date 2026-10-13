import { describe, expect, it } from 'vitest';
import { aCentavos, calcularLinea, dinero, parseMonto, porcentaje, sumar } from '@/lib/money';
import { normalizarTelefono, validarCedula, validarRuc } from '@/lib/validaciones';

describe('dinero', () => {
  it('suma sin errores de coma flotante', () => {
    expect(sumar(0.1, 0.2)).toBe(0.3);
    expect(sumar('19.99', 0.01, '-5')).toBe(15);
  });
  it('convierte a centavos redondeando correctamente', () => {
    expect(aCentavos(1.005)).toBe(101);
    expect(aCentavos('12,50')).toBe(1250);
    expect(aCentavos(-2.345)).toBe(-235);
  });
  it('interpreta montos escritos por el usuario', () => {
    expect(parseMonto('12,5')).toBe(12.5);
    expect(parseMonto('$ 1,250.75')).toBe(1250.75);
    expect(parseMonto('7')).toBe(7);
    expect(parseMonto('1.234')).toBeNull();
    expect(parseMonto('abc')).toBeNull();
    expect(parseMonto('')).toBeNull();
  });
  it('calcula el anticipo sugerido del 50%', () => {
    expect(porcentaje(65, 50)).toBe(32.5);
    expect(porcentaje(45.55, 50)).toBe(22.78);
  });
  it('formatea en dólares', () => {
    expect(dinero(1234.5)).toMatch(/1\.?234,50|1,?234\.50/);
    expect(dinero(-0)).toBe(dinero(0));
    expect(dinero(-376)).toMatch(/^-\$/);
  });
});

describe('cálculo de líneas (igual que la base de datos)', () => {
  it('sin IVA', () => {
    expect(calcularLinea({ cantidad: 2, precio_unitario: 40, descuento: 5 })).toEqual({ bruto: 80, base: 75, iva: 0, total: 75 });
  });
  it('precio con IVA incluido al 15%', () => {
    expect(calcularLinea({ cantidad: 1, precio_unitario: 115, tarifa_iva: 15 })).toEqual({ bruto: 115, base: 100, iva: 15, total: 115 });
    expect(calcularLinea({ cantidad: 1, precio_unitario: 30, tarifa_iva: 15 })).toEqual({ bruto: 30, base: 26.09, iva: 3.91, total: 30 });
  });
  it('precio más IVA', () => {
    expect(calcularLinea({ cantidad: 3, precio_unitario: 10, tarifa_iva: 15, precio_incluye_iva: false })).toEqual({ bruto: 30, base: 30, iva: 4.5, total: 34.5 });
  });
  it('rechaza descuentos mayores al valor', () => {
    expect(() => calcularLinea({ cantidad: 1, precio_unitario: 10, descuento: 11 })).toThrow();
  });
});

describe('validaciones Ecuador', () => {
  it('cédula', () => {
    expect(validarCedula('0300000007')).toBe(true);
    expect(validarCedula('0102030405')).toBe(false);
    expect(validarCedula('123')).toBe(false);
  });
  it('RUC persona natural y sociedad', () => {
    expect(validarRuc('0300000007001')).toBe(true);
    expect(validarRuc('0300000007000')).toBe(false);
    expect(validarRuc('1790011674001')).toBe(true);
  });
  it('teléfono a formato WhatsApp', () => {
    expect(normalizarTelefono('0983890036')).toBe('593983890036');
    expect(normalizarTelefono('+593 98 389 0036')).toBe('593983890036');
    expect(normalizarTelefono('')).toBeNull();
  });
});
