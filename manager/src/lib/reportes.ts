import 'server-only';
import { supabaseServer } from './supabase/server';
import { CLASIFICACIONES, ESTADOS, METODOS, TIPOS_TX, type Estado } from './dominio';

export type Columna = { k: string; t: string; tipo?: 'dinero' | 'fecha' | 'numero' | 'texto' };
export type Reporte = { titulo: string; descripcion: string; columnas: Columna[]; filas: Record<string, string | number | null>[]; totales?: Record<string, number>; usaFechas: boolean };

export const REPORTES: Record<string, string> = {
  resultados: 'Estado de resultados',
  ventas: 'Ventas por período',
  cobros: 'Cobros recibidos',
  gastos: 'Gastos por categoría',
  utilidad: 'Utilidad por pedido',
  flujo: 'Flujo de caja',
  cxc: 'Cuentas por cobrar',
  cxp: 'Cuentas por pagar',
  clientes: 'Clientes frecuentes',
  canales: 'Ventas por canal',
  pendientes: 'Pedidos pendientes',
};

const sumar = (filas: Record<string, unknown>[], k: string) => Math.round(filas.reduce((s, f) => s + Number(f[k] ?? 0), 0) * 100) / 100;

export async function obtenerReporte(tipo: string, desde: string, hasta: string): Promise<Reporte | null> {
  const s = await supabaseServer();
  switch (tipo) {
    case 'resultados': {
      const { data } = await s.rpc('estado_resultados', { p_desde: desde, p_hasta: hasta });
      const filas = (data ?? []) as { clave: string; nombre: string; tipo: string; monto: number }[];
      const v = (c: string) => Number(filas.find((f) => f.clave === c)?.monto ?? 0);
      const ventas = v('VENTAS') + v('ENVIOS'), costos = v('COSTOS'), gop = v('GASTOS_OP') + v('DIF_CAJA'), otros = v('OTROS_INGRESOS'), fin = v('GASTOS_FIN'), imp = v('IMPUESTOS');
      const r = (concepto: string, monto: number, nivel = 0) => ({ concepto: (nivel ? '   ' : '') + concepto, monto });
      return {
        titulo: REPORTES.resultados, usaFechas: true,
        descripcion: 'Ventas reconocidas al entregar/enviar. No incluye anticipos, préstamos, aportes ni transferencias. Las inversiones en maquinaria no se restan.',
        columnas: [{ k: 'concepto', t: 'Concepto' }, { k: 'monto', t: 'Monto', tipo: 'dinero' }],
        filas: [
          r('Ventas de productos y servicios', v('VENTAS'), 1), r('Ingresos por envíos', v('ENVIOS'), 1), r('VENTAS NETAS', ventas),
          r('Costos directos de producción', -costos, 1), r('UTILIDAD BRUTA', ventas - costos),
          r('Gastos operativos', -v('GASTOS_OP'), 1), r('Diferencias de caja', -v('DIF_CAJA'), 1), r('UTILIDAD OPERATIVA', ventas - costos - gop),
          r('Otros ingresos', otros, 1), r('Gastos financieros (intereses)', -fin, 1), r('Impuestos', -imp, 1),
          r('UTILIDAD NETA (antes de impuesto a la renta y participación)', ventas - costos - gop + otros - fin - imp),
        ],
      };
    }
    case 'ventas': {
      const { data } = await s.rpc('serie_financiera', { p_desde: desde, p_hasta: hasta, p_granularidad: 'day' });
      const filas = ((data ?? []) as { periodo: string; ventas: number; cobrado: number; gastos: number }[]).filter((f) => Number(f.ventas) || Number(f.cobrado) || Number(f.gastos))
        .map((f) => ({ fecha: f.periodo, ventas: Number(f.ventas), cobrado: Number(f.cobrado), gastos: Number(f.gastos) }));
      return { titulo: REPORTES.ventas, usaFechas: true, descripcion: 'Por día. Ventas = pedidos entregados/enviados; cobrado incluye anticipos.',
        columnas: [{ k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'ventas', t: 'Ventas', tipo: 'dinero' }, { k: 'cobrado', t: 'Cobrado', tipo: 'dinero' }, { k: 'gastos', t: 'Gastos', tipo: 'dinero' }],
        filas, totales: { ventas: sumar(filas, 'ventas'), cobrado: sumar(filas, 'cobrado'), gastos: sumar(filas, 'gastos') } };
    }
    case 'cobros': {
      const { data } = await s.from('v_movimientos').select('numero, fecha, tipo, subtipo, pedido_codigo, cliente_nombre, cuenta_nombre, metodo_pago, entrada, salida, comprobante')
        .in('tipo', ['cobro', 'devolucion_cliente']).eq('anulada', false).gte('fecha', desde).lte('fecha', hasta).order('fecha');
      const filas = (data ?? []).map((m) => ({ numero: m.numero, fecha: m.fecha, tipo: TIPOS_TX[m.tipo] + (m.subtipo ? ` (${m.subtipo})` : ''), pedido: m.pedido_codigo, cliente: m.cliente_nombre,
        cuenta: m.cuenta_nombre, metodo: m.metodo_pago ? METODOS[m.metodo_pago as keyof typeof METODOS] : '', monto: Number(m.entrada) - Number(m.salida), comprobante: m.comprobante }));
      return { titulo: REPORTES.cobros, usaFechas: true, descripcion: 'Dinero recibido de clientes (las devoluciones restan).',
        columnas: [{ k: 'numero', t: '#', tipo: 'numero' }, { k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'tipo', t: 'Tipo' }, { k: 'pedido', t: 'Pedido' }, { k: 'cliente', t: 'Cliente' },
          { k: 'cuenta', t: 'Cuenta' }, { k: 'metodo', t: 'Método' }, { k: 'comprobante', t: 'Comprobante' }, { k: 'monto', t: 'Monto', tipo: 'dinero' }],
        filas, totales: { monto: sumar(filas, 'monto') } };
    }
    case 'gastos': {
      const { data } = await s.rpc('gastos_por_categoria', { p_desde: desde, p_hasta: hasta });
      const filas = ((data ?? []) as { categoria: string; clasificacion: string; total: number }[]).map((g) => ({ categoria: g.categoria, clasificacion: CLASIFICACIONES[g.clasificacion as keyof typeof CLASIFICACIONES], total: Number(g.total) }));
      return { titulo: REPORTES.gastos, usaFechas: true, descripcion: 'Costos y gastos devengados en el período (pagados o por pagar). No incluye inversiones en activos.',
        columnas: [{ k: 'categoria', t: 'Categoría' }, { k: 'clasificacion', t: 'Clasificación' }, { k: 'total', t: 'Total', tipo: 'dinero' }], filas, totales: { total: sumar(filas, 'total') } };
    }
    case 'utilidad': {
      const { data } = await s.rpc('utilidad_por_pedido', { p_desde: desde, p_hasta: hasta });
      const filas = ((data ?? []) as Record<string, number | string>[]).map((u) => ({ codigo: u.codigo, cliente: u.cliente, fecha: u.fecha_entrega, venta: Number(u.venta), costos: Number(u.costos), utilidad: Number(u.utilidad), margen: u.margen === null ? null : Number(u.margen) }));
      return { titulo: REPORTES.utilidad, usaFechas: true, descripcion: 'Venta menos los gastos registrados y vinculados a cada pedido. En la Fase 2 se sumarán material, máquina y mano de obra reales.',
        columnas: [{ k: 'codigo', t: 'Pedido' }, { k: 'cliente', t: 'Cliente' }, { k: 'fecha', t: 'Entregado', tipo: 'fecha' }, { k: 'venta', t: 'Venta', tipo: 'dinero' }, { k: 'costos', t: 'Costos vinculados', tipo: 'dinero' }, { k: 'utilidad', t: 'Utilidad', tipo: 'dinero' }, { k: 'margen', t: 'Margen %', tipo: 'numero' }],
        filas, totales: { venta: sumar(filas, 'venta'), costos: sumar(filas, 'costos'), utilidad: sumar(filas, 'utilidad') } };
    }
    case 'flujo': {
      const { data } = await s.from('v_movimientos').select('fecha, tipo, cuenta_nombre, entrada, salida, anulada').gte('fecha', desde).lte('fecha', hasta).eq('anulada', false).neq('tipo', 'anulacion');
      const grupos = new Map<string, { concepto: string; entradas: number; salidas: number }>();
      for (const m of data ?? []) {
        const g = grupos.get(m.tipo) ?? { concepto: TIPOS_TX[m.tipo], entradas: 0, salidas: 0 };
        g.entradas += Number(m.entrada); g.salidas += Number(m.salida); grupos.set(m.tipo, g);
      }
      const filas = [...grupos.values()].map((g) => ({ ...g, neto: Math.round((g.entradas - g.salidas) * 100) / 100 })).sort((a, b) => b.neto - a.neto);
      return { titulo: REPORTES.flujo, usaFechas: true, descripcion: 'Entradas y salidas reales de dinero por tipo. Las transferencias internas suman cero.',
        columnas: [{ k: 'concepto', t: 'Concepto' }, { k: 'entradas', t: 'Entradas', tipo: 'dinero' }, { k: 'salidas', t: 'Salidas', tipo: 'dinero' }, { k: 'neto', t: 'Neto', tipo: 'dinero' }],
        filas, totales: { entradas: sumar(filas, 'entradas'), salidas: sumar(filas, 'salidas'), neto: sumar(filas, 'neto') } };
    }
    case 'cxc': {
      const { data } = await s.from('v_pedidos').select('codigo, cliente_nombre, cliente_whatsapp, estado, fecha_entrega_prometida, total, cobrado, saldo_pendiente, atrasado').gt('saldo_pendiente', 0).order('fecha_entrega_prometida');
      const filas = (data ?? []).map((p) => ({ codigo: p.codigo, cliente: p.cliente_nombre, whatsapp: p.cliente_whatsapp?.replace(/^593/, '0') ?? '', estado: ESTADOS[p.estado as Estado], entrega: p.fecha_entrega_prometida,
        total: Number(p.total), cobrado: Number(p.cobrado), saldo: Number(p.saldo_pendiente) }));
      return { titulo: REPORTES.cxc, usaFechas: false, descripcion: 'Saldos pendientes de todos los pedidos activos, a la fecha de hoy.',
        columnas: [{ k: 'codigo', t: 'Pedido' }, { k: 'cliente', t: 'Cliente' }, { k: 'whatsapp', t: 'WhatsApp' }, { k: 'estado', t: 'Estado' }, { k: 'entrega', t: 'Entrega', tipo: 'fecha' }, { k: 'total', t: 'Total', tipo: 'dinero' }, { k: 'cobrado', t: 'Cobrado', tipo: 'dinero' }, { k: 'saldo', t: 'Saldo', tipo: 'dinero' }],
        filas, totales: { total: sumar(filas, 'total'), cobrado: sumar(filas, 'cobrado'), saldo: sumar(filas, 'saldo') } };
    }
    case 'cxp': {
      const { data } = await s.from('v_gastos').select('fecha, descripcion, categoria_nombre, proveedor_nombre, numero_comprobante, fecha_vencimiento, monto, saldo_pendiente, estado_pago').in('estado_pago', ['por_pagar', 'vencido']).order('fecha_vencimiento');
      const filas = (data ?? []).map((g) => ({ fecha: g.fecha, proveedor: g.proveedor_nombre, detalle: g.descripcion || g.categoria_nombre, comprobante: g.numero_comprobante, vence: g.fecha_vencimiento,
        estado: g.estado_pago === 'vencido' ? 'Vencido' : 'Por pagar', monto: Number(g.monto), saldo: Number(g.saldo_pendiente) }));
      return { titulo: REPORTES.cxp, usaFechas: false, descripcion: 'Facturas y obligaciones con proveedores pendientes de pago, a la fecha de hoy.',
        columnas: [{ k: 'fecha', t: 'Fecha', tipo: 'fecha' }, { k: 'proveedor', t: 'Proveedor' }, { k: 'detalle', t: 'Detalle' }, { k: 'comprobante', t: 'Comprobante' }, { k: 'vence', t: 'Vence', tipo: 'fecha' }, { k: 'estado', t: 'Estado' }, { k: 'monto', t: 'Monto', tipo: 'dinero' }, { k: 'saldo', t: 'Saldo', tipo: 'dinero' }],
        filas, totales: { monto: sumar(filas, 'monto'), saldo: sumar(filas, 'saldo') } };
    }
    case 'clientes': {
      const { data } = await s.from('v_clientes').select('codigo, nombre, whatsapp, tipo, n_pedidos, total_comprado, total_pagado, saldo_pendiente, ultimo_pedido').gt('n_pedidos', 0).order('total_comprado', { ascending: false }).limit(100);
      const filas = (data ?? []).map((c) => ({ codigo: c.codigo, nombre: c.nombre, whatsapp: c.whatsapp?.replace(/^593/, '0') ?? '', tipo: c.tipo === 'corporativo' ? 'Corporativo' : 'Persona', pedidos: c.n_pedidos,
        comprado: Number(c.total_comprado), pagado: Number(c.total_pagado), saldo: Number(c.saldo_pendiente), ultimo: c.ultimo_pedido }));
      return { titulo: REPORTES.clientes, usaFechas: false, descripcion: 'Clientes ordenados por total comprado (histórico).',
        columnas: [{ k: 'codigo', t: 'Código' }, { k: 'nombre', t: 'Cliente' }, { k: 'whatsapp', t: 'WhatsApp' }, { k: 'tipo', t: 'Tipo' }, { k: 'pedidos', t: 'Pedidos', tipo: 'numero' }, { k: 'comprado', t: 'Comprado', tipo: 'dinero' }, { k: 'pagado', t: 'Pagado', tipo: 'dinero' }, { k: 'saldo', t: 'Saldo', tipo: 'dinero' }, { k: 'ultimo', t: 'Último pedido', tipo: 'fecha' }],
        filas, totales: { comprado: sumar(filas, 'comprado'), pagado: sumar(filas, 'pagado'), saldo: sumar(filas, 'saldo') } };
    }
    case 'canales': {
      const { data } = await s.rpc('ventas_por_canal', { p_desde: desde, p_hasta: hasta });
      const filas = ((data ?? []) as { canal: string; pedidos: number; ventas: number }[]).map((c) => ({ canal: c.canal, pedidos: Number(c.pedidos), ventas: Number(c.ventas) }));
      return { titulo: REPORTES.canales, usaFechas: true, descripcion: 'Ventas realizadas según el canal registrado en cada pedido.',
        columnas: [{ k: 'canal', t: 'Canal' }, { k: 'pedidos', t: 'Pedidos', tipo: 'numero' }, { k: 'ventas', t: 'Ventas', tipo: 'dinero' }], filas, totales: { pedidos: sumar(filas, 'pedidos'), ventas: sumar(filas, 'ventas') } };
    }
    case 'pendientes': {
      const { data } = await s.from('v_pedidos').select('codigo, cliente_nombre, estado, prioridad, fecha_entrega_prometida, atrasado, total, saldo_pendiente')
        .not('estado', 'in', '(cotizado,entregado,cancelado,devolucion)').order('fecha_entrega_prometida');
      const filas = (data ?? []).map((p) => ({ codigo: p.codigo, cliente: p.cliente_nombre, estado: ESTADOS[p.estado as Estado], prioridad: p.prioridad, entrega: p.fecha_entrega_prometida, atrasado: p.atrasado ? 'Sí' : '', total: Number(p.total), saldo: Number(p.saldo_pendiente) }));
      return { titulo: REPORTES.pendientes, usaFechas: false, descripcion: 'Pedidos en curso a la fecha de hoy.',
        columnas: [{ k: 'codigo', t: 'Pedido' }, { k: 'cliente', t: 'Cliente' }, { k: 'estado', t: 'Estado' }, { k: 'prioridad', t: 'Prioridad' }, { k: 'entrega', t: 'Entrega', tipo: 'fecha' }, { k: 'atrasado', t: 'Atrasado' }, { k: 'total', t: 'Total', tipo: 'dinero' }, { k: 'saldo', t: 'Saldo', tipo: 'dinero' }],
        filas, totales: { total: sumar(filas, 'total'), saldo: sumar(filas, 'saldo') } };
    }
  }
  return null;
}
