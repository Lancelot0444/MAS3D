import { exigirRol, ROLES } from '@/lib/auth';
import { Encabezado, Tarjeta } from '@/components/ui';
import { FormNombre, FormClave, DosPasos } from './cliente';

export const metadata = { title: 'Mi cuenta' };

export default async function MiCuenta() {
  const p = await exigirRol();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Encabezado titulo="Mi cuenta" subtitulo={`${p.email} · ${ROLES[p.rol!]}`} />
      <Tarjeta titulo="Nombre"><FormNombre nombre={p.nombre} /></Tarjeta>
      <Tarjeta titulo="Contraseña"><FormClave /></Tarjeta>
      <Tarjeta titulo="Verificación en dos pasos"><DosPasos /></Tarjeta>
    </div>
  );
}
