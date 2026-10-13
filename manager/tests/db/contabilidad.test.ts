import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { como, crearBaseDePrueba, crearUsuario, n, uuid, type Usuario } from './helpers';

let db: Client;
let cerrar: () => Promise<void>;
let dbUrl: string;
let admin: Usuario, conta: Usuario, prod: Usuario, extrano: Usuario;
let caja: string, banco: string, cliente: string, catFilamento: string, catArriendo: string;
const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10); // America/Guayaquil (UTC-5)

async function nuevoPedido(u: Usuario, items: object[], extra: object = {}) {
  const [r] = await como(db, u, (q) => q('select public.guardar_pedido($1) as id', [JSON.stringify({ cliente_id: cliente, items, ...extra })]));
  return r.id as string;
}
const pedido = (id: string) => como(db, admin, (q) => q('select * from public.v_pedidos where id = $1', [id])).then((r) => r[0]);
const resumen = () => como(db, admin, (q) => q('select public.resumen_financiero($1, $1) as r', [hoy])).then((r) => r[0].r);
const estado = (u: Usuario, id: string, e: string, nota?: string) =>
  como(db, u, (q) => q('select public.cambiar_estado_pedido($1, $2, $3) as r', [id, e, nota ?? null])).then((r) => r[0].r);
const cobrar = (id: string, monto: number, subtipo = 'abono', cuenta = caja, idem: string | null = null) =>
  como(db, conta, (q) => q("select public.registrar_cobro($1, $2, $3, $4, 'efectivo', $5, null, null, $6) as id", [id, cuenta, monto, hoy, subtipo, idem])).then((r) => r[0].id);

beforeAll(async () => {
  ({ db, cerrar, url: dbUrl } = await crearBaseDePrueba());
  admin = await crearUsuario(db, 'brian@mas3d.test', 'administrador');
  conta = await crearUsuario(db, 'mayra@mas3d.test', 'contabilidad');
  prod = await crearUsuario(db, 'taller@mas3d.test', 'produccion');
  extrano = await crearUsuario(db, 'nadie@gmail.test');
  await como(db, admin, async (q) => {
    caja = (await q("insert into public.cuentas (nombre, subtipo, codigo, tipo) values ('Caja MAS3D', 'efectivo', 'x', 'activo') returning id"))[0].id;
    banco = (await q("insert into public.cuentas (nombre, subtipo, codigo, tipo) values ('Banco principal', 'banco', 'x', 'activo') returning id"))[0].id;
    cliente = (await q("insert into public.clientes (nombre, whatsapp) values ('Ana Pérez', '0991234567') returning id"))[0].id;
    catFilamento = (await q("select id from public.categorias_gasto where nombre = 'Filamento'"))[0].id;
    catArriendo = (await q("select id from public.categorias_gasto where nombre = 'Arriendo'"))[0].id;
  });
});
afterAll(async () => cerrar?.());

describe('Acceso y roles', () => {
  it('asigna el rol de la invitación y deja sin acceso a quien no fue invitado', async () => {
    const perfiles = await db.query('select email, rol, activo from public.perfiles order by email');
    expect(perfiles.rows.find((p) => p.email === 'brian@mas3d.test')).toMatchObject({ rol: 'administrador', activo: true });
    expect(perfiles.rows.find((p) => p.email === 'nadie@gmail.test')).toMatchObject({ rol: null, activo: false });
    const vistos = await como(db, extrano, (q) => q('select * from public.clientes'));
    expect(vistos).toHaveLength(0);
    await expect(como(db, extrano, (q) => q('select public.resumen_financiero($1, $1)', [hoy]))).rejects.toThrow(/permiso/);
  });

  it('un usuario no puede darse a sí mismo el rol de administrador', async () => {
    await expect(como(db, prod, (q) => q("update public.perfiles set rol = 'administrador' where id = $1", [prod.id]))).rejects.toThrow();
    const [p] = (await db.query('select rol from public.perfiles where id = $1', [prod.id])).rows;
    expect(p.rol).toBe('produccion');
  });

  it('no permite dejar el sistema sin administradores', async () => {
    await expect(como(db, admin, (q) => q("update public.perfiles set rol = 'contabilidad' where id = $1", [admin.id]))).rejects.toThrow(/al menos un administrador/);
  });
});

