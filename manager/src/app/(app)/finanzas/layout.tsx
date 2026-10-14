import { exigirRol } from '@/lib/auth';
import { PestanasFinanzas } from './pestanas';

export default async function FinanzasLayout({ children }: { children: React.ReactNode }) {
  await exigirRol(['administrador', 'contabilidad']);
  return (<><PestanasFinanzas />{children}</>);
}
