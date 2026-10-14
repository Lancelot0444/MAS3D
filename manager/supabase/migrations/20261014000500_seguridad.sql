-- =====================================================================
-- MAS3D Manager · 0005 · Seguridad: RLS, permisos, almacenamiento y tiempo real
--
-- Principio: nadie escribe directamente en tablas contables. Todo movimiento
-- de dinero pasa por funciones que validan rol, montos y cuadre.
-- =====================================================================

-- ---------- Activar RLS en todas las tablas ----------
alter table public.perfiles          enable row level security;
alter table public.invitaciones      enable row level security;
alter table public.configuracion     enable row level security;
alter table public.auditoria         enable row level security;
alter table public.contadores        enable row level security;
alter table public.clientes          enable row level security;
alter table public.proveedores       enable row level security;
alter table public.pedidos           enable row level security;
alter table public.pedido_items      enable row level security;
alter table public.pedido_historial  enable row level security;
alter table public.adjuntos          enable row level security;
alter table public.cuentas           enable row level security;
alter table public.categorias_gasto  enable row level security;
alter table public.transacciones     enable row level security;
alter table public.asientos          enable row level security;
alter table public.gastos            enable row level security;

-- ---------- Privilegios base: se quita todo y se concede lo mínimo ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;
grant usage on schema extensions to authenticated;   -- pg_trgm (búsqueda de clientes parecidos)
grant select on all tables in schema public to authenticated;           -- filtrado por RLS
revoke select on public.contadores from authenticated;
grant insert, update on public.clientes, public.proveedores, public.cuentas, public.categorias_gasto,
  public.configuracion, public.perfiles, public.invitaciones, public.adjuntos to authenticated;
grant delete on public.invitaciones, public.adjuntos to authenticated;

-- Funciones que se usan dentro de políticas, vistas y validaciones
grant execute on function
  public.rol_actual(), public.tiene_rol(public.rol_usuario[]), public.es_finanzas(), public.es_admin(),
  public.hoy_ec(), public.estado_activo(public.estado_pedido), public.normalizar_telefono(text),
  public.validar_cedula(text), public.validar_ruc(text), public.saldo_gasto(uuid),
  public.sumar_dias_laborables(date, int)
to authenticated;

-- API de la aplicación
grant execute on function
  public.clientes_similares(text, text, text, uuid),
  public.guardar_pedido(jsonb),
  public.cambiar_estado_pedido(uuid, public.estado_pedido, text, date),
  public.cambiar_estado_item(uuid, public.estado_pedido, text),
  public.registrar_saldo_apertura(uuid, date, numeric, uuid),
  public.registrar_cobro(uuid, uuid, numeric, date, public.metodo_pago, text, text, text, uuid),
  public.registrar_devolucion_cliente(uuid, uuid, numeric, date, public.metodo_pago, text, uuid),
  public.retener_anticipo(uuid, numeric, date, text, uuid),
  public.registrar_gasto(date, uuid, numeric, text, boolean, uuid, public.metodo_pago, uuid, text, date, uuid, uuid),
  public.pagar_gasto(uuid, uuid, numeric, date, public.metodo_pago, uuid),
  public.registrar_movimiento(public.tipo_transaccion, date, numeric, text, uuid, uuid, numeric, text, public.metodo_pago, uuid),
  public.ajustar_saldo(uuid, date, numeric, text, uuid),
  public.anular_transaccion(uuid, text),
  public.resumen_financiero(date, date),
  public.resumen_pedidos(),
  public.serie_financiera(date, date, text),
  public.gastos_por_categoria(date, date),
  public.utilidad_por_pedido(date, date),
  public.ventas_por_canal(date, date),
  public.estado_resultados(date, date)
to authenticated;

-- ---------- Políticas ----------
-- Perfiles: cada usuario activo ve los nombres del equipo; solo el administrador los modifica
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or public.rol_actual() is not null);
create policy perfiles_update on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy perfiles_update_propio on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and rol is not distinct from public.rol_actual() and activo);

create policy invitaciones_admin on public.invitaciones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy config_select on public.configuracion for select to authenticated using (public.rol_actual() is not null);
create policy config_update on public.configuracion for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy auditoria_admin on public.auditoria for select to authenticated using (public.es_admin());

