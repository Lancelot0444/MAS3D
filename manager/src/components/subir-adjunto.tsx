'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { registrarAdjunto } from '@/app/adjuntos/actions';

const PERMITIDOS = /^(image\/|application\/pdf|model\/|application\/(octet-stream|vnd\.ms-pki\.stl|sla|zip|x-zip-compressed))/;
const MAX = 50 * 1024 * 1024;

export function SubirAdjunto({ entidad, id, ruta, categorias }: { entidad: 'cliente' | 'pedido' | 'gasto'; id: string; ruta: string; categorias?: string[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [categoria, setCategoria] = useState(categorias?.[0] ?? '');

  const subir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    const supabase = supabaseBrowser();
    for (const a of Array.from(archivos)) {
      const ext = a.name.split('.').pop()?.toLowerCase() ?? '';
      const tipo = a.type || (['stl', '3mf', 'obj'].includes(ext) ? 'model/' + ext : 'application/octet-stream');
      if (a.size > MAX) { setEstado(`${a.name}: supera 50 MB`); continue; }
      if (!PERMITIDOS.test(tipo) && !['stl', '3mf', 'obj'].includes(ext)) { setEstado(`${a.name}: tipo de archivo no permitido`); continue; }
      setEstado(`Subiendo ${a.name}…`);
      const destino = `${entidad}/${id}/${Date.now()}-${a.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await supabase.storage.from('adjuntos').upload(destino, a, { contentType: tipo, upsert: false });
      if (error) { setEstado(`No se pudo subir ${a.name}: ${error.message}`); return; }
      const r = await registrarAdjunto({ entidad, entidad_id: id, ruta: destino, nombre: a.name, tipo_mime: tipo, tamano_bytes: a.size, categoria: categoria || undefined, ruta_pagina: ruta });
      if (!r.ok) { setEstado(r.error); return; }
    }
    setEstado(null);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {estado && <span className="text-xs text-tinta-3">{estado}</span>}
      {categorias && (
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="campo !min-h-9 !w-auto !py-1 !text-sm" aria-label="Tipo de archivo">
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
      )}
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-[#e3d8c7] bg-white px-3 text-sm font-semibold hover:border-oro-500">
        <Upload className="size-4" />Subir
        <input ref={input} type="file" multiple accept="image/*,.pdf,.stl,.3mf,.obj,.zip" className="sr-only" onChange={(e) => subir(e.target.files)} />
      </label>
    </div>
  );
}
