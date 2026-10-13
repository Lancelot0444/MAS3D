-- =====================================================================
-- MAS3D Manager · 0004 · API de pedidos, vistas y reportes
-- =====================================================================

create or replace function public.hoy_ec()
returns date language sql stable as $$ select (now() at time zone 'America/Guayaquil')::date $$;

-- Suma días laborables (lunes a viernes)
create or replace function public.sumar_dias_laborables(p_desde date, p_dias int)
returns date language plpgsql immutable as $$
declare d date := p_desde; n int := 0;
begin
  while n < p_dias loop
    d := d + 1;
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return d;
end $$;

-- ---------- Guardar pedido (crear o editar) con sus líneas, de forma atómica ----------
create or replace function public.guardar_pedido(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  cfg public.configuracion; v_id uuid := nullif(p->>'id', '')::uuid; v_ped public.pedidos;
  v_anio int; v_num int; v_fecha date; v_entrega date; it jsonb; v_linea int := 0; v_ids uuid[] := '{}';
  v_tarifa numeric; v_estado public.estado_pedido; v_item uuid;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  select * into cfg from public.configuracion where id = 1;
  v_tarifa := case when cfg.iva_activo then cfg.iva_tarifa else 0 end;

  if v_id is null and nullif(p->>'idempotency_key', '') is not null then
    select id into v_id from public.pedidos where idempotency_key = (p->>'idempotency_key')::uuid;
    if v_id is not null then return v_id; end if;
  end if;

  if not exists (select 1 from public.clientes where id = (p->>'cliente_id')::uuid) then
    raise exception 'Selecciona un cliente';
  end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'El pedido debe tener al menos un producto';
  end if;

  v_fecha := coalesce(nullif(p->>'fecha_pedido', '')::date, public.hoy_ec());
  v_entrega := coalesce(nullif(p->>'fecha_entrega_prometida', '')::date, public.sumar_dias_laborables(v_fecha, cfg.dias_fabricacion));
  if v_entrega < v_fecha then raise exception 'La fecha de entrega no puede ser anterior a la fecha del pedido'; end if;

  if v_id is null then
    v_estado := coalesce(nullif(p->>'estado', ''), 'confirmado')::public.estado_pedido;
    if v_estado not in ('cotizado', 'confirmado') then v_estado := 'confirmado'; end if;
    v_anio := extract(year from v_fecha)::int;
    v_num := public.siguiente_numero('pedido', v_anio);
    insert into public.pedidos (codigo, anio, numero, cliente_id, fecha_pedido, fecha_entrega_prometida, estado,
      prioridad, responsable_id, canal, modalidad_entrega, direccion_envio, transportista, numero_guia,
      requiere_boceto, observaciones, idempotency_key)
    values ('MAS-' || v_anio || '-' || lpad(v_num::text, 4, '0'), v_anio, v_num, (p->>'cliente_id')::uuid, v_fecha, v_entrega,
      v_estado, coalesce(nullif(p->>'prioridad', ''), 'normal')::public.prioridad_pedido, nullif(p->>'responsable_id', '')::uuid,
      nullif(p->>'canal', ''), coalesce(nullif(p->>'modalidad_entrega', ''), 'retiro_local')::public.modalidad_entrega,
      nullif(p->>'direccion_envio', ''), nullif(p->>'transportista', ''), nullif(p->>'numero_guia', ''),
      coalesce((p->>'requiere_boceto')::boolean, false), nullif(p->>'observaciones', ''), nullif(p->>'idempotency_key', '')::uuid)
    returning id into v_id;
    insert into public.pedido_historial (pedido_id, estado_nuevo, nota) values (v_id, v_estado, 'Pedido creado');
  else
    select * into v_ped from public.pedidos where id = v_id for update;
    if not found then raise exception 'Pedido no encontrado'; end if;
    update public.pedidos set
      cliente_id = case when venta_reconocida_at is null then (p->>'cliente_id')::uuid else cliente_id end,
      fecha_pedido = v_fecha, fecha_entrega_prometida = v_entrega,
      prioridad = coalesce(nullif(p->>'prioridad', ''), 'normal')::public.prioridad_pedido,
      responsable_id = nullif(p->>'responsable_id', '')::uuid, canal = nullif(p->>'canal', ''),
      modalidad_entrega = coalesce(nullif(p->>'modalidad_entrega', ''), 'retiro_local')::public.modalidad_entrega,
      direccion_envio = nullif(p->>'direccion_envio', ''), transportista = nullif(p->>'transportista', ''),
      numero_guia = nullif(p->>'numero_guia', ''), requiere_boceto = coalesce((p->>'requiere_boceto')::boolean, false),
      observaciones = nullif(p->>'observaciones', '')
    where id = v_id;
  end if;

  -- Líneas: actualiza las existentes, crea las nuevas y elimina las quitadas
  for it in select * from jsonb_array_elements(p->'items') loop
    v_linea := v_linea + 1;
    if nullif(it->>'id', '') is not null and exists (select 1 from public.pedido_items where id = (it->>'id')::uuid and pedido_id = v_id) then
      update public.pedido_items set
        linea = v_linea + 1000, es_envio = coalesce((it->>'es_envio')::boolean, false),
        tipo_producto = coalesce(it->>'tipo_producto', ''), descripcion = it->>'descripcion',
        cantidad = coalesce(nullif(it->>'cantidad', '')::numeric, 1), tamano = nullif(it->>'tamano', ''),
        material = nullif(it->>'material', ''), colores = nullif(it->>'colores', ''),
        precio_unitario = coalesce(nullif(it->>'precio_unitario', '')::numeric, 0),
        descuento = coalesce(nullif(it->>'descuento', '')::numeric, 0)
      where id = (it->>'id')::uuid;
      v_ids := v_ids || (it->>'id')::uuid;
    else
      insert into public.pedido_items (pedido_id, linea, es_envio, tipo_producto, descripcion, cantidad, tamano, material,
        colores, precio_unitario, descuento, tarifa_iva, precio_incluye_iva, estado)
      values (v_id, v_linea + 1000, coalesce((it->>'es_envio')::boolean, false), coalesce(it->>'tipo_producto', ''),
        it->>'descripcion', coalesce(nullif(it->>'cantidad', '')::numeric, 1), nullif(it->>'tamano', ''),
        nullif(it->>'material', ''), nullif(it->>'colores', ''), coalesce(nullif(it->>'precio_unitario', '')::numeric, 0),
        coalesce(nullif(it->>'descuento', '')::numeric, 0), v_tarifa, cfg.precios_incluyen_iva,
        (select estado from public.pedidos where id = v_id))
      returning id into v_item;
      v_ids := v_ids || v_item;
    end if;
  end loop;
  delete from public.pedido_items where pedido_id = v_id and not (id = any (v_ids));
  update public.pedido_items set linea = linea - 1000 where pedido_id = v_id and linea > 1000;
  return v_id;
end $$;

-- ---------- Cambio de estado del pedido ----------
create or replace function public.cambiar_estado_pedido(p_pedido uuid, p_estado public.estado_pedido, p_nota text default null, p_fecha date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.pedidos; v_fecha date := coalesce(p_fecha, public.hoy_ec()); v_cobrado numeric; v_aviso text;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad', 'produccion']::public.rol_usuario[]);
  if p_estado in ('cancelado', 'devolucion', 'cotizado', 'confirmado')
     and not public.es_finanzas() then
    raise exception 'Solo administración o contabilidad pueden pasar un pedido a este estado';
  end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado = p_estado then return jsonb_build_object('ok', true); end if;
  if p_estado in ('cancelado', 'devolucion') and coalesce(trim(p_nota), '') = '' then
    raise exception 'Indica el motivo';
  end if;
  if p.estado = 'cancelado' and not public.es_admin() then
    raise exception 'Solo un administrador puede reactivar un pedido cancelado';
  end if;

  update public.pedidos set
    estado = p_estado,
    fecha_entrega_real = case when p_estado = 'entregado' then v_fecha else fecha_entrega_real end,
    boceto_aprobado_at = case when p_estado = 'boceto_aprobado' then now() else boceto_aprobado_at end,
    motivo_cancelacion = case when p_estado = 'cancelado' then p_nota else motivo_cancelacion end
  where id = p.id;
  -- Las líneas que iban junto con el pedido avanzan con él
  update public.pedido_items set estado = p_estado where pedido_id = p.id and estado = p.estado;
  insert into public.pedido_historial (pedido_id, estado_anterior, estado_nuevo, nota) values (p.id, p.estado, p_estado, nullif(p_nota, ''));

  if p_estado in ('enviado', 'entregado') then
    perform public._reconocer_venta(p.id, v_fecha);
  elsif p_estado in ('cancelado', 'devolucion') then
    perform public._revertir_venta(p.id, v_fecha, p_nota);
  end if;

  select coalesce(sum(case t.tipo when 'cobro' then t.monto when 'devolucion_cliente' then -t.monto else 0 end), 0)
    into v_cobrado from public.transacciones t where t.pedido_id = p.id and not t.anulada;
  if p_estado in ('listo_entrega', 'enviado', 'entregado') and p.total - v_cobrado > 0 then
    v_aviso := format('Atención: este pedido tiene un saldo pendiente de $%s. Cóbralo antes de entregar o enviar.', to_char(p.total - v_cobrado, 'FM999990.00'));
  end if;
  return jsonb_build_object('ok', true, 'aviso', v_aviso);
end $$;

create or replace function public.cambiar_estado_item(p_item uuid, p_estado public.estado_pedido, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare i public.pedido_items;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad', 'produccion']::public.rol_usuario[]);
  if p_estado in ('cancelado', 'devolucion', 'enviado', 'entregado', 'cotizado') then
    raise exception 'Ese estado se aplica al pedido completo';
  end if;
  select * into i from public.pedido_items where id = p_item for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  update public.pedido_items set estado = p_estado where id = p_item;
  insert into public.pedido_historial (pedido_id, item_id, estado_anterior, estado_nuevo, nota)
  values (i.pedido_id, i.id, i.estado, p_estado, nullif(p_nota, ''));
end $$;

-- =====================================================================
-- Vistas
-- =====================================================================

-- Pedidos con su situación de cobro (solo finanzas: respeta RLS de las tablas)
create or replace view public.v_pedidos with (security_invoker = true) as
select
  p.*,
  c.codigo as cliente_codigo, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp, c.tipo as cliente_tipo,
  r.nombre as responsable_nombre,
  coalesce(m.cobrado, 0) as cobrado,
  case when p.estado in ('cancelado', 'cotizado', 'devolucion') then 0 else greatest(p.total - coalesce(m.cobrado, 0), 0) end as saldo_pendiente,
  greatest(coalesce(m.cobrado, 0) - coalesce(m.retenido, 0) - case when p.estado in ('cancelado', 'devolucion') then 0 else p.total end, 0) as saldo_a_favor,
  (p.fecha_entrega_prometida < public.hoy_ec() and public.estado_activo(p.estado) and p.estado <> 'enviado') as atrasado
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.perfiles r on r.id = p.responsable_id
left join lateral (
  select sum(case t.tipo when 'cobro' then t.monto when 'devolucion_cliente' then -t.monto else 0 end) as cobrado,
         sum(case t.tipo when 'retencion_anticipo' then t.monto else 0 end) as retenido
  from public.transacciones t where t.pedido_id = p.id and not t.anulada
) m on true;

-- Pedidos para producción: SIN precios, cobros ni saldos
create or replace view public.v_pedidos_produccion as
select p.id, p.codigo, p.fecha_pedido, p.fecha_entrega_prometida, p.fecha_entrega_real, p.estado, p.prioridad,
  p.responsable_id, r.nombre as responsable_nombre, p.modalidad_entrega, p.transportista, p.numero_guia,
  p.requiere_boceto, p.boceto_aprobado_at, p.observaciones, c.nombre as cliente_nombre, p.created_at, p.updated_at,
  (p.fecha_entrega_prometida < public.hoy_ec() and public.estado_activo(p.estado) and p.estado <> 'enviado') as atrasado
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.perfiles r on r.id = p.responsable_id
where public.tiene_rol(array['administrador', 'contabilidad', 'produccion']::public.rol_usuario[]);

create or replace view public.v_items_produccion as
select i.id, i.pedido_id, i.linea, i.es_envio, i.tipo_producto, i.descripcion, i.cantidad, i.tamano, i.material,
  i.colores, i.estado, i.updated_at
from public.pedido_items i
where public.tiene_rol(array['administrador', 'contabilidad', 'produccion']::public.rol_usuario[]);

-- Clientes con totales
create or replace view public.v_clientes with (security_invoker = true) as
select c.*,
  coalesce(s.n_pedidos, 0) as n_pedidos,
  coalesce(s.total_comprado, 0) as total_comprado,
  coalesce(s.total_pagado, 0) as total_pagado,
  coalesce(s.saldo, 0) as saldo_pendiente,
  coalesce(s.saldo_vencido, 0) as saldo_vencido,
  s.ultimo_pedido,
  coalesce(s.n_pedidos, 0) >= 3 as frecuente
from public.clientes c
left join lateral (
  select count(*) filter (where vp.estado not in ('cotizado', 'cancelado')) as n_pedidos,
    sum(vp.total) filter (where vp.estado not in ('cotizado', 'cancelado')) as total_comprado,
    sum(vp.cobrado) as total_pagado,
    sum(vp.saldo_pendiente) as saldo,
    sum(vp.saldo_pendiente) filter (where vp.estado in ('enviado', 'entregado') or vp.atrasado) as saldo_vencido,
    max(vp.fecha_pedido) as ultimo_pedido
  from public.v_pedidos vp where vp.cliente_id = c.id
) s on true;

-- Cuentas de dinero con saldo
create or replace view public.v_cuentas_saldo with (security_invoker = true) as
select c.id, c.codigo, c.nombre, c.subtipo, c.institucion, c.numero_referencia, c.activa, c.orden,
  coalesce(sum(a.debe - a.haber), 0) as saldo,
  exists (select 1 from public.transacciones t join public.asientos x on x.transaccion_id = t.id
          where t.tipo = 'apertura' and not t.anulada and x.cuenta_id = c.id) as tiene_apertura
from public.cuentas c
left join public.asientos a on a.cuenta_id = c.id
where c.es_financiera
group by c.id;

-- Movimientos de dinero (una fila por línea en una cuenta de dinero)
create or replace view public.v_movimientos with (security_invoker = true) as
select t.id as transaccion_id, t.numero, t.fecha, t.tipo, t.subtipo, t.descripcion, t.metodo_pago, t.comprobante,
  t.pedido_id, p.codigo as pedido_codigo, t.cliente_id, cl.nombre as cliente_nombre, t.proveedor_id, pr.nombre as proveedor_nombre,
  t.gasto_id, t.referencia, t.anulada, t.motivo_anulacion, t.anula_a_id, t.creado_por, u.nombre as creado_por_nombre, t.created_at,
  a.cuenta_id, c.nombre as cuenta_nombre, a.debe as entrada, a.haber as salida
from public.transacciones t
join public.asientos a on a.transaccion_id = t.id
join public.cuentas c on c.id = a.cuenta_id and c.es_financiera
left join public.pedidos p on p.id = t.pedido_id
left join public.clientes cl on cl.id = t.cliente_id
left join public.proveedores pr on pr.id = t.proveedor_id
left join public.perfiles u on u.id = t.creado_por;

-- Gastos con estado de pago
create or replace view public.v_gastos with (security_invoker = true) as
select g.*, cg.nombre as categoria_nombre, cg.clasificacion, pr.nombre as proveedor_nombre, u.nombre as responsable_nombre,
  p.codigo as pedido_codigo,
  case when g.anulado then 0 else public.saldo_gasto(g.id) end as saldo_pendiente,
  case
    when g.anulado then 'anulado'
    when public.saldo_gasto(g.id) <= 0 then 'pagado'
    when g.fecha_vencimiento is not null and g.fecha_vencimiento < public.hoy_ec() then 'vencido'
    else 'por_pagar'
  end as estado_pago
from public.gastos g
join public.categorias_gasto cg on cg.id = g.categoria_id
left join public.proveedores pr on pr.id = g.proveedor_id
left join public.perfiles u on u.id = g.responsable_id
left join public.pedidos p on p.id = g.pedido_id;

-- =====================================================================
-- Indicadores y reportes (solo finanzas)
-- =====================================================================

-- Suma de movimientos por clave de cuenta en un período (signo natural de la cuenta)
create or replace function public._mov_clave(p_clave text, p_desde date, p_hasta date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when c.tipo in ('activo', 'costo', 'gasto') then a.debe - a.haber else a.haber - a.debe end), 0)
  from public.asientos a join public.transacciones t on t.id = a.transaccion_id join public.cuentas c on c.id = a.cuenta_id
  where c.clave = p_clave and t.fecha between p_desde and p_hasta
$$;

create or replace function public._saldo_clave(p_clave text, p_hasta date)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when c.tipo in ('activo', 'costo', 'gasto') then a.debe - a.haber else a.haber - a.debe end), 0)
  from public.asientos a join public.transacciones t on t.id = a.transaccion_id join public.cuentas c on c.id = a.cuenta_id
  where c.clave = p_clave and t.fecha <= p_hasta