-- Clientes y proveedores: administración y contabilidad
create policy clientes_select on public.clientes for select to authenticated using (public.es_finanzas());
create policy clientes_insert on public.clientes for insert to authenticated with check (public.es_finanzas());
create policy clientes_update on public.clientes for update to authenticated using (public.es_finanzas()) with check (public.es_finanzas());

create policy proveedores_select on public.proveedores for select to authenticated using (public.es_finanzas());
create policy proveedores_insert on public.proveedores for insert to authenticated with check (public.es_finanzas());
create policy proveedores_update on public.proveedores for update to authenticated using (public.es_finanzas()) with check (public.es_finanzas());

-- Pedidos con precios: solo finanzas (producción usa v_pedidos_produccion, sin montos)
create policy pedidos_select on public.pedidos for select to authenticated using (public.es_finanzas());
create policy items_select on public.pedido_items for select to authenticated using (public.es_finanzas());
create policy historial_select on public.pedido_historial for select to authenticated
  using (public.tiene_rol(array['administrador', 'contabilidad', 'produccion']::public.rol_usuario[]));

-- Adjuntos
create policy adjuntos_select on public.adjuntos for select to authenticated
  using (public.es_finanzas() or (entidad = 'pedido' and public.tiene_rol(array['produccion']::public.rol_usuario[])));
create policy adjuntos_insert on public.adjuntos for insert to authenticated
  with check (public.es_finanzas() or (entidad = 'pedido' and public.tiene_rol(array['produccion']::public.rol_usuario[])));
create policy adjuntos_delete on public.adjuntos for delete to authenticated using (public.es_admin());

-- Plan de cuentas y categorías
create policy cuentas_select on public.cuentas for select to authenticated using (public.es_finanzas());
create policy cuentas_insert on public.cuentas for insert to authenticated
  with check (public.es_admin() and clave is null and es_financiera);
create policy cuentas_update on public.cuentas for update to authenticated
  using (public.es_admin() and clave is null) with check (public.es_admin() and clave is null and es_financiera);

create policy categorias_select on public.categorias_gasto for select to authenticated using (public.es_finanzas());
create policy categorias_insert on public.categorias_gasto for insert to authenticated with check (public.es_admin());
create policy categorias_update on public.categorias_gasto for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Libro contable: solo lectura y solo finanzas
create policy tx_select on public.transacciones for select to authenticated using (public.es_finanzas());
create policy asientos_select on public.asientos for select to authenticated using (public.es_finanzas());
create policy gastos_select on public.gastos for select to authenticated using (public.es_finanzas());

-- Las cuentas creadas por la app siempre son de dinero, con código automático
create or replace function public.preparar_cuenta_financiera()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.clave is null then
    new.tipo := 'activo';
    new.es_financiera := true;
    new.codigo := '1.1.' || lpad(public.siguiente_numero('cuenta')::text, 2, '0');
  elsif tg_op = 'UPDATE' then
    new.codigo := old.codigo; new.tipo := old.tipo; new.es_financiera := old.es_financiera; new.clave := old.clave;
  end if;
  return new;
end $$;
create trigger trg_cuentas_preparar before insert or update on public.cuentas for each row execute function public.preparar_cuenta_financiera();

-- ---------- Vistas: dueñas = postgres; las de producción filtran por rol ----------
grant select on public.v_pedidos, public.v_pedidos_produccion, public.v_items_produccion, public.v_clientes,
  public.v_cuentas_saldo, public.v_movimientos, public.v_gastos to authenticated;

-- ---------- Almacenamiento privado de archivos ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 52428800)
on conflict (id) do nothing;

-- Ruta: <entidad>/<entidad_id>/<archivo>
create policy adjuntos_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and (public.es_finanzas()
    or ((storage.foldername(name))[1] = 'pedido' and public.tiene_rol(array['produccion']::public.rol_usuario[]))));
create policy adjuntos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and (public.es_finanzas()
    or ((storage.foldername(name))[1] = 'pedido' and public.tiene_rol(array['produccion']::public.rol_usuario[]))));
create policy adjuntos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and public.es_admin());

-- ---------- Tiempo real ----------
alter publication supabase_realtime add table public.pedidos, public.pedido_items, public.pedido_historial,
  public.transacciones, public.gastos, public.clientes;
