'use client';

import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/cn';
import { formatDayMonth } from '@/lib/domain/datetime';

/**
 * Gráficas del sistema (§82): pocas líneas, sin exceso de color, tooltip al
 * tocar y el dato importante grande fuera del gráfico.
 */

export const CHART_COLORS = {
  volt: '#ccff33',
  data: '#5b8cff',
  violet: '#a77bff',
  teal: '#2dd4bf',
  amber: '#ffb020',
  danger: '#ff5a5a',
} as const;

export type ChartColor = keyof typeof CHART_COLORS;

const AXIS_PROPS = {
  stroke: '#4a5364',
  tickLine: false,
  axisLine: false,
  tick: { fill: '#6b7488', fontSize: 11 },
} as const;

interface TooltipPayloadEntry {
  value?: number | string;
  name?: string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  unit?: string;
  labelFormatter?: (value: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="text-xs text-ink-400">
        {labelFormatter && typeof label === 'string' ? labelFormatter(label) : label}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="tabular text-sm font-semibold text-ink-50">
          {typeof entry.value === 'number'
            ? entry.value.toLocaleString('es-ES', { maximumFractionDigits: 2 })
            : entry.value}
          {unit ? <span className="ml-1 text-xs font-normal text-ink-400">{unit}</span> : null}
        </p>
      ))}
    </div>
  );
}

export interface SeriesPoint {
  date: string;
  value: number | null;
}

export function TrendChart({
  data,
  color = 'volt',
  unit,
  height = 200,
  variant = 'area',
  className,
}: {
  data: SeriesPoint[];
  color?: ChartColor;
  unit?: string;
  height?: number;
  variant?: 'area' | 'line';
  className?: string;
}) {
  const stroke = CHART_COLORS[color];
  // `useId` da un identificador estable entre servidor y cliente, sin azar.
  const gradientId = `grad-${color}-${useId().replace(/:/g, '')}`;
  const clean = data.filter((point) => point.value !== null);

  if (clean.length === 0) {
    return <EmptyChart height={height} className={className} />;
  }

  const Chart = variant === 'area' ? AreaChart : LineChart;

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={clean} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a1f2a" vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDayMonth} minTickGap={24} {...AXIS_PROPS} />
          <YAxis width={44} domain={['auto', 'auto']} {...AXIS_PROPS} />
          <Tooltip
            content={<ChartTooltip unit={unit} labelFormatter={(value) => formatDayMonth(value)} />}
            cursor={{ stroke: '#333b4b', strokeWidth: 1 }}
          />
          {variant === 'area' ? (
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={clean.length <= 12 ? { r: 3, fill: stroke, strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: stroke, stroke: '#06070a', strokeWidth: 2 }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2.5}
              dot={clean.length <= 12 ? { r: 3, fill: stroke, strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: stroke, stroke: '#06070a', strokeWidth: 2 }}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data,
  color = 'data',
  unit,
  height = 200,
  highlightIndex,
  className,
}: {
  data: { label: string; value: number }[];
  color?: ChartColor;
  unit?: string;
  height?: number;
  highlightIndex?: number;
  className?: string;
}) {
  const fill = CHART_COLORS[color];
  if (data.length === 0) return <EmptyChart height={height} className={className} />;

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#1a1f2a" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis width={44} {...AXIS_PROPS} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[6, 6, 2, 2]} maxBarSize={44}>
            {data.map((_, index) => (
              <Cell key={index} fill={index === highlightIndex ? CHART_COLORS.volt : fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ height, className }: { height: number; className?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center rounded-xl border border-dashed border-ink-700', className)}
      style={{ height }}
    >
      <p className="text-sm text-ink-500">Sin datos todavía</p>
    </div>
  );
}

/** Minigráfica en línea para tarjetas compactas. */
export function Sparkline({
  data,
  color = 'volt',
  height = 40,
}: {
  data: SeriesPoint[];
  color?: ChartColor;
  height?: number;
}) {
  const clean = data.filter((point) => point.value !== null);
  if (clean.length < 2) return <div style={{ height }} />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={clean} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[color]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
