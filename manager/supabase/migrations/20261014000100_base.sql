-- =====================================================================
-- MAS3D Manager · 0001 · Base: extensiones, roles, perfiles, configuración, auditoría
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------- Roles de la aplicación ----------
create type public.rol_usuario as enum ('administrador', 'contabilidad', 'produccion', 'pintura');

-- Perfil de cada persona con acceso (1 a 1 con auth.users)
create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  nombre      text not null default '',
  rol         public.rol_usuario,
  activo      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.perfiles is 'Usuarios de MAS3D Manager. Sin rol o inactivo = sin acceso.';

-- Invitaciones: al registrarse un correo invitado recibe su rol automáticamente.
-- Así nadie obtiene acceso solo por crear una cuenta.
create table public.invitaciones (
  email       text primary key check (email = lower(email)),
  nombre      text not null default '',
  rol         public.rol_usuario not null,
  invitado_por uuid references public.perfiles (id),
  created_at  timestamptz not null default now(),
  usada_at    timestamptz
);

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv public.invitaciones;
begin
  select * into inv from public.invitaciones where email = lower(new.email);
  insert into public.perfiles (id, email, nombre, rol, activo)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(inv.nombre, ''), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    inv.rol,
    inv.rol is not null
  )
  on conflict (id) do nothing;
  if inv.email is not null then
    update public.invitaciones set usada_at = now() where email = inv.email;
  end if;
  return new;
end $$;

