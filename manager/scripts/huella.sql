-- Totales de control: deben coincidir antes y después de restaurar un respaldo
select 'clientes', count(*)::text from public.clientes
union all select 'pedidos', count(*)::text from public.pedidos
union all select 'transacciones', count(*)::text from public.transacciones
union all select 'asientos', count(*)::text from public.asientos
union all select 'suma_debe', coalesce(sum(debe), 0)::text from public.asientos
union all select 'suma_haber', coalesce(sum(haber), 0)::text from public.asientos
union all select 'gastos', count(*)::text from public.gastos
union all select 'usuarios', count(*)::text from public.perfiles
order by 1;
