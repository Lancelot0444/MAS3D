-- =====================================================================
-- MAS3D Manager · 0006 · Verificación en dos pasos obligatoria a nivel de base de datos
-- Si un usuario activó la verificación en dos pasos, su sesión solo tiene permisos
-- cuando completó el segundo paso (aal2). Así no se puede saltar desde la app.
-- =====================================================================
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = public as $$
  select p.rol from public.perfiles p
  where p.id = auth.uid() and p.activo
    and (
      coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status::text = 'verified')
    )
$$;