describe('Clientes', () => {
  it('genera código, normaliza WhatsApp y valida cédula', async () => {
    const [c] = await como(db, conta, (q) => q('select codigo, whatsapp from public.clientes where id = $1', [cliente]));
    expect(c.codigo).toBe('CLI-0001');
    expect(c.whatsapp).toBe('593991234567');
    await expect(como(db, conta, (q) => q("insert into public.clientes (nombre, tipo_identificacion, identificacion) values ('X', 'cedula', '0102030405')"))).rejects.toThrow(/chk_cliente_identificacion/);
    await como(db, conta, (q) => q("insert into public.clientes (nombre, tipo_identificacion, identificacion) values ('Cédula Válida', 'cedula', '0300000007')"));
  });

  it('impide duplicados por WhatsApp y avisa nombres parecidos', async () => {
    await expect(como(db, conta, (q) => q("insert into public.clientes (nombre, whatsapp) values ('Otra', '+593 99 123 4567')"))).rejects.toThrow(/uq_clientes_whatsapp/);
    const similares = await como(db, conta, (q) => q("select * from public.clientes_similares('ana perez')"));
    expect(similares[0].nombre).toBe('Ana Pérez');
  });

  it('producción no ve la tabla de clientes', async () => {
    expect(await como(db, prod, (q) => q('select * from public.clientes'))).toHaveLength(0);
  });
});

describe('Pedidos', () => {
  it('crea códigos consecutivos por año y calcula totales', async () => {
    const id = await nuevoPedido(conta, [
      { descripcion: 'Funko clásico 13 cm', cantidad: 2, precio_unitario: 40, descuento: 5 },
      { descripcion: 'Envío Servientrega', precio_unitario: 7, es_envio: true },
    ]);
    const p = await pedido(id);
    expect(p.codigo).toMatch(/^MAS-\d{4}-0001$/);
    expect(n(p.subtotal_productos)).toBe(75);
    expect(n(p.subtotal_envio)).toBe(7);
    expect(n(p.total)).toBe(82);
    expect(n(p.total_iva)).toBe(0); // IVA desactivado hasta confirmar con el contador
  });

  it('no repite códigos aunque se creen varios pedidos a la vez', async () => {
    const { Client } = await import('pg');
    const conexiones = await Promise.all(Array.from({ length: 5 }, async () => {
      const c = new Client({ connectionString: dbUrl });
      await c.connect();
      return c;
    }));
    const ids = await Promise.all(conexiones.map((c) => como(c, conta, (q) => q('select public.guardar_pedido($1) as id',
      [JSON.stringify({ cliente_id: cliente, items: [{ descripcion: 'Llavero', precio_unitario: 3 }] })])).then((r) => r[0].id)));
    await Promise.all(conexiones.map((c) => c.end()));
    const codigos = (await db.query('select codigo from public.pedidos where id = any($1)', [ids])).rows.map((r) => r.codigo);
    expect(new Set(codigos).size).toBe(5);
  });

  it('con IVA activo calcula base e IVA desde precios con IVA incluido', async () => {
    await como(db, admin, (q) => q('update public.configuracion set iva_activo = true, iva_tarifa = 15, precios_incluyen_iva = true'));
    const id = await nuevoPedido(conta, [{ descripcion: 'Figura', precio_unitario: 115 }]);
    const p = await pedido(id);
    expect([n(p.base_imponible), n(p.total_iva), n(p.total)]).toEqual([100, 15, 115]);
    await como(db, admin, (q) => q('update public.configuracion set iva_activo = false'));
  });

  it('no permite que un descuento supere el valor de la línea', async () => {
    await expect(nuevoPedido(conta, [{ descripcion: 'X', precio_unitario: 10, descuento: 11 }])).rejects.toThrow(/descuento/);
  });

  it('producción ve pedidos sin precios y no puede cancelarlos', async () => {
    const filas = await como(db, prod, (q) => q('select * from public.v_pedidos_produccion'));
    expect(filas.length).toBeGreaterThan(0);
    expect(Object.keys(filas[0])).not.toContain('total');
    expect(await como(db, prod, (q) => q('select * from public.pedidos'))).toHaveLength(0);
    expect(await como(db, prod, (q) => q('select * from public.v_pedidos'))).toHaveLength(0);
    await expect(estado(prod, filas[0].id, 'cancelado', 'x')).rejects.toThrow(/Solo administración/);
    await expect(como(db, prod, (q) => q("select public.guardar_pedido('{}')"))).rejects.toThrow(/permiso/);
  });
});

