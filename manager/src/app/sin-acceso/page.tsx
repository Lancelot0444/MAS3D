import { cerrarSesion } from '../login/actions';
import { Boton } from '@/components/ui';
import { perfilActual } from '@/lib/auth';

export const metadata = { title: 'Sin acceso' };

export default async function SinAcceso() {
  const p = await perfilActual();
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="tarjeta max-w-md p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-192.png" alt="" width={88} height={88} className="mx-auto rounded-3xl" />
        <h1 className="titulo-marca mt-4 text-2xl font-bold">Tu cuenta está pendiente</h1>
        <p className="mt-2 text-sm text-tinta-3">
          Entraste como <b>{p?.email}</b>, pero todavía no tienes un rol asignado. Pide a Brian o Mayra que te inviten desde
          <i> Configuración → Usuarios</i>.
        </p>
        <form action={cerrarSesion} className="mt-6"><Boton variante="borde">Cerrar sesión</Boton></form>
      </div>
    </main>
  );
}
