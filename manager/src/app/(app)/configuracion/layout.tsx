import { exigirRol } from '@/lib/auth';
import { PestanasConfig } from './pestanas';

export default async function ConfigLayout({ children }: { children: React.ReactNode }) {
  const p = await exigirRol();
  return <><PestanasConfig admin={p.rol === 'administrador'} />{children}</>;
}