describe('Contabilidad: ventas, cobros y anticipos', () => {
  it('pedido de $100 con anticipo de $50: no es venta hasta entregarlo', async () => {
    await como(db, admin, (q) => q('select public.registrar_saldo_apertura($1, $2, 200)', [caja, hoy]));
    const antes = await resumen();
    const id = await nuevoPedido(conta, [{ descripcion: 'Mascota premium', precio_unitario: 100 }]);
    await cobrar(id, 50, 'anticipo');

    let p = await pedido(id);
    expect([n(p.cobrado), n(p.saldo_pendiente)]).toEqual([50, 50]);
    expect(p.estado).toBe('anticipo_recibido');
    let r = await resumen();
    expect(n(r.ventas_realizadas) - n(antes.ventas_realizadas)).toBe(0);
    expect(n(r.cobrado) - n(antes.cobrado)).toBe(50);
    expect(n(r.utilidad_neta) - n(antes.utilidad_neta)).toBe(0); // el anticipo NO es utilidad

    const aviso = await estado(conta, id, 'listo_entrega');
    expect(aviso.aviso).toMatch(/saldo pendiente de \$50\.00/);
    await estado(conta, id, 'entregado');
    r = await resumen();
    expect(n(r.ventas_realizadas) - n(antes.ventas_realizadas)).toBe(100);

    await cobrar(id, 50, 'saldo');
    p = await pedido(id);
    expect([n(p.cobrado), n(p.saldo_pendiente)]).toEqual([100, 0]);
    const saldo = async (clave: string) => n((await db.query(
      'select coalesce(sum(debe - haber), 0) s from public.asientos where pedido_id = $1 and cuenta_id = public.cuenta_id($2)', [id, clave])).rows[0].s);
    expect([await saldo('CXC'), await saldo('ANTICIPOS')]).toEqual([0, 0]);
  });

  it('una devolución del producto revierte la venta y deja el dinero a favor del cliente', async () => {
    const antes = await resumen();
    const id = await nuevoPedido(conta, [{ descripcion: 'Funko', precio_unitario: 40 }]);
    await cobrar(id, 40, 'anticipo');
    await estado(conta, id, 'entregado');
    await estado(conta, id, 'devolucion', 'Cliente devolvió por defecto');
    const r = await resumen();
    expect(n(r.ventas_realizadas) - n(antes.ventas_realizadas)).toBe(0);
    const p = await pedido(id);
    expect(n(p.saldo_a_favor)).toBe(40);
    await como(db, conta, (q) => q("select public.registrar_devolucion_cliente($1, $2, 40, $3, 'efectivo', 'Reembolso')", [id, caja, hoy]));
    expect(n((await pedido(id)).saldo_a_favor)).toBe(0);
    await expect(como(db, conta, (q) => q("select public.registrar_devolucion_cliente($1, $2, 1, $3, 'efectivo', 'otra')", [id, caja, hoy]))).rejects.toThrow(/Solo se puede devolver/);
  });

  it('doble clic: la misma clave crea un solo cobro', async () => {
    const id = await nuevoPedido(conta, [{ descripcion: 'Llavero', precio_unitario: 10 }]);
    const clave = uuid();
    const a = await cobrar(id, 5, 'anticipo', caja, clave);
    const b = await cobrar(id, 5, 'anticipo', caja, clave);
    expect(a).toBe(b);
    expect(n((await pedido(id)).cobrado)).toBe(5);
  });

  it('no acepta montos negativos ni con más de 2 decimales', async () => {
    const id = await nuevoPedido(conta, [{ descripcion: 'X', precio_unitario: 10 }]);
    await expect(cobrar(id, -5)).rejects.toThrow(/mayor que cero/);
    await expect(cobrar(id, 1.234)).rejects.toThrow(/2 decimales/);
  });
});

