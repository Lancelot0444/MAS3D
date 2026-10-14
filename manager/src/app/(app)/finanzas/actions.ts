'use server';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { mensajeError, opcional, texto, type Resultado } from '@/lib/acciones';
import { parseMonto } from '@/lib/money';

const refrescar = () => { revalidatePath('/finanzas', 'layout'); revalidatePath('/'); revalidatePath('/pedidos', 'layout'); };

export async function anularMovimiento(id: string, motivo: string): Promise<Resultado> {
  if (!motivo.trim()) return { ok: false, error: 'Indica el motivo de la anulación.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('anular_transaccion', { p_tx: id, p_motivo: motivo.trim() });
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Movimiento anulado.' };
}

export async function registrarGasto(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'monto'));
  if (!monto || monto <= 0) return { ok: false, error: 'Escribe un monto válido (máximo 2 decimales).' };
  const pagado = texto(f, 'pagado') === 'si';
  const supabase = await supabaseServer();
  let proveedor = opcional(f, 'proveedor_id');
  const nuevoProveedor = texto(f, 'proveedor_nuevo');
  if (!proveedor && nuevoProveedor) {
    const { data: existe } = await supabase.from('proveedores').select('id').ilike('nombre', nuevoProveedor).maybeSingle();
    if (existe) proveedor = existe.id;
    else {
      const { data, error } = await supabase.from('proveedores').insert({ nombre: nuevoProveedor }).select('id').single();
      if (error) return { ok: false, error: mensajeError(error) };
      proveedor = data.id;
    }
  }
  const { data: gastoId, error } = await supabase.rpc('registrar_gasto', {
    p_fecha: texto(f, 'fecha'), p_categoria: texto(f, 'categoria_id'), p_monto: monto, p_descripcion: texto(f, 'descripcion'),
    p_pagado: pagado, p_cuenta: pagado ? texto(f, 'cuenta_id') : null, p_metodo: pagado ? texto(f, 'metodo') : null,
    p_proveedor: proveedor, p_comprobante: opcional(f, 'comprobante'), p_vencimiento: pagado ? null : opcional(f, 'vencimiento'),
    p_pedido: opcional(f, 'pedido_id'), p_idem: texto(f, 'idem'),
  });
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true, datos: gastoId, mensaje: 'Gasto registrado.' };
}

export async function pagarGasto(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'monto'));
  if (!monto || monto <= 0) return { ok: false, error: 'Escribe un monto válido.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('pagar_gasto', {
    p_gasto: texto(f, 'gasto_id'), p_cuenta: texto(f, 'cuenta_id'), p_monto: monto, p_fecha: texto(f, 'fecha'), p_metodo: texto(f, 'metodo'), p_idem: texto(f, 'idem'),
  });
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Pago registrado.' };
}

export async function registrarMovimiento(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'monto'));
  if (!monto || monto <= 0) return { ok: false, error: 'Escribe un monto válido (máximo 2 decimales).' };
  const tipo = texto(f, 'tipo');
  const interes = tipo === 'pago_prestamo' ? parseMonto(texto(f, 'interes') || '0') : 0;
  if (interes === null || interes < 0) return { ok: false, error: 'El interés no es válido.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('registrar_movimiento', {
    p_tipo: tipo, p_fecha: texto(f, 'fecha'), p_monto: monto, p_descripcion: texto(f, 'descripcion'),
    p_cuenta_origen: opcional(f, 'cuenta_origen'), p_cuenta_destino: opcional(f, 'cuenta_destino'),
    p_interes: interes, p_referencia: opcional(f, 'referencia'), p_metodo: opcional(f, 'metodo'), p_idem: texto(f, 'idem'),
  });
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Movimiento registrado.' };
}

export async function crearCuenta(_: Resultado | null, f: FormData): Promise<Resultado> {
  const nombre = texto(f, 'nombre');
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la cuenta.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('cuentas').insert({
    nombre, subtipo: texto(f, 'subtipo'), institucion: opcional(f, 'institucion'), numero_referencia: opcional(f, 'numero_referencia'),
    tipo: 'activo', codigo: 'auto', es_financiera: true,
  });
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Cuenta creada.' };
}

export async function cambiarCuentaActiva(id: string, activa: boolean): Promise<Resultado> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from('cuentas').update({ activa }).eq('id', id);
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true };
}

export async function registrarApertura(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'monto'));
  if (monto === null || monto < 0) return { ok: false, error: 'Escribe el saldo real (puede ser 0).' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('registrar_saldo_apertura', { p_cuenta: texto(f, 'cuenta_id'), p_fecha: texto(f, 'fecha'), p_monto: monto, p_idem: texto(f, 'idem') });
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Saldo inicial registrado.' };
}

export async function ajustarSaldo(_: Resultado | null, f: FormData): Promise<Resultado> {
  const monto = parseMonto(texto(f, 'saldo_real'));
  if (monto === null) return { ok: false, error: 'Escribe el saldo real contado.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('ajustar_saldo', { p_cuenta: texto(f, 'cuenta_id'), p_fecha: texto(f, 'fecha'), p_saldo_real: monto, p_motivo: texto(f, 'motivo'), p_idem: texto(f, 'idem') });
  if (error) return { ok: false, error: mensajeError(error) };
  refrescar();
  return { ok: true, mensaje: 'Saldo ajustado.' };
}