$$;

create or replace function public.resumen_financiero(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ventas numeric; v_envios numeric; v_otros numeric; v_costos numeric; v_gop numeric; v_dif numeric;
  v_fin numeric; v_imp numeric; v_cobrado numeric; v_caja numeric; v_cxp numeric; v_inversion numeric;
  v_hoy date := public.hoy_ec(); r jsonb;
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  v_ventas := public._mov_clave('VENTAS', p_desde, p_hasta);
  v_envios := public._mov_clave('ENVIOS', p_desde, p_hasta);
  v_otros := public._mov_clave('OTROS_INGRESOS', p_desde, p_hasta);
  v_costos := public._mov_clave('COSTOS', p_desde, p_hasta);
  v_gop := public._mov_clave('GASTOS_OP', p_desde, p_hasta);
  v_dif := public._mov_clave('DIF_CAJA', p_desde, p_hasta);
  v_fin := public._mov_clave('GASTOS_FIN', p_desde, p_hasta);
  v_imp := public._mov_clave('IMPUESTOS', p_desde, p_hasta);
  v_inversion := public._mov_clave('ACTIVOS_FIJOS', p_desde, p_hasta);

  select coalesce(sum(case t.tipo when 'cobro' then t.monto when 'devolucion_cliente' then -t.monto end), 0)
    into v_cobrado from public.transacciones t
  where t.tipo in ('cobro', 'devolucion_cliente') and not t.anulada and t.fecha between p_desde and p_hasta;

  select coalesce(sum(a.debe - a.haber), 0) into v_caja
  from public.asientos a join public.transacciones t on t.id = a.transaccion_id join public.cuentas c on c.id = a.cuenta_id
  where c.es_financiera and t.fecha <= p_hasta;
  v_cxp := public._saldo_clave('CXP', p_hasta);

  r := jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'ventas_realizadas', v_ventas + v_envios,
    'ventas_productos', v_ventas,
    'ventas_envios', v_envios,
    'ventas_pactadas', (select coalesce(sum(total), 0) from public.pedidos
                        where fecha_pedido between p_desde and p_hasta and estado not in ('cotizado', 'cancelado')),
    'pedidos_nuevos', (select count(*) from public.pedidos
                       where fecha_pedido between p_desde and p_hasta and estado not in ('cotizado', 'cancelado')),
    'cobrado', v_cobrado,
    'otros_ingresos', v_otros,
    'costos_directos', v_costos,
    'gastos_operativos', v_gop + v_dif,
    'gastos_financieros', v_fin,
    'impuestos', v_imp,
    'gastos_total', v_costos + v_gop + v_dif + v_fin + v_imp,
    'inversiones', v_inversion,
    'utilidad_bruta', v_ventas + v_envios - v_costos,
    'utilidad_operativa', v_ventas + v_envios - v_costos - v_gop - v_dif,
    'utilidad_neta', v_ventas + v_envios - v_costos - v_gop - v_dif + v_otros - v_fin - v_imp,
    'caja_bancos', v_caja,
    'por_cobrar', (select coalesce(sum(saldo_pendiente), 0) from public.v_pedidos),
    'saldos_a_favor_clientes', public._saldo_clave('ANTICIPOS', p_hasta),
    'por_pagar', v_cxp,
    'prestamos', public._saldo_clave('PRESTAMOS', p_hasta),
    'iva_por_pagar', public._saldo_clave('IVA', p_hasta),
    'gastos_vencidos', (select count(*) from public.v_gastos where estado_pago = 'vencido'),
    'hoy', jsonb_build_object(
      'ventas_realizadas', public._mov_clave('VENTAS', v_hoy, v_hoy) + public._mov_clave('ENVIOS', v_hoy, v_hoy),
      'cobrado', (select coalesce(sum(case t.tipo when 'cobro' then t.monto when 'devolucion_cliente' then -t.monto end), 0)
                  from public.transacciones t where t.tipo in ('cobro', 'devolucion_cliente') and not t.anulada and t.fecha = v_hoy),
      'gastos', public._mov_clave('COSTOS', v_hoy, v_hoy) + public._mov_clave('GASTOS_OP', v_hoy, v_hoy)
                + public._mov_clave('GASTOS_FIN', v_hoy, v_hoy) + public._mov_clave('IMPUESTOS', v_hoy, v_hoy)
                + public._mov_clave('DIF_CAJA', v_hoy, v_hoy)
    )
  );
  return r;
