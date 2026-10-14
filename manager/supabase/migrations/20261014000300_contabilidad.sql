-- =====================================================================
-- MAS3D Manager · 0003 · Contabilidad: partida doble interna
--
-- Reglas:
--  * Todo movimiento de dinero es una TRANSACCIÓN con ASIENTOS que cuadran (debe = haber).
--  * Los asientos nunca se modifican ni se borran. Un error se corrige ANULANDO,
--    lo que crea una transacción inversa con la misma fecha.
--  * Los saldos se calculan siempre desde los asientos.
--  * Ventas se reconocen al enviar/entregar el pedido; antes, lo cobrado es
--    "Anticipos de clientes" (pasivo), no venta ni utilidad.
-- =====================================================================

create type public.tipo_cuenta as enum ('activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto');
create type public.subtipo_financiera as enum ('efectivo', 'banco', 'billetera', 'otro');
create type public.clasificacion_gasto as enum ('costo_directo', 'gasto_operativo', 'inversion', 'financiero', 'impuesto');
create type public.metodo_pago as enum ('efectivo', 'transferencia', 'tarjeta', 'deuna', 'paypal', 'otro');
create type public.tipo_transaccion as enum (
  'apertura', 'cobro', 'devolucion_cliente', 'venta', 'reversion_venta', 'retencion_anticipo',
  'gasto', 'pago_gasto', 'transferencia', 'aporte', 'retiro', 'prestamo_recibido', 'pago_prestamo',
  'otro_ingreso', 'ajuste', 'anulacion'
);

-- ---------- Plan de cuentas (incluye las cuentas de dinero) ----------
create table public.cuentas (
  id                uuid primary key default gen_random_uuid(),
  clave             text unique,           -- cuentas del sistema (no se pueden eliminar)
  codigo            text not null unique,
  nombre            text not null,
  tipo              public.tipo_cuenta not null,
  es_financiera     boolean not null default false,
  subtipo           public.subtipo_financiera,
  institucion       text,
  numero_referencia text,
  activa            boolean not null default true,
  orden             int not null default 100,
  created_at        timestamptz not null default now(),
  check (not es_financiera or (tipo = 'activo' and subtipo is not null))
);
create trigger aud_cuentas after insert or update or delete on public.cuentas for each row execute function public.registrar_auditoria();

insert into public.cuentas (clave, codigo, nombre, tipo, orden) values
  ('CXC',            '1.2.01', 'Cuentas por cobrar a clientes',          'activo',     10),
  ('ACTIVOS_FIJOS',  '1.5.01', 'Maquinaria, equipos y activos fijos',    'activo',     20),
  ('ANTICIPOS',      '2.1.01', 'Anticipos recibidos de clientes',        'pasivo',     30),
  ('CXP',            '2.2.01', 'Cuentas por pagar a proveedores',        'pasivo',     31),
  ('PRESTAMOS',      '2.3.01', 'Préstamos y créditos por pagar',         'pasivo',     32),
  ('IVA',            '2.4.01', 'IVA cobrado por pagar',                  'pasivo',     33),
  ('CAPITAL',        '3.1.01', 'Aportes de los propietarios',            'patrimonio', 40),
  ('RETIROS',        '3.2.01', 'Retiros de los propietarios',            'patrimonio', 41),
  ('APERTURA',       '3.3.01', 'Saldos de apertura',                     'patrimonio', 42),
  ('VENTAS',         '4.1.01', 'Ventas de productos y servicios',        'ingreso',    50),
  ('ENVIOS',         '4.1.02', 'Ingresos por envíos cobrados',           'ingreso',    51),
  ('OTROS_INGRESOS', '4.2.01', 'Otros ingresos',                         'ingreso',    52),
  ('COSTOS',         '5.1.01', 'Costos directos de producción',          'costo',      60),
  ('GASTOS_OP',      '6.1.01', 'Gastos operativos',                      'gasto',      70),
  ('DIF_CAJA',       '6.1.99', 'Diferencias y ajustes de caja',          'gasto',      71),
  ('GASTOS_FIN',     '6.2.01', 'Gastos financieros (intereses)',         'gasto',      72),
  ('IMPUESTOS',      '6.3.01', 'Impuestos y contribuciones',             'gasto',      73);

