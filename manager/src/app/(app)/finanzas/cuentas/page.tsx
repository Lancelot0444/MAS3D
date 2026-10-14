import { exigirRol } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { dinero } from '@/lib/money';
import { hoyEC } from '@/lib/fechas';
import { SUBTIPOS_CUENTA } from '@/lib/dominio';
import { Encabezado, Insignia, Tarjeta, Vacio } from '@/components/ui';
import { FormsCuentas } from './forms';

export const metadata = { title: 'Cuentas' };

export default async function Cuentas() {
  const perfil = await exigirRol(['administrador', 'contabilidad']);
  const supabase = await supabaseServer();
  const { data: cuentas } = await supabase.from('v_cuentas_saldo').select('*').order('activa', { ascending: false }).order('orden').order('nombre');
  const admin = perfil.rol === 'administrador';
  const total = (cuentas ?? []).filter((c) => c.activa).reduce((s, c) => s + Number(c.saldo), 0);
  return (
    <>
      <Encabezado titulo="Cuentas de dinero" subtitulo={`Saldo total: ${dinero(total)}`} />
      {!cuentas?.length ? <Vacio>Aún no hay cuentas. {admin ? 'Crea la primera abajo (ej. “Caja de efectivo MAS3D”).' : 'Pide a un administrador que las cree.'}</Vacio> : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cuentas.map((c) => (
            <div key={c.id} className={`tarjeta p-4 ${c.activa ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-bold">{c.nombre}</span><Insignia>{SUBTIPOS_CUENTA[c.subtipo as keyof typeof SUBTIPOS_CUENTA]}</Insignia></div>
              <div className="text-xs text-tinta-3">{[c.institucion, c.numero_referencia].filter(Boolean).join(' · ') || ' '}</div>
              <div className={`cifra mt-2 text-2xl font-bold ${Number(c.saldo) < 0 ? 'text-red-700' : ''}`}>{dinero(c.saldo)}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                {!c.tiene_apertura && c.activa && <Insignia className="bg-amber-100 text-amber-900">Sin saldo inicial</Insignia>}
                {!c.activa && <Insignia>Inactiva</Insignia>}
                <a href={`/finanzas?cuenta=${c.id}&periodo=anio`} className="font-semibold text-oro-700">Ver movimientos</a>
              </div>
            </div>
          ))}
        </div>
      )}
      {admin && (
        <Tarjeta titulo="Administrar cuentas">
          <FormsCuentas cuentas={(cuentas ?? []).filter((c) => c.activa).map((c) => ({ id: c.id, nombre: c.nombre, tiene_apertura: c.tiene_apertura }))} hoy={hoyEC()} />
        </Tarjeta>
      )}
    </>
  );
}