end $$;

-- Resumen operativo de pedidos (finanzas y producción)
create or replace function public.resumen_pedidos()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_rol(array['administrador', 'contabilidad', 'produccion']::public.rol_usuario[]);
  return (select jsonb_build_object(
    'activos', count(*) filter (where public.estado_activo(estado)),
    'atrasados', count(*) filter (where fecha_entrega_prometida < public.hoy_ec() and public.estado_activo(estado) and estado <> 'enviado'),
    'listos', count(*) filter (where estado = 'listo_entrega'),
    'en_produccion', count(*) filter (where estado in ('en_diseno', 'boceto_aprobado', 'en_impresion', 'retiro_soportes', 'en_pintura', 'acabados', 'control_calidad', 'empacado', 'retrabajo')),
    'por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}') from (select estado, count(*) n from public.pedidos group by estado) x)
  ) from public.pedidos);
end $$;

-- Serie de ingresos vs gastos por día/semana/mes
create or replace function public.serie_financiera(p_desde date, p_hasta date, p_granularidad text default 'month')
returns table (periodo date, ventas numeric, cobrado numeric, gastos numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  if p_granularidad not in ('day', 'week', 'month', 'year') then raise exception 'Granularidad no válida'; end if;
  return query
  with periodos as (
    select generate_series(date_trunc(p_granularidad, p_desde::timestamp), date_trunc(p_granularidad, p_hasta::timestamp),
      ('1 ' || p_granularidad)::interval)::date as periodo
  ),
  lineas as (
    select date_trunc(p_granularidad, t.fecha::timestamp)::date as periodo, c.clave, a.debe, a.haber
    from public.asientos a join public.transacciones t on t.id = a.transaccion_id join public.cuentas c on c.id = a.cuenta_id
    where t.fecha between p_desde and p_hasta and c.clave in ('VENTAS', 'ENVIOS', 'COSTOS', 'GASTOS_OP', 'GASTOS_FIN', 'IMPUESTOS', 'DIF_CAJA')
  ),
  cobros as (
    select date_trunc(p_granularidad, t.fecha::timestamp)::date as periodo,
      sum(case t.tipo when 'cobro' then t.monto else -t.monto end) as cobrado
    from public.transacciones t
    where t.tipo in ('cobro', 'devolucion_cliente') and not t.anulada and t.fecha between p_desde and p_hasta
    group by 1
  )
  select pe.periodo,
    coalesce(sum(l.haber - l.debe) filter (where l.clave in ('VENTAS', 'ENVIOS')), 0)::numeric,
    coalesce(max(co.cobrado), 0)::numeric,
    coalesce(sum(l.debe - l.haber) filter (where l.clave in ('COSTOS', 'GASTOS_OP', 'GASTOS_FIN', 'IMPUESTOS', 'DIF_CAJA')), 0)::numeric
  from periodos pe
  left join lineas l on l.periodo = pe.periodo
  left join cobros co on co.periodo = pe.periodo
  group by pe.periodo order by pe.periodo;
end $$;

create or replace function public.gastos_por_categoria(p_desde date, p_hasta date)
returns table (categoria text, clasificacion public.clasificacion_gasto, total numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  return query
  select cg.nombre, cg.clasificacion, sum(a.debe - a.haber)
  from public.asientos a join public.transacciones t on t.id = a.transaccion_id
  join public.categorias_gasto cg on cg.id = a.categoria_id
  join public.cuentas c on c.id = a.cuenta_id and c.tipo in ('costo', 'gasto')
  where t.fecha between p_desde and p_hasta
  group by cg.nombre, cg.clasificacion
  having sum(a.debe - a.haber) <> 0
  order by 3 desc;
end $$;

-- Utilidad por pedido: venta reconocida menos gastos directamente ligados al pedido
create or replace function public.utilidad_por_pedido(p_desde date, p_hasta date)
returns table (pedido_id uuid, codigo text, cliente text, fecha_entrega date, venta numeric, costos numeric, utilidad numeric, margen numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  return query
  select p.id, p.codigo, c.nombre, coalesce(p.fecha_entrega_real, p.fecha_entrega_prometida),
    coalesce(sum(a.haber - a.debe) filter (where cu.clave in ('VENTAS', 'ENVIOS')), 0),
    coalesce(sum(a.debe - a.haber) filter (where cu.tipo in ('costo', 'gasto')), 0),
    coalesce(sum(a.haber - a.debe) filter (where cu.clave in ('VENTAS', 'ENVIOS')), 0)
      - coalesce(sum(a.debe - a.haber) filter (where cu.tipo in ('costo', 'gasto')), 0),
    case when coalesce(sum(a.haber - a.debe) filter (where cu.clave in ('VENTAS', 'ENVIOS')), 0) = 0 then null
      else round(100 * (coalesce(sum(a.haber - a.debe) filter (where cu.clave in ('VENTAS', 'ENVIOS')), 0)
        - coalesce(sum(a.debe - a.haber) filter (where cu.tipo in ('costo', 'gasto')), 0))
        / sum(a.haber - a.debe) filter (where cu.clave in ('VENTAS', 'ENVIOS')), 1) end
  from public.pedidos p
  join public.clientes c on c.id = p.cliente_id
  join public.asientos a on a.pedido_id = p.id
  join public.transacciones t on t.id = a.transaccion_id
  join public.cuentas cu on cu.id = a.cuenta_id
  where p.venta_reconocida_at is not null
    and coalesce(p.fecha_entrega_real, p.fecha_entrega_prometida) between p_desde and p_hasta
  group by p.id, p.codigo, c.nombre
  order by 4 desc;
end $$;

create or replace function public.ventas_por_canal(p_desde date, p_hasta date)
returns table (canal text, pedidos bigint, ventas numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  return query
  select coalesce(nullif(p.canal, ''), 'Sin canal'), count(distinct p.id), sum(a.haber - a.debe)
  from public.pedidos p
  join public.asientos a on a.pedido_id = p.id
  join public.transacciones t on t.id = a.transaccion_id
  join public.cuentas cu on cu.id = a.cuenta_id and cu.clave in ('VENTAS', 'ENVIOS')
  where t.fecha between p_desde and p_hasta
  group by 1 having sum(a.haber - a.debe) <> 0 order by 3 desc;
end $$;

-- Estado de resultados por cuenta (para el reporte detallado)
create or replace function public.estado_resultados(p_desde date, p_hasta date)
returns table (clave text, nombre text, tipo public.tipo_cuenta, monto numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_rol(array['administrador', 'contabilidad']::public.rol_usuario[]);
  return query
  select c.clave, c.nombre, c.tipo, public._mov_clave(c.clave, p_desde, p_hasta)
  from public.cuentas c where c.tipo in ('ingreso', 'costo', 'gasto') and c.clave is not null
  order by c.orden;
end $$;
