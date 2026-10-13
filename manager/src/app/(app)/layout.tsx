import { exigirRol, esFinanzas, ROLES } from '@/lib/auth';
import { Navegacion } from '@/components/navegacion';
import { EnVivo } from '@/components/en-vivo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await exigirRol();
  const finanzas = esFinanzas(perfil.rol);
  return (
    <div className="min-h-dvh lg:pl-64">
      <Navegacion nombre={perfil.nombre} rol={ROLES[perfil.rol!]} finanzas={finanzas} admin={perfil.rol === 'administrador'} />
      <EnVivo tablas={finanzas ? ['pedidos', 'pedido_items', 'transacciones', 'gastos', 'clientes'] : ['pedido_historial']} />
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 lg:pb-10 lg:pt-8">{children}</main>
    </div>
  );
}