describe('Contabilidad: dinero que no es venta', () => {
  it('una transferencia entre cuentas propias no cambia ingresos ni utilidad', async () => {
    const antes = await resumen();
    await como(db, conta, (q) => q("select public.registrar_movimiento('transferencia', $1, 30, 'Depósito', $2, $3)", [hoy, caja, banco]));
    const r = await resumen();
    expect(n(r.ventas_realizadas)).toBe(n(antes.ventas_realizadas));
    expect(n(r.utilidad_neta)).toBe(n(antes.utilidad_neta));
    expect(n(r.caja_bancos)).toBe(n(antes.caja_bancos));
  });

  it('un préstamo recibido no es venta y el pago separa capital e intereses', async () => {
    const antes = await resumen();
    await como(db, conta, (q) => q("select public.registrar_movimiento('prestamo_recibido', $1, 1000, null, null, $2, 0, 'Crédito CBE')", [hoy, banco]));
    let r = await resumen();
    expect(n(r.ventas_realizadas)).toBe(n(antes.ventas_realizadas));
    expect(n(r.prestamos) - n(antes.prestamos)).toBe(1000);
    await como(db, conta, (q) => q("select public.registrar_movimiento('pago_prestamo', $1, 180, null, $2, null, 31, 'Crédito CBE')", [hoy, banco]));
    r = await resumen();
    expect(n(r.prestamos) - n(antes.prestamos)).toBe(820);
    expect(n(r.gastos_financieros) - n(antes.gastos_financieros)).toBe(31); // solo el interés es gasto
    expect(n(r.caja_bancos) - n(antes.caja_bancos)).toBe(1000 - 211);
  });

  it('aportes y retiros de propietarios no son ingresos ni gastos', async () => {
    const antes = await resumen();
    await como(db, conta, (q) => q("select public.registrar_movimiento('aporte', $1, 100, null, null, $2)", [hoy, caja]));
    await como(db, conta, (q) => q("select public.registrar_movimiento('retiro', $1, 60, null, $2, null)", [hoy, caja]));
    const r = await resumen();
    expect(n(r.utilidad_neta)).toBe(n(antes.utilidad_neta));
    expect(n(r.caja_bancos) - n(antes.caja_bancos)).toBe(40);
  });
});

describe('Gastos y cuentas por pagar', () => {
  it('gasto pagado, gasto por pagar y su pago', async () => {
    const antes = await resumen();
    await como(db, conta, (q) => q("select public.registrar_gasto($1, $2, 456, '27 rollos PLA+', true, $3, 'transferencia')", [hoy, catFilamento, banco]));
    const [g] = await como(db, conta, (q) => q("select public.registrar_gasto($1, $2, 150, 'Arriendo octubre', false) as id", [hoy, catArriendo]));
    let r = await resumen();
    expect(n(r.costos_directos) - n(antes.costos_directos)).toBe(456);
    expect(n(r.gastos_operativos) - n(antes.gastos_operativos)).toBe(150);
    expect(n(r.por_pagar) - n(antes.por_pagar)).toBe(150);
    await expect(como(db, conta, (q) => q("select public.pagar_gasto($1, $2, 200, $3, 'efectivo')", [g.id, caja, hoy]))).rejects.toThrow(/supera/);
    await como(db, conta, (q) => q("select public.pagar_gasto($1, $2, 150, $3, 'efectivo')", [g.id, caja, hoy]));
    r = await resumen();
    expect(n(r.por_pagar) - n(antes.por_pagar)).toBe(0);
    expect(n(r.gastos_operativos) - n(antes.gastos_operativos)).toBe(150); // pagar no duplica el gasto
    const [vg] = await como(db, conta, (q) => q('select estado_pago from public.v_gastos where id = $1', [g.id]));
    expect(vg.estado_pago).toBe('pagado');
  });

  it('la compra de maquinaria es inversión, no gasto', async () => {
    const antes = await resumen();
    const [cat] = await como(db, conta, (q) => q("select id from public.categorias_gasto where nombre = 'Maquinaria'"));
    await como(db, conta, (q) => q("select public.registrar_gasto($1, $2, 500, 'Impresora', true, $3, 'transferencia')", [hoy, cat.id, banco]));
    const r = await resumen();
    expect(n(r.gastos_total)).toBe(n(antes.gastos_total));
    expect(n(r.inversiones) - n(antes.inversiones)).toBe(500);
  });
});

