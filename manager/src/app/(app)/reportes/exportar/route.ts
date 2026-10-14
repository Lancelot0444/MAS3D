import ExcelJS from 'exceljs';
import { NextResponse, type NextRequest } from 'next/server';
import { perfilActual, esFinanzas } from '@/lib/auth';
import { obtenerReporte } from '@/lib/reportes';
import { rango } from '@/lib/fechas';

export async function GET(req: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil?.activo || !esFinanzas(perfil.rol)) return new NextResponse('No autorizado', { status: 403 });
  const sp = req.nextUrl.searchParams;
  const tipo = sp.get('r') ?? 'resultados';
  const { desde, hasta } = rango(sp.get('periodo') ?? undefined, sp.get('desde') ?? undefined, sp.get('hasta') ?? undefined);
  const rep = await obtenerReporte(tipo, desde, hasta);
  if (!rep) return new NextResponse('Reporte no encontrado', { status: 404 });

  const libro = new ExcelJS.Workbook();
  libro.creator = 'MAS3D Manager';
  const hoja = libro.addWorksheet(rep.titulo.slice(0, 30));
  hoja.addRow([`MAS3D — ${rep.titulo}`]).font = { bold: true, size: 14 };
  hoja.addRow([rep.usaFechas ? `Del ${desde} al ${hasta}` : `Al ${hasta}`]);
  hoja.addRow([rep.descripcion]).font = { italic: true, color: { argb: 'FF6B6260' } };
  hoja.addRow([]);
  const enc = hoja.addRow(rep.columnas.map((c) => c.t));
  enc.font = { bold: true, color: { argb: 'FFFBF4EA' } };
  enc.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF262221' } }; });
  for (const f of rep.filas) {
    hoja.addRow(rep.columnas.map((c) => {
      const v = f[c.k];
      if (v === null || v === undefined) return null;
      if (c.tipo === 'fecha') return new Date(`${v}T12:00:00Z`);
      if (c.tipo === 'dinero' || c.tipo === 'numero') return Number(v);
      return v;
    }));
  }
  if (rep.totales) {
    const t = hoja.addRow(rep.columnas.map((c, i) => (i === 0 ? 'Total' : rep.totales![c.k] ?? null)));
    t.font = { bold: true };
  }
  rep.columnas.forEach((c, i) => {
    const col = hoja.getColumn(i + 1);
    col.width = c.tipo === 'dinero' ? 14 : c.tipo === 'fecha' ? 13 : Math.min(45, Math.max(12, c.t.length + 4));
    if (c.tipo === 'dinero') col.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    if (c.tipo === 'fecha') col.numFmt = 'dd/mm/yyyy';
  });
  const buffer = await libro.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="mas3d-${tipo}-${desde}-a-${hasta}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