create trigger trg_auth_users_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- ---------- Funciones de permisos ----------
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.tiene_rol(roles public.rol_usuario[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = any (roles), false)
$$;

create or replace function public.es_finanzas()
returns boolean language sql stable as $$
  select public.tiene_rol(array['administrador', 'contabilidad']::public.rol_usuario[])
$$;

create or replace function public.es_admin()
returns boolean language sql stable as $$
  select public.tiene_rol(array['administrador']::public.rol_usuario[])
$$;

create or replace function public.exigir_rol(roles public.rol_usuario[])
returns void language plpgsql stable as $$
begin
  if not public.tiene_rol(roles) then
    raise exception 'No tienes permiso para esta operación' using errcode = '42501';
  end if;
end $$;

-- ---------- Configuración del negocio (una sola fila) ----------
create table public.configuracion (
  id                    smallint primary key default 1 check (id = 1),
  nombre_comercial      text not null default 'MAS3D',
  razon_social          text not null default '',
  ruc                   text not null default '',
  regimen               text not null default 'RIMPE Emprendedor (por confirmar)',
  direccion             text not null default 'Calles 4 de Noviembre y Bartolomé Serrano, diagonal al CEI María Montessori',
  ciudad                text not null default 'Azogues',
  provincia             text not null default 'Cañar',
  whatsapp              text not null default '0983890036',
  instagram             text not null default '@mas3d.ec',
  moneda                text not null default 'USD',
  zona_horaria          text not null default 'America/Guayaquil',
  -- Tributario: deliberadamente desactivado hasta que el contador confirme.
  iva_activo            boolean not null default false,
  iva_tarifa            numeric(5, 2) not null default 15.00 check (iva_tarifa >= 0 and iva_tarifa <= 100),
  precios_incluyen_iva  boolean not null default true,
  config_tributaria_confirmada boolean not null default false,
  -- Comercial
  anticipo_porcentaje   numeric(5, 2) not null default 50.00 check (anticipo_porcentaje between 0 and 100),
  envio_referencial     numeric(12, 2) not null default 7.00 check (envio_referencial >= 0),
  dias_fabricacion      int not null default 5 check (dias_fabricacion between 0 and 365),
  exigir_2fa_admin      boolean not null default false,
  fecha_inicio_contable date,
  updated_at            timestamptz not null default now()
);
insert into public.configuracion (id) values (1);

-- ---------- Auditoría ----------
create table public.auditoria (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro_id text,
  accion      text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id  uuid,
  antes       jsonb,
  despues     jsonb,
  fecha       timestamptz not null default now()
);
create index idx_auditoria_tabla on public.auditoria (tabla, registro_id);
create index idx_auditoria_fecha on public.auditoria (fecha desc);

create or replace function public.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;
  insert into public.auditoria (tabla, registro_id, accion, usuario_id, antes, despues)
  values (tg_table_name, coalesce(v_new->>'id', v_old->>'id'), tg_op, auth.uid(), v_old, v_new);
  return coalesce(new, old);
end $$;

create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_perfiles_updated before update on public.perfiles for each row execute function public.tocar_updated_at();
create trigger trg_config_updated before update on public.configuracion for each row execute function public.tocar_updated_at();
create trigger aud_perfiles after insert or update or delete on public.perfiles for each row execute function public.registrar_auditoria();
create trigger aud_configuracion after insert or update or delete on public.configuracion for each row execute function public.registrar_auditoria();
create trigger aud_invitaciones after insert or update or delete on public.invitaciones for each row execute function public.registrar_auditoria();

-- Un administrador no puede quitarse a sí mismo el rol ni dejar el sistema sin administradores.
create or replace function public.proteger_ultimo_admin()
returns trigger language plpgsql as $$
begin
  if old.rol = 'administrador' and old.activo
     and (new.rol is distinct from 'administrador' or not new.activo)
     and not exists (select 1 from public.perfiles where rol = 'administrador' and activo and id <> old.id) then
    raise exception 'Debe existir al menos un administrador activo';
  end if;
  return new;
end $$;
create trigger trg_perfiles_ultimo_admin before update on public.perfiles for each row execute function public.proteger_ultimo_admin();

-- ---------- Utilidades ----------
-- Normaliza un número ecuatoriano a formato internacional sin '+': 0983890036 -> 593983890036
create or replace function public.normalizar_telefono(t text)
returns text language sql immutable as $$
  select case
    when d = '' then null
    when d like '593%' then d
    when d like '0%' and length(d) = 10 then '593' || substr(d, 2)
    when length(d) = 9 and d like '9%' then '593' || d
    else d
  end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x
$$;

-- Valida cédula ecuatoriana (módulo 10)
create or replace function public.validar_cedula(c text)
returns boolean language plpgsql immutable as $$
declare
  suma int := 0; d int; prov int; i int;
begin
  if c !~ '^\d{10}$' then return false; end if;
  prov := substr(c, 1, 2)::int;
  if prov < 1 or (prov > 24 and prov <> 30) then return false; end if;
  if substr(c, 3, 1)::int > 5 then return false; end if;
  for i in 1..9 loop
    d := substr(c, i, 1)::int * case when i % 2 = 1 then 2 else 1 end;
    if d > 9 then d := d - 9; end if;
    suma := suma + d;
  end loop;
  return (10 - suma % 10) % 10 = substr(c, 10, 1)::int;
end $$;

-- Valida RUC ecuatoriano (persona natural, sociedad privada o pública)
create or replace function public.validar_ruc(r text)
returns boolean language plpgsql immutable as $$
declare
  tercer int; suma int := 0; i int; coef int[]; verif int; resto int;
begin
  if r !~ '^\d{13}$' or substr(r, 11, 3) = '000' then return false; end if;
  tercer := substr(r, 3, 1)::int;
  if tercer < 6 then
    return public.validar_cedula(substr(r, 1, 10));
  elsif tercer = 9 then
    coef := array[4, 3, 2, 7, 6, 5, 4, 3, 2];
    for i in 1..9 loop suma := suma + substr(r, i, 1)::int * coef[i]; end loop;
    resto := suma % 11;
    verif := case when resto = 0 then 0 else 11 - resto end;
    return verif = substr(r, 10, 1)::int;
  elsif tercer = 6 then
    coef := array[3, 2, 7, 6, 5, 4, 3, 2];
    for i in 1..8 loop suma := suma + substr(r, i, 1)::int * coef[i]; end loop;
    resto := suma % 11;
    verif := case when resto = 0 then 0 else 11 - resto end;
    return verif = substr(r, 9, 1)::int;
  end if;
  return false;
end $$;
