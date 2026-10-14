'use client';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dinero } from '@/lib/money';

const COLORES = { ventas: '#c99a55', cobrado: '#262221', gastos: '#c2603f' };
const eje = { fontSize: 12, fill: '#6b6260' };
const fmtEje = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`);
const tooltip = { contentStyle: { borderRadius: 12, border: '1px solid #efe6d8', fontSize: 13 }, formatter: (v: unknown) => dinero(Number(v ?? 0)) };

export type PuntoSerie = { etiqueta: string; ventas: number; cobrado: number; gastos: number };

export function IngresosVsGastos({ datos }: { datos: PuntoSerie[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="#f1e9dc" />
        <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={fmtEje} width={54} />
        <Tooltip {...tooltip} cursor={{ fill: '#fbf4ea' }} />
        <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
        <Bar dataKey="cobrado" name="Cobrado" fill={COLORES.cobrado} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="gastos" name="Gastos" fill={COLORES.gastos} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EvolucionVentas({ datos }: { datos: PuntoSerie[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1e9dc" />
        <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={fmtEje} width={54} />
        <Tooltip {...tooltip} />
        <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
        <Line type="monotone" dataKey="ventas" name="Ventas realizadas" stroke={COLORES.ventas} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke={COLORES.cobrado} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DistribucionGastos({ datos }: { datos: { categoria: string; total: number }[] }) {
  const total = datos.reduce((s, d) => s + d.total, 0) || 1;
  return (
    <ul className="space-y-2.5">
      {datos.map((d) => (
        <li key={d.categoria} className="grid grid-cols-[minmax(90px,35%)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-tinta-2">{d.categoria}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-crema-2">
            <span className="block h-full rounded-full bg-gradient-to-r from-oro-300 to-oro-600" style={{ width: `${Math.max(2, (d.total / total) * 100)}%` }} />
          </span>
          <span className="cifra font-semibold">{dinero(d.total)}</span>
        </li>
      ))}
    </ul>
  );
}
