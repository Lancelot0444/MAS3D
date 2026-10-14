'use client';
import { Printer } from 'lucide-react';
import { Boton } from './ui';

export function BotonImprimir({ texto = 'Imprimir / guardar PDF' }: { texto?: string }) {
  return <Boton variante="borde" onClick={() => window.print()}><Printer className="size-4" />{texto}</Boton>;
}
