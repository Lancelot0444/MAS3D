import { FileText, ImageIcon } from 'lucide-react';
import { supabaseServer } from '@/lib/supabase/server';
import { Tarjeta, Vacio } from './ui';
import { SubirAdjunto } from './subir-adjunto';

/** Archivos privados de un cliente, pedido o gasto. Los enlaces caducan en 1 hora. */
export async function Adjuntos({ entidad, id, ruta, titulo = 'Archivos', categorias }: { entidad: 'cliente' | 'pedido' | 'gasto'; id: string; ruta: string; titulo?: string; categorias?: string[] }) {
  const supabase = await supabaseServer();
  const { data: filas } = await supabase.from('adjuntos').select('*').eq('entidad', entidad).eq('entidad_id', id).order('created_at', { ascending: false });
  let urls: Record<string, string> = {};
  if (filas?.length) {
    const { data } = await supabase.storage.from('adjuntos').createSignedUrls(filas.map((f) => f.ruta), 3600);
    urls = Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  }
  return (
    <Tarjeta titulo={titulo} accion={<SubirAdjunto entidad={entidad} id={id} ruta={ruta} categorias={categorias} />}>
      {!filas?.length ? <Vacio>Sin archivos todavía.</Vacio> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filas.map((f) => {
            const url = urls[f.ruta];
            const img = f.tipo_mime?.startsWith('image/');
            return (
              <li key={f.id} className="overflow-hidden rounded-xl border border-[#efe6d8] bg-white">
                <a href={url ?? '#'} target="_blank" rel="noopener" className="block">
                  {img && url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={url} alt={f.nombre} className="aspect-square w-full object-cover" />
                    : <div className="grid aspect-square place-items-center bg-crema">{img ? <ImageIcon className="size-8 text-oro-600" /> : <FileText className="size-8 text-oro-600" />}</div>}
                  <div className="p-2 text-xs"><div className="truncate font-semibold">{f.nombre}</div>{f.categoria && <div className="text-tinta-3">{f.categoria}</div>}</div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