describe('Anulaciones e inmutabilidad', () => {
  it('anular un gasto lo deja visible como anulado y corrige los saldos', async () => {
    const antes = await resumen();
    const [g] = await como(db, conta, (q) => q("select public.registrar_gasto($1, $2, 25, 'Error', true, $3, 'efectivo') as id", [hoy, catFilamento, caja]));
    const [{ transaccion_id }] = await como(db, conta, (q) => q('select transaccion_id from public.gastos where id = $1', [g.id]));
    await expect(como(db, conta, (q) => q("select public.anular_transaccion($1, 'x')", [transaccion_id]))).rejects.toThrow(/permiso/);
    await como(db, admin, (q) => q("select public.anular_transaccion($1, 'Registrado dos veces')", [transaccion_id]));
    const r = await resumen();
    expect(n(r.gastos_total)).toBe(n(antes.gastos_total));
    expect(n(r.caja_bancos)).toBe(n(antes.caja_bancos));
    const [vg] = await como(db, conta, (q) => q('select estado_pago from public.v_gastos where id = $1', [g.id]));
    expect(vg.estado_pago).toBe('anulado');
  });

  it('anular un anticipo de un pedido ya entregado vuelve a dejar la deuda del cliente', async () => {
    const id = await nuevoPedido(conta, [{ descripcion: 'Pareja 13 cm', precio_unitario: 65 }]);
    const tx = await cobrar(id, 30, 'anticipo');
    await estado(conta, id, 'entregado');
    expect(n((await pedido(id)).saldo_pendiente)).toBe(35);
    await como(db, admin, (q) => q("select public.anular_transaccion($1, 'Transferencia rebotada')", [tx]));
    const p = await pedido(id);
    expect([n(p.cobrado), n(p.saldo_pendiente)]).toEqual([0, 65]);
    const cxc = (await db.query("select sum(debe - haber) s from public.asientos where pedido_id = $1 and cuenta_id = public.cuenta_id('CXC')", [id])).rows[0].s;
    expect(n(cxc)).toBe(65);
  });

  it('los asientos no se pueden modificar ni borrar, ni escribir directamente', async () => {
    await expect(db.query('update public.asientos set debe = debe + 1 where id = (select min(id) from public.asientos)')).rejects.toThrow(/no se modifican/);
    await expect(db.query('delete from public.transacciones where numero = 1')).rejects.toThrow(/no se eliminan/);
    await expect(como(db, admin, (q) => q("insert into public.transacciones (fecha, tipo, monto) values (current_date, 'cobro', 1)"))).rejects.toThrow(/permission denied/);
    await expect(como(db, admin, (q) => q("select public._asiento(gen_random_uuid(), gen_random_uuid(), 1, 0)"))).rejects.toThrow(/permission denied/);
  });

  it('no se puede registrar un saldo inicial dos veces', async () => {
    await expect(como(db, admin, (q) => q('select public.registrar_saldo_apertura($1, $2, 50)', [caja, hoy]))).rejects.toThrow(/ya tiene saldo inicial/);
  });

  it('el libro siempre cuadra y la caja coincide con los movimientos', async () => {
    const [tot] = (await db.query('select sum(debe) d, sum(haber) h from public.asientos')).rows;
    expect(n(tot.d)).toBe(n(tot.h));
    const [{ s }] = (await db.query('select sum(saldo) s from public.v_cuentas_saldo')).rows;
    const [{ m }] = (await db.query('select sum(entrada - salida) m from public.v_movimientos')).rows;
    expect(n(s)).toBe(n(m));
    expect(n(s)).toBe(n((await resumen()).caja_bancos));
  });
});

describe('Verificación en dos pasos', () => {
  it('sin completar el segundo paso, un usuario con 2FA activo no ve datos', async () => {
    await db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [conta.id]);
    const sin = await como(db, conta, (q) => q('select count(*)::int n from public.clientes'));
    expect(sin[0].n).toBe(0);
    await db.query('begin');
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: conta.id, role: 'authenticated', aal: 'aal2' })]);
    await db.query('set local role authenticated');
    const con = (await db.query('select count(*)::int n from public.clientes')).rows[0].n;
    await db.query('commit');
    expect(con).toBeGreaterThan(0);
    await db.query('delete from auth.mfa_factors where user_id = $1', [conta.id]);
  });
});