create or replace function public.cuenta_id(p_clave text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.cuentas where clave = p_clave
$$;

-- ---------- Categorías de gasto ----------
create table public.categorias_gasto (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  clasificacion  public.clasificacion_gasto not null,
  activa         boolean not null default true,
  orden          int not null default 100
);
create trigger aud_categorias after insert or update or delete on public.categorias_gasto for each row execute function public.registrar_auditoria();

insert into public.categorias_gasto (nombre, clasificacion, orden) values
  ('Filamento', 'costo_directo', 1), ('Pinturas', 'costo_directo', 2), ('Pinceles', 'costo_directo', 3),
  ('Pegamentos', 'costo_directo', 4), ('Cajas MDF', 'costo_directo', 5), ('Materiales de sublimación', 'costo_directo', 6),
  ('Publicidad', 'gasto_operativo', 10), ('Sueldos', 'gasto_operativo', 11), ('Arriendo', 'gasto_operativo', 12),
  ('Electricidad', 'gasto_operativo', 13), ('Internet', 'gasto_operativo', 14), ('Software', 'gasto_operativo', 15),
  ('Envíos', 'gasto_operativo', 16), ('Transporte', 'gasto_operativo', 17), ('Repuestos', 'gasto_operativo', 18),
  ('Mantenimiento', 'gasto_operativo', 19), ('Herramientas', 'gasto_operativo', 20),
  ('Maquinaria', 'inversion', 30), ('Intereses', 'financiero', 40), ('Impuestos', 'impuesto', 50),
  ('Otros', 'gasto_operativo', 99);

create or replace function public.cuenta_de_clasificacion(c public.clasificacion_gasto)
returns uuid language sql stable security definer set search_path = public as $$
  select public.cuenta_id(case c
    when 'costo_directo' then 'COSTOS'
    when 'gasto_operativo' then 'GASTOS_OP'
    when 'inversion' then 'ACTIVOS_FIJOS'
    when 'financiero' then 'GASTOS_FIN'
    when 'impuesto' then 'IMPUESTOS' end)
$$;

-- ---------- Transacciones y asientos ----------
create table public.transacciones (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity unique,
  fecha            date not null,
  tipo             public.tipo_transaccion not null,
  subtipo          text,                         -- p.ej. anticipo / abono / saldo para cobros
  descripcion      text not null default '',
  monto            numeric(12, 2) not null check (monto > 0),  -- importe principal (informativo)
  metodo_pago      public.metodo_pago,
  comprobante      text,
  pedido_id        uuid references public.pedidos (id),
  cliente_id       uuid references public.clientes (id),
  proveedor_id     uuid references public.proveedores (id),
  gasto_id         uuid,
  referencia       text,                         -- p.ej. nombre del préstamo
  anulada          boolean not null default false,
  anulada_at       timestamptz,
  anulada_por      uuid references public.perfiles (id),
  motivo_anulacion text,
  anula_a_id       uuid references public.transacciones (id),
  idempotency_key  uuid unique,
  creado_por       uuid references public.perfiles (id) default auth.uid(),
  created_at       timestamptz not null default now()
);
create index idx_tx_fecha on public.transacciones (fecha);
create index idx_tx_pedido on public.transacciones (pedido_id);
create index idx_tx_tipo on public.transacciones (tipo);
alter table public.pedidos add constraint fk_pedido_venta_tx foreign key (venta_transaccion_id) references public.transacciones (id);

create table public.asientos (
  id              bigint generated always as identity primary key,
  transaccion_id  uuid not null references public.transacciones (id),
  cuenta_id       uuid not null references public.cuentas (id),
  debe            numeric(12, 2) not null default 0 check (debe >= 0),
  haber           numeric(12, 2) not null default 0 check (haber >= 0),
  categoria_id    uuid references public.categorias_gasto (id),
  pedido_id       uuid references public.pedidos (id),
  check ((debe > 0) <> (haber > 0))
);
create index idx_asientos_tx on public.asientos (transaccion_id);
create index idx_asientos_cuenta on public.asientos (cuenta_id);
create index idx_asientos_pedido on public.asientos (pedido_id);

-- Inmutabilidad
create or replace function public.prohibir_cambios()
returns trigger language plpgsql as $$
begin
  raise exception 'Los registros contables no se modifican ni se eliminan. Usa "Anular".';
end $$;
create trigger trg_asientos_inmutables before update or delete on public.asientos for each row execute function public.prohibir_cambios();

create or replace function public.proteger_transaccion()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los registros contables no se eliminan. Usa "Anular".';
  end if;
  if (to_jsonb(new) - array['anulada', 'anulada_at', 'anulada_por', 'motivo_anulacion'])
     is distinct from (to_jsonb(old) - array['anulada', 'anulada_at', 'anulada_por', 'motivo_anulacion'])
     or (old.anulada and not new.anulada) then
    raise exception 'Una transacción registrada no se puede modificar. Anúlala y vuelve a registrarla.';
  end if;
  return new;
end $$;
create trigger trg_tx_proteger before update or delete on public.transacciones for each row execute function public.proteger_transaccion();
create trigger aud_transacciones after insert or update on public.transacciones for each row execute function public.registrar_auditoria();

-- Cuadre: se verifica al final de la transacción de base de datos
create or replace function public.verificar_cuadre()
returns trigger language plpgsql as $$
declare v_debe numeric; v_haber numeric; v_n int;
begin
  select coalesce(sum(debe), 0), coalesce(sum(haber), 0), count(*) into v_debe, v_haber, v_n
  from public.asientos where transaccion_id = new.transaccion_id;
  if v_n < 2 or v_debe <> v_haber then
    raise exception 'Asiento descuadrado en transacción % (debe %, haber %)', new.transaccion_id, v_debe, v_haber;
  end if;
  return null;
end $$;
create constraint trigger trg_asientos_cuadre after insert on public.asientos
  deferrable initially deferred for each row execute function public.verificar_cuadre();

-- ---------- Gastos (documento) ----------
create table public.gastos (
  id                 uuid primary key default gen_random_uuid(),
  fecha              date not null,
  categoria_id       uuid not null references public.categorias_gasto (id),
  proveedor_id       uuid references public.proveedores (id),
  descripcion        text not null default '',
  monto              numeric(12, 2) not null check (monto > 0),
  numero_comprobante text,
  fecha_vencimiento  date,
  pedido_id          uuid references public.pedidos (id),
  responsable_id     uuid references public.perfiles (id) default auth.uid(),
  transaccion_id     uuid references public.transacciones (id),
  anulado            boolean not null default false,
  idempotency_key    uuid unique,
  created_at         timestamptz not null default now()
);
create index idx_gastos_fecha on public.gastos (fecha);
alter table public.transacciones add constraint fk_tx_gasto foreign key (gasto_id) references public.gastos (id);
create trigger aud_gastos after insert or update on public.gastos for each row execute function public.registrar_auditoria();

-- =====================================================================
-- Funciones internas
-- =====================================================================
create or replace function public._nueva_tx(
  p_fecha date, p_tipo public.tipo_transaccion, p_monto numeric, p_descripcion text,
  p_idem uuid default null, p_subtipo text default null, p_metodo public.metodo_pago default null,
  p_comprobante text default null, p_pedido uuid default null, p_cliente uuid default null,
  p_proveedor uuid default null, p_gasto uuid default null, p_referencia text default null,
  p_anula uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_fecha is null then raise exception 'La fecha es obligatoria'; end if;
  if p_fecha > (now() at time zone 'America/Guayaquil')::date + 1 then
    raise exception 'No se pueden registrar movimientos con fecha futura';
  end if;
  insert into public.transacciones (fecha, tipo, subtipo, descripcion, monto, metodo_pago, comprobante,
    pedido_id, cliente_id, proveedor_id, gasto_id, referencia, anula_a_id, idempotency_key)
  values (p_fecha, p_tipo, p_subtipo, coalesce(p_descripcion, ''), round(p_monto, 2), p_metodo, nullif(p_comprobante, ''),
    p_pedido, p_cliente, p_proveedor, p_gasto, p_referencia, p_anula, p_idem)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public._asiento(p_tx uuid, p_cuenta uuid, p_debe numeric, p_haber numeric,
  p_categoria uuid default null, p_pedido uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_debe, 0) = 0 and coalesce(p_haber, 0) = 0 then return; end if;
  if p_cuenta is null then raise exception 'Cuenta contable inexistente'; end if;
  insert into public.asientos (transaccion_id, cuenta_id, debe, haber, categoria_id, pedido_id)
  values (p_tx, p_cuenta, round(coalesce(p_debe, 0), 2), round(coalesce(p_haber, 0), 2), p_categoria, p_pedido);
end $$;

create or replace function public._validar_cuenta_financiera(p_cuenta uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cuentas where id = p_cuenta and es_financiera and activa) then
    raise exception 'Selecciona una cuenta de dinero activa (caja, banco, etc.)';
  end if;
end $$;

create or replace function public._validar_monto(p numeric)
returns void language plpgsql immutable as $$
begin
  if p is null or p <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if p <> round(p, 2) then raise exception 'El monto solo puede tener 2 decimales'; end if;
end $$;

-- Si ya se procesó una operación con la misma clave, devuelve su id (evita duplicados por doble clic o reintentos)
create or replace function public._tx_existente(p_idem uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.transacciones where p_idem is not null and idempotency_key = p_idem
$$;

-- Saldo contable de una cuenta para un pedido (debe - haber)
create or replace function public._saldo_pedido(p_pedido uuid, p_clave text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(a.debe - a.haber), 0) from public.asientos a
  where a.pedido_id = p_pedido and a.cuenta_id = public.cuenta_id(p_clave)
$$;

-- =====================================================================
-- Operaciones de dinero (API para la app)
-- =====================================================================

-- Saldo inicial de una cuenta de dinero (una sola vez por cuenta)
create or replace function public.registrar_saldo_apertura(p_cuenta uuid, p_fecha date, p_monto numeric, p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tx uuid;
begin
  perform public.exigir_rol(array['administrador']::public.rol_usuario[]);
  v_tx := public._tx_existente(p_idem); if v_tx is not null then return v_tx; end if;
  perform public._validar_cuenta_financiera(p_cuenta);
  if p_monto is null or p_monto < 0 then raise exception 'El saldo inicial no puede ser negativo'; end if;
  if exists (select 1 from public.transacciones t join public.asientos a on a.transaccion_id = t.id
             where t.tipo = 'apertura' and not t.anulada and a.cuenta_id = p_cuenta) then
    raise exception 'Esta cuenta ya tiene saldo inicial. Anúlalo para registrar otro.';
  end if;
  if p_monto = 0 then return null; end if;
  v_tx := public._nueva_tx(p_fecha, 'apertura', p_monto, 'Saldo inicial', p_idem);
  perform public._asiento(v_tx, p_cuenta, p_monto, 0);
  perform public._asiento(v_tx, public.cuenta_id('APERTURA'), 0, p_monto);
  return v_tx;
end $$;

-- Cobro a un cliente por un pedido (anticipo, abono o saldo)
create or replace function public.registrar_cobro(
  p_pedido uuid, p_cuenta uuid, p_monto numeric, p_fecha date, p_metodo public.metodo_pago,
  p_subtipo text default 'abono', p_comprobante text default null, p_nota text default null, p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tx uuid; p public.pedidos; v_cxc numeric; v_a_cxc numeric; v_a_ant numeric;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  v_tx := public._tx_existente(p_idem); if v_tx is not null then return v_tx; end if;
  perform public._validar_monto(p_monto);
  perform public._validar_cuenta_financiera(p_cuenta);
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado = 'cancelado' then raise exception 'No se pueden registrar cobros en un pedido cancelado'; end if;
  if p_subtipo not in ('anticipo', 'abono', 'saldo') then raise exception 'Tipo de cobro no válido'; end if;

  -- Si la venta ya está reconocida, el cobro reduce la cuenta por cobrar; lo que exceda queda como saldo a favor
  v_cxc := case when p.venta_reconocida_at is not null then greatest(public._saldo_pedido(p.id, 'CXC'), 0) else 0 end;
  v_a_cxc := least(p_monto, v_cxc);
  v_a_ant := p_monto - v_a_cxc;

  v_tx := public._nueva_tx(p_fecha, 'cobro', p_monto,
    coalesce(nullif(p_nota, ''), initcap(p_subtipo) || ' pedido ' || p.codigo), p_idem, p_subtipo, p_metodo,
    p_comprobante, p.id, p.cliente_id);
  perform public._asiento(v_tx, p_cuenta, p_monto, 0, null, p.id);
  perform public._asiento(v_tx, public.cuenta_id('CXC'), 0, v_a_cxc, null, p.id);
  perform public._asiento(v_tx, public.cuenta_id('ANTICIPOS'), 0, v_a_ant, null, p.id);

  if p.estado = 'confirmado' and p_subtipo = 'anticipo' then
    update public.pedidos set estado = 'anticipo_recibido' where id = p.id;
    insert into public.pedido_historial (pedido_id, estado_anterior, estado_nuevo, nota)
    values (p.id, p.estado, 'anticipo_recibido', 'Automático al registrar anticipo');
  end if;
  return v_tx;
end $$;

-- Devolución de dinero a un cliente (solo del saldo a favor / anticipos del pedido)
create or replace function public.registrar_devolucion_cliente(
  p_pedido uuid, p_cuenta uuid, p_monto numeric, p_fecha date, p_metodo public.metodo_pago,
  p_motivo text, p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tx uuid; p public.pedidos; v_disp numeric;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  v_tx := public._tx_existente(p_idem); if v_tx is not null then return v_tx; end if;
  perform public._validar_monto(p_monto);
  perform public._validar_cuenta_financiera(p_cuenta);
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo de la devolución'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  v_disp := -public._saldo_pedido(p.id, 'ANTICIPOS');
  if p_monto > v_disp then
    raise exception 'Solo se puede devolver el dinero a favor del cliente en este pedido (%). Si el producto ya fue entregado, primero marca el pedido como devolución.', v_disp;
  end if;
  v_tx := public._nueva_tx(p_fecha, 'devolucion_cliente', p_monto, 'Devolución pedido ' || p.codigo || ': ' || p_motivo,
    p_idem, null, p_metodo, null, p.id, p.cliente_id);
  perform public._asiento(v_tx, public.cuenta_id('ANTICIPOS'), p_monto, 0, null, p.id);
  perform public._asiento(v_tx, p_cuenta, 0, p_monto, null, p.id);
  return v_tx;
end $$;

-- Retener un anticipo como ingreso (p.ej. cliente desiste y se acordó no devolver)
create or replace function public.retener_anticipo(p_pedido uuid, p_monto numeric, p_fecha date, p_motivo text, p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tx uuid; p public.pedidos; v_disp numeric;
begin
  perform public.exigir_rol(array['administrador']::public.rol_usuario[]);
  v_tx := public._tx_existente(p_idem); if v_tx is not null then return v_tx; end if;
  perform public._validar_monto(p_monto);
  select * into p from public.pedidos where id = p_pedido for update;
  if p.estado <> 'cancelado' then raise exception 'Solo se retiene el anticipo de pedidos cancelados'; end if;
  v_disp := -public._saldo_pedido(p.id, 'ANTICIPOS');
  if p_monto > v_disp then raise exception 'El monto supera el anticipo disponible (%)', v_disp; end if;
  v_tx := public._nueva_tx(p_fecha, 'retencion_anticipo', p_monto, 'Anticipo retenido ' || p.codigo || ': ' || coalesce(p_motivo, ''),
    p_idem, null, null, null, p.id, p.cliente_id);
  perform public._asiento(v_tx, public.cuenta_id('ANTICIPOS'), p_monto, 0, null, p.id);
  perform public._asiento(v_tx, public.cuenta_id('OTROS_INGRESOS'), 0, p_monto, null, p.id);
  return v_tx;
end $$;

-- Reconocimiento de la venta (se llama automáticamente al enviar/entregar)
create or replace function public._reconocer_venta(p_pedido uuid, p_fecha date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos; v_tx uuid; v_ant numeric; v_aplicar numeric;
  v_base_prod numeric; v_base_envio numeric;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if p.venta_reconocida_at is not null then return p.venta_transaccion_id; end if;
  if p.total <= 0 then
    update public.pedidos set venta_reconocida_at = now() where id = p.id;
    return null;
  end if;
  select coalesce(sum(base) filter (where not es_envio), 0), coalesce(sum(base) filter (where es_envio), 0)
    into v_base_prod, v_base_envio from public.pedido_items where pedido_id = p.id;
  v_ant := greatest(-public._saldo_pedido(p.id, 'ANTICIPOS'), 0);
  v_aplicar := least(v_ant, p.total);

  v_tx := public._nueva_tx(p_fecha, 'venta', p.total, 'Venta pedido ' || p.codigo, null, null, null, null, p.id, p.cliente_id);
  perform public._asiento(v_tx, public.cuenta_id('ANTICIPOS'), v_aplicar, 0, null, p.id);
  perform public._asiento(v_tx, public.cuenta_id('CXC'), p.total - v_aplicar, 0, null, p.id);
  perform public._asiento(v_tx, public.cuenta_id('VENTAS'), 0, v_base_prod, null, p.id);
  perform public._asiento(v_tx, public.cuenta_id('ENVIOS'), 0, v_base_envio, null, p.id);
  perform public._asiento(v_tx, public.cuenta_id('IVA'), 0, p.total_iva, null, p.id);
  update public.pedidos set venta_reconocida_at = now(), venta_transaccion_id = v_tx where id = p.id;
  return v_tx;
end $$;

-- Reversión de la venta (devolución del producto o cancelación posterior a la entrega).
-- Todo lo cobrado queda como saldo a favor del cliente (anticipos), listo para devolver o retener.
create or replace function public._revertir_venta(p_pedido uuid, p_fecha date, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare p public.pedidos; v_tx uuid; v_cxc numeric; v_ventas numeric; v_envios numeric; v_iva numeric;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if p.venta_reconocida_at is null then return null; end if;
  if p.venta_transaccion_id is not null then
    select coalesce(sum(haber - debe) filter (where cuenta_id = public.cuenta_id('VENTAS')), 0),
           coalesce(sum(haber - debe) filter (where cuenta_id = public.cuenta_id('ENVIOS')), 0),
           coalesce(sum(haber - debe) filter (where cuenta_id = public.cuenta_id('IVA')), 0)
      into v_ventas, v_envios, v_iva
    from public.asientos where transaccion_id = p.venta_transaccion_id;
    v_cxc := greatest(public._saldo_pedido(p.id, 'CXC'), 0);
    v_tx := public._nueva_tx(p_fecha, 'reversion_venta', v_ventas + v_envios + v_iva,
      'Reversión de venta ' || p.codigo || coalesce(': ' || p_motivo, ''), null, null, null, null, p.id, p.cliente_id);
    perform public._asiento(v_tx, public.cuenta_id('VENTAS'), v_ventas, 0, null, p.id);
    perform public._asiento(v_tx, public.cuenta_id('ENVIOS'), v_envios, 0, null, p.id);
    perform public._asiento(v_tx, public.cuenta_id('IVA'), v_iva, 0, null, p.id);
    perform public._asiento(v_tx, public.cuenta_id('CXC'), 0, v_cxc, null, p.id);
    perform public._asiento(v_tx, public.cuenta_id('ANTICIPOS'), 0, v_ventas + v_envios + v_iva - v_cxc, null, p.id);
  end if;
  update public.pedidos set venta_reconocida_at = null, venta_transaccion_id = null where id = p.id;
  return v_tx;
end $$;

-- Gasto: pagado al momento o por pagar (cuenta por pagar)
create or replace function public.registrar_gasto(
  p_fecha date, p_categoria uuid, p_monto numeric, p_descripcion text,
  p_pagado boolean, p_cuenta uuid default null, p_metodo public.metodo_pago default null,
  p_proveedor uuid default null, p_comprobante text default null, p_vencimiento date default null,
  p_pedido uuid default null, p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_gasto uuid; v_tx uuid; c public.categorias_gasto;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  select id into v_gasto from public.gastos where p_idem is not null and idempotency_key = p_idem;
  if v_gasto is not null then return v_gasto; end if;
  perform public._validar_monto(p_monto);
  select * into c from public.categorias_gasto where id = p_categoria and activa;
  if not found then raise exception 'Selecciona una categoría válida'; end if;
  if p_pagado then perform public._validar_cuenta_financiera(p_cuenta); end if;

  insert into public.gastos (fecha, categoria_id, proveedor_id, descripcion, monto, numero_comprobante,
    fecha_vencimiento, pedido_id, idempotency_key)
  values (p_fecha, p_categoria, p_proveedor, coalesce(p_descripcion, ''), p_monto, nullif(p_comprobante, ''),
    case when p_pagado then null else p_vencimiento end, p_pedido, p_idem)
  returning id into v_gasto;

  v_tx := public._nueva_tx(p_fecha, 'gasto', p_monto, c.nombre || coalesce(': ' || nullif(p_descripcion, ''), ''),
    null, case when p_pagado then 'contado' else 'por_pagar' end, case when p_pagado then p_metodo end,
    p_comprobante, p_pedido, null, p_proveedor, v_gasto);
  perform public._asiento(v_tx, public.cuenta_de_clasificacion(c.clasificacion), p_monto, 0, c.id, p_pedido);
  if p_pagado then
    perform public._asiento(v_tx, p_cuenta, 0, p_monto, null, p_pedido);
  else
    perform public._asiento(v_tx, public.cuenta_id('CXP'), 0, p_monto, null, p_pedido);
  end if;
  update public.gastos set transaccion_id = v_tx where id = v_gasto;
  return v_gasto;
end $$;

-- Saldo pendiente de un gasto por pagar
create or replace function public.saldo_gasto(p_gasto uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(a.haber - a.debe), 0)
  from public.asientos a join public.transacciones t on t.id = a.transaccion_id
  where t.gasto_id = p_gasto and a.cuenta_id = public.cuenta_id('CXP')
$$;

create or replace function public.pagar_gasto(p_gasto uuid, p_cuenta uuid, p_monto numeric, p_fecha date,
  p_metodo public.metodo_pago, p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tx uuid; g public.gastos; v_saldo numeric;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  v_tx := public._tx_existente(p_idem); if v_tx is not null then return v_tx; end if;
  perform public._validar_monto(p_monto);
  perform public._validar_cuenta_financiera(p_cuenta);
  select * into g from public.gastos where id = p_gasto for update;
  if not found or g.anulado then raise exception 'Gasto no encontrado o anulado'; end if;
  v_saldo := public.saldo_gasto(g.id);
  if p_monto > v_saldo then raise exception 'El pago (%) supera el saldo pendiente (%)', p_monto, v_saldo; end if;
  v_tx := public._nueva_tx(p_fecha, 'pago_gasto', p_monto, 'Pago de gasto: ' || g.descripcion, p_idem, null, p_metodo,
    null, g.pedido_id, null, g.proveedor_id, g.id);
  perform public._asiento(v_tx, public.cuenta_id('CXP'), p_monto, 0);
  perform public._asiento(v_tx, p_cuenta, 0, p_monto);
  return v_tx;
end $$;

-- Movimientos que no son ventas ni gastos
create or replace function public.registrar_movimiento(
  p_tipo public.tipo_transaccion, p_fecha date, p_monto numeric, p_descripcion text,
  p_cuenta_origen uuid default null, p_cuenta_destino uuid default null,
  p_interes numeric default 0, p_referencia text default null, p_metodo public.metodo_pago default null,
  p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tx uuid; v_total numeric;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  v_tx := public._tx_existente(p_idem); if v_tx is not null then return v_tx; end if;
  perform public._validar_monto(p_monto);

  if p_tipo = 'transferencia' then
    -- Entre cuentas propias: NO es ingreso ni gasto
    perform public._validar_cuenta_financiera(p_cuenta_origen);
    perform public._validar_cuenta_financiera(p_cuenta_destino);
    if p_cuenta_origen = p_cuenta_destino then raise exception 'La cuenta de origen y destino deben ser distintas'; end if;
    v_tx := public._nueva_tx(p_fecha, p_tipo, p_monto, coalesce(nullif(p_descripcion, ''), 'Transferencia entre cuentas'), p_idem, null, p_metodo);
    perform public._asiento(v_tx, p_cuenta_destino, p_monto, 0);
    perform public._asiento(v_tx, p_cuenta_origen, 0, p_monto);
  elsif p_tipo = 'aporte' then
    perform public._validar_cuenta_financiera(p_cuenta_destino);
    v_tx := public._nueva_tx(p_fecha, p_tipo, p_monto, coalesce(nullif(p_descripcion, ''), 'Aporte de propietario'), p_idem, null, p_metodo);
    perform public._asiento(v_tx, p_cuenta_destino, p_monto, 0);
    perform public._asiento(v_tx, public.cuenta_id('CAPITAL'), 0, p_monto);
  elsif p_tipo = 'retiro' then
    perform public._validar_cuenta_financiera(p_cuenta_origen);
    v_tx := public._nueva_tx(p_fecha, p_tipo, p_monto, coalesce(nullif(p_descripcion, ''), 'Retiro de propietario'), p_idem, null, p_metodo);
    perform public._asiento(v_tx, public.cuenta_id('RETIROS'), p_monto, 0);
    perform public._asiento(v_tx, p_cuenta_origen, 0, p_monto);
  elsif p_tipo = 'prestamo_recibido' then
    -- Un préstamo aumenta el dinero y la deuda: NO es venta
    perform public._validar_cuenta_financiera(p_cuenta_destino);
    if coalesce(trim(p_referencia), '') = '' then raise exception 'Indica el acreedor o nombre del préstamo'; end if;
    v_tx := public._nueva_tx(p_fecha, p_tipo, p_monto, coalesce(nullif(p_descripcion, ''), 'Préstamo recibido'), p_idem, null, p_metodo,
      null, null, null, null, null, p_referencia);
    perform public._asiento(v_tx, p_cuenta_destino, p_monto, 0);
    perform public._asiento(v_tx, public.cuenta_id('PRESTAMOS'), 0, p_monto);
  elsif p_tipo = 'pago_prestamo' then
    -- p_monto = capital; p_interes = intereses (gasto financiero)
    perform public._validar_cuenta_financiera(p_cuenta_origen);
    if coalesce(p_interes, 0) < 0 then raise exception 'El interés no puede ser negativo'; end if;
    if coalesce(trim(p_referencia), '') = '' then raise exception 'Indica el préstamo que se paga'; end if;
    v_total := p_monto + coalesce(p_interes, 0);
    v_tx := public._nueva_tx(p_fecha, p_tipo, v_total, coalesce(nullif(p_descripcion, ''), 'Pago de préstamo'), p_idem, null, p_metodo,
      null, null, null, null, null, p_referencia);
    perform public._asiento(v_tx, public.cuenta_id('PRESTAMOS'), p_monto, 0);
    perform public._asiento(v_tx, public.cuenta_id('GASTOS_FIN'), coalesce(p_interes, 0), 0,
      (select id from public.categorias_gasto where nombre = 'Intereses'));
    perform public._asiento(v_tx, p_cuenta_origen, 0, v_total);
  elsif p_tipo = 'otro_ingreso' then
    perform public._validar_cuenta_financiera(p_cuenta_destino);
    if coalesce(trim(p_descripcion), '') = '' then raise exception 'Describe el ingreso'; end if;
    v_tx := public._nueva_tx(p_fecha, p_tipo, p_monto, p_descripcion, p_idem, null, p_metodo);
    perform public._asiento(v_tx, p_cuenta_destino, p_monto, 0);
    perform public._asiento(v_tx, public.cuenta_id('OTROS_INGRESOS'), 0, p_monto);
  else
    raise exception 'Tipo de movimiento no permitido aquí';
  end if;
  return v_tx;
end $$;

-- Ajuste de saldo (cuadre de caja): solo administradores
create or replace function public.ajustar_saldo(p_cuenta uuid, p_fecha date, p_saldo_real numeric, p_motivo text, p_idem uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tx uuid; v_saldo numeric; v_dif numeric;
begin
  perform public.exigir_rol(array['administrador']::public.rol_usuario[]);
  v_tx := public._tx_existente(p_idem); if v_tx is not null then return v_tx; end if;
  perform public._validar_cuenta_financiera(p_cuenta);
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo del ajuste'; end if;
  select coalesce(sum(a.debe - a.haber), 0) into v_saldo
  from public.asientos a join public.transacciones t on t.id = a.transaccion_id
  where a.cuenta_id = p_cuenta and t.fecha <= p_fecha;
  v_dif := round(p_saldo_real - v_saldo, 2);
  if v_dif = 0 then return null; end if;
  v_tx := public._nueva_tx(p_fecha, 'ajuste', abs(v_dif), 'Ajuste de saldo: ' || p_motivo, p_idem);
  if v_dif > 0 then
    perform public._asiento(v_tx, p_cuenta, v_dif, 0);
    perform public._asiento(v_tx, public.cuenta_id('DIF_CAJA'), 0, v_dif);
  else
    perform public._asiento(v_tx, public.cuenta_id('DIF_CAJA'), -v_dif, 0);
    perform public._asiento(v_tx, p_cuenta, 0, -v_dif);
  end if;
  return v_tx;
end $$;

-- Anulación: crea la transacción inversa con la misma fecha y marca la original
create or replace function public.anular_transaccion(p_tx uuid, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare t public.transacciones; v_rev uuid; r record;
begin
  perform public.exigir_rol(array['administrador']::public.rol_usuario[]);
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indica el motivo de la anulación'; end if;
  select * into t from public.transacciones where id = p_tx for update;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if t.anulada then raise exception 'Este movimiento ya está anulado'; end if;
  if t.tipo in ('anulacion', 'venta', 'reversion_venta') then
    raise exception 'Este movimiento lo genera el sistema; cambia el estado del pedido en su lugar';
  end if;
  if t.tipo = 'gasto' and exists (select 1 from public.transacciones x where x.gasto_id = t.gasto_id and x.tipo = 'pago_gasto' and not x.anulada) then
    raise exception 'Primero anula los pagos de este gasto';
  end if;
  v_rev := public._nueva_tx(t.fecha, 'anulacion', t.monto, 'Anulación de #' || t.numero || ': ' || p_motivo,
    null, t.tipo::text, null, null, t.pedido_id, t.cliente_id, t.proveedor_id, t.gasto_id, t.referencia, t.id);

  if t.tipo = 'cobro' then
    -- El dinero del cobro pudo haberse aplicado ya a la venta. Se revierte primero contra
    -- el saldo a favor (anticipos) disponible y el resto vuelve a quedar como cuenta por cobrar.
    declare
      v_disp numeric := greatest(-public._saldo_pedido(t.pedido_id, 'ANTICIPOS'), 0);
      v_ant numeric := least(t.monto, v_disp);
      v_rec timestamptz;
    begin
      select venta_reconocida_at into v_rec from public.pedidos where id = t.pedido_id;
      if v_rec is null and v_ant < t.monto then
        raise exception 'Este cobro ya fue devuelto al cliente. Anula primero la devolución.';
      end if;
      for r in select * from public.asientos where transaccion_id = t.id and debe > 0 loop
        perform public._asiento(v_rev, r.cuenta_id, 0, r.debe, null, r.pedido_id);
      end loop;
      perform public._asiento(v_rev, public.cuenta_id('ANTICIPOS'), v_ant, 0, null, t.pedido_id);
      perform public._asiento(v_rev, public.cuenta_id('CXC'), t.monto - v_ant, 0, null, t.pedido_id);
    end;
  else
    for r in select * from public.asientos where transaccion_id = t.id loop
      perform public._asiento(v_rev, r.cuenta_id, r.haber, r.debe, r.categoria_id, r.pedido_id);
    end loop;
  end if;
  update public.transacciones set anulada = true, anulada_at = now(), anulada_por = auth.uid(), motivo_anulacion = p_motivo
  where id = t.id;
  if t.gasto_id is not null and t.tipo = 'gasto' then
    update public.gastos set anulado = true where id = t.gasto_id;
  end if;
  return v_rev;
end $$;
