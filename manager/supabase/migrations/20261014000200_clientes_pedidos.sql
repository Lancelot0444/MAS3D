-- =====================================================================
-- MAS3D Manager · 0002 · Clientes, proveedores, pedidos y adjuntos
-- =====================================================================

-- ---------- Contadores (códigos consecutivos sin huecos ni duplicados) ----------
create table public.contadores (
  tipo    text not null,
  anio    int not null default 0,
  ultimo  int not null default 0,
  primary key (tipo, anio)
);

create or replace function public.siguiente_numero(p_tipo text, p_anio int default 0)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.contadores (tipo, anio, ultimo) values (p_tipo, p_anio, 1)
  on conflict (tipo, anio) do update set ultimo = public.contadores.ultimo + 1
  returning ultimo into v;
  return v;
end $$;
revoke all on function public.siguiente_numero(text, int) from public;

-- ---------- Clientes ----------
create type public.tipo_identificacion as enum ('cedula', 'ruc', 'pasaporte', 'consumidor_final', 'ninguna');
create type public.tipo_cliente as enum ('persona', 'corporativo');

create table public.clientes (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique,
  nombre              text not null check (length(trim(nombre)) >= 2),
  telefono            text,
  whatsapp            text,
  email               text,
  tipo_identificacion public.tipo_identificacion not null default 'ninguna',
  identificacion      text,
  direccion           text,
  ciudad              text,
  provincia           text,
  canal               text,
  tipo                public.tipo_cliente not null default 'persona',
  observaciones       text,
  activo              boolean not null default true,
  creado_por          uuid references public.perfiles (id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_cliente_identificacion check (
    case tipo_identificacion
      when 'cedula' then public.validar_cedula(identificacion)
      when 'ruc' then public.validar_ruc(identificacion)
      when 'pasaporte' then identificacion is not null and length(identificacion) between 5 and 20
      else true
    end
  ),
  constraint chk_cliente_email check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create unique index uq_clientes_identificacion on public.clientes (identificacion)
  where identificacion is not null and tipo_identificacion in ('cedula', 'ruc', 'pasaporte');
create unique index uq_clientes_whatsapp on public.clientes (whatsapp) where whatsapp is not null;
create index idx_clientes_nombre_trgm on public.clientes using gin (lower(nombre) extensions.gin_trgm_ops);

create or replace function public.preparar_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.nombre := regexp_replace(trim(new.nombre), '\s+', ' ', 'g');
  new.whatsapp := public.normalizar_telefono(coalesce(nullif(new.whatsapp, ''), new.telefono));
  new.telefono := nullif(trim(new.telefono), '');
  new.email := nullif(lower(trim(new.email)), '');
  new.identificacion := nullif(regexp_replace(coalesce(new.identificacion, ''), '\s', '', 'g'), '');
  if new.tipo_identificacion in ('consumidor_final', 'ninguna') then new.identificacion := null; end if;
  if tg_op = 'INSERT' then
    new.codigo := 'CLI-' || lpad(public.siguiente_numero('cliente')::text, 4, '0');
  else
    new.codigo := old.codigo;
  end if;
  return new;
end $$;

create trigger trg_clientes_preparar before insert or update on public.clientes for each row execute function public.preparar_cliente();
create trigger trg_clientes_updated before update on public.clientes for each row execute function public.tocar_updated_at();
create trigger aud_clientes after insert or update or delete on public.clientes for each row execute function public.registrar_auditoria();

-- Búsqueda de posibles duplicados antes de crear un cliente
create or replace function public.clientes_similares(p_nombre text, p_whatsapp text default null, p_identificacion text default null, p_excluir uuid default null)
returns table (id uuid, codigo text, nombre text, whatsapp text, identificacion text, motivo text)
language sql stable security invoker set search_path = public as $$
  select c.id, c.codigo, c.nombre, c.whatsapp, c.identificacion,
    case
      when p_identificacion is not null and c.identificacion = regexp_replace(p_identificacion, '\s', '', 'g') then 'Misma identificación'
      when p_whatsapp is not null and c.whatsapp = public.normalizar_telefono(p_whatsapp) then 'Mismo WhatsApp'
      else 'Nombre parecido'
    end
  from public.clientes c
  where (p_excluir is null or c.id <> p_excluir)
    and (
      (p_identificacion is not null and c.identificacion = regexp_replace(p_identificacion, '\s', '', 'g'))
      or (p_whatsapp is not null and c.whatsapp = public.normalizar_telefono(p_whatsapp))
      or (length(coalesce(p_nombre, '')) >= 3 and extensions.similarity(lower(c.nombre), lower(p_nombre)) > 0.45)
    )
  order by 6, extensions.similarity(lower(c.nombre), lower(coalesce(p_nombre, ''))) desc
  limit 8
$$;

-- ---------- Proveedores ----------
create table public.proveedores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(trim(nombre)) >= 2),
  ruc         text,
  telefono    text,
  email       text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index uq_proveedores_nombre on public.proveedores (lower(nombre));
create trigger trg_proveedores_updated before update on public.proveedores for each row execute function public.tocar_updated_at();
create trigger aud_proveedores after insert or update or delete on public.proveedores for each row execute function public.registrar_auditoria();

-- ---------- Pedidos ----------
create type public.estado_pedido as enum (
  'cotizado', 'confirmado', 'anticipo_recibido', 'en_diseno', 'boceto_enviado', 'pendiente_aprobacion',
  'boceto_aprobado', 'en_impresion', 'retiro_soportes', 'en_pintura', 'acabados', 'control_calidad',
  'empacado', 'listo_entrega', 'enviado', 'entregado',
  'pausado', 'cancelado', 'devolucion', 'retrabajo'
);
create type public.prioridad_pedido as enum ('baja', 'normal', 'alta', 'urgente');
create type public.modalidad_entrega as enum ('retiro_local', 'entrega_personal', 'servientrega', 'transporte_interprovincial', 'otro_courier');

create table public.pedidos (
  id                       uuid primary key default gen_random_uuid(),
  codigo                   text not null unique,
  anio                     int not null,
  numero                   int not null,
  cliente_id               uuid not null references public.clientes (id),
  fecha_pedido             date not null default (now() at time zone 'America/Guayaquil')::date,
  fecha_entrega_prometida  date,
  fecha_entrega_real       date,
  estado                   public.estado_pedido not null default 'confirmado',
  prioridad                public.prioridad_pedido not null default 'normal',
  responsable_id           uuid references public.perfiles (id),
  canal                    text,
  modalidad_entrega        public.modalidad_entrega not null default 'retiro_local',
  direccion_envio          text,
  transportista            text,
  numero_guia              text,
  requiere_boceto          boolean not null default false,
  boceto_aprobado_at       timestamptz,
  observaciones            text,
  -- Totales (calculados a partir de las líneas; no se editan a mano)
  subtotal_productos       numeric(12, 2) not null default 0,
  subtotal_envio           numeric(12, 2) not null default 0,
  total_descuentos         numeric(12, 2) not null default 0,
  base_imponible           numeric(12, 2) not null default 0,
  total_iva                numeric(12, 2) not null default 0,
  total                    numeric(12, 2) not null default 0,
  -- Reconocimiento de la venta (al enviar o entregar)
  venta_reconocida_at      timestamptz,
  venta_transaccion_id     uuid,
  motivo_cancelacion       text,
  idempotency_key          uuid unique,
  creado_por               uuid references public.perfiles (id) default auth.uid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (anio, numero)
);
create index idx_pedidos_cliente on public.pedidos (cliente_id);
create index idx_pedidos_estado on public.pedidos (estado);
create index idx_pedidos_entrega on public.pedidos (fecha_entrega_prometida);
create index idx_pedidos_fecha on public.pedidos (fecha_pedido);

create table public.pedido_items (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null references public.pedidos (id) on delete cascade,
  linea               int not null,
  es_envio            boolean not null default false,
  tipo_producto       text not null default '',
  descripcion         text not null check (length(trim(descripcion)) >= 1),
  cantidad            numeric(10, 2) not null default 1 check (cantidad > 0),
  tamano              text,
  material            text,
  colores             text,
  precio_unitario     numeric(12, 2) not null default 0 check (precio_unitario >= 0),
  descuento           numeric(12, 2) not null default 0 check (descuento >= 0),
  tarifa_iva          numeric(5, 2) not null default 0 check (tarifa_iva >= 0),
  precio_incluye_iva  boolean not null default true,
  -- Calculados
  bruto               numeric(12, 2) not null default 0,
  base                numeric(12, 2) not null default 0,
  iva                 numeric(12, 2) not null default 0,
  total               numeric(12, 2) not null default 0,
  estado              public.estado_pedido not null default 'confirmado',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (pedido_id, linea)
);
create index idx_items_pedido on public.pedido_items (pedido_id);

-- Cálculo de cada línea. Redondeo a 2 decimales línea por línea.
create or replace function public.calcular_item()
returns trigger language plpgsql as $$
declare v_neto numeric(12, 2);
begin
  new.bruto := round(new.cantidad * new.precio_unitario, 2);
  if new.descuento > new.bruto then
    raise exception 'El descuento (%) no puede ser mayor que el valor de la línea (%)', new.descuento, new.bruto;
  end if;
  v_neto := new.bruto - new.descuento;
  if new.tarifa_iva = 0 then
    new.base := v_neto; new.iva := 0; new.total := v_neto;
  elsif new.precio_incluye_iva then
    new.total := v_neto;
    new.base := round(v_neto / (1 + new.tarifa_iva / 100), 2);
    new.iva := new.total - new.base;
  else
    new.base := v_neto;
    new.iva := round(v_neto * new.tarifa_iva / 100, 2);
    new.total := new.base + new.iva;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_items_calcular before insert or update on public.pedido_items for each row execute function public.calcular_item();

create or replace function public.recalcular_totales_pedido(p_pedido uuid)
returns void language sql security definer set search_path = public as $$
  update public.pedidos p set
    subtotal_productos = coalesce(t.prod, 0),
    subtotal_envio     = coalesce(t.envio, 0),
    total_descuentos   = coalesce(t.descs, 0),
    base_imponible     = coalesce(t.base, 0),
    total_iva          = coalesce(t.iva, 0),
    total              = coalesce(t.total, 0)
  from (
    select sum(total) filter (where not es_envio) as prod, sum(total) filter (where es_envio) as envio,
           sum(descuento) as descs, sum(base) as base, sum(iva) as iva, sum(total) as total
    from public.pedido_items where pedido_id = p_pedido
  ) t
  where p.id = p_pedido
$$;

create or replace function public.trg_items_totales()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_totales_pedido(coalesce(new.pedido_id, old.pedido_id));
  return null;
end $$;
create trigger trg_items_totales after insert or update or delete on public.pedido_items for each row execute function public.trg_items_totales();

-- Con la venta ya reconocida no se pueden cambiar precios: se usa devolución/cancelación.
create or replace function public.bloquear_items_venta_reconocida()
returns trigger language plpgsql as $$
declare v_rec timestamptz;
begin
  select venta_reconocida_at into v_rec from public.pedidos where id = coalesce(new.pedido_id, old.pedido_id);
  if v_rec is not null and (
       tg_op <> 'UPDATE'
       or (new.cantidad, new.precio_unitario, new.descuento, new.tarifa_iva, new.precio_incluye_iva, new.es_envio)
          is distinct from (old.cantidad, old.precio_unitario, old.descuento, old.tarifa_iva, old.precio_incluye_iva, old.es_envio)
     ) then
    raise exception 'El pedido ya fue entregado/enviado y su venta está registrada. Para cambiar valores, primero márcalo como devolución.';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_items_bloqueo before insert or update or delete on public.pedido_items for each row execute function public.bloquear_items_venta_reconocida();

create trigger trg_pedidos_updated before update on public.pedidos for each row execute function public.tocar_updated_at();
create trigger aud_pedidos after insert or update or delete on public.pedidos for each row execute function public.registrar_auditoria();
create trigger aud_pedido_items after insert or update or delete on public.pedido_items for each row execute function public.registrar_auditoria();

-- Historial de estados
create table public.pedido_historial (
  id               bigint generated always as identity primary key,
  pedido_id        uuid not null references public.pedidos (id) on delete cascade,
  item_id          uuid references public.pedido_items (id) on delete cascade,
  estado_anterior  public.estado_pedido,
  estado_nuevo     public.estado_pedido not null,
  nota             text,
  usuario_id       uuid default auth.uid(),
  fecha            timestamptz not null default now()
);
create index idx_historial_pedido on public.pedido_historial (pedido_id, fecha);

-- ---------- Adjuntos (archivos en almacenamiento privado) ----------
create table public.adjuntos (
  id            uuid primary key default gen_random_uuid(),
  entidad       text not null check (entidad in ('cliente', 'pedido', 'gasto', 'transaccion')),
  entidad_id    uuid not null,
  ruta          text not null unique,
  nombre        text not null,
  tipo_mime     text,
  tamano_bytes  bigint,
  categoria     text,
  subido_por    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index idx_adjuntos_entidad on public.adjuntos (entidad, entidad_id);
create trigger aud_adjuntos after insert or update or delete on public.adjuntos for each row execute function public.registrar_auditoria();

-- Estados "en curso" (para paneles y alertas)
create or replace function public.estado_activo(e public.estado_pedido)
returns boolean language sql immutable as $$
  select e not in ('cotizado', 'entregado', 'cancelado', 'devolucion')
$$;
