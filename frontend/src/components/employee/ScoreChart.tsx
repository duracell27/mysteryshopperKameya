import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Dot,
} from 'recharts';
import { AuditResult } from '../../types';
import { formatDate } from '../../utils/dateFormatter';

interface ScoreChartProps {
  reports: AuditResult[];
}

interface ChartPoint {
  quarter: string;
  score: number;
  date: string;
  points: number;
}

function buildChartData(reports: AuditResult[]): ChartPoint[] {
  const currentYear = new Date().getFullYear();
  const byQuarter: Record<string, AuditResult> = {};

  for (const r of reports) {
    if (!r.quarter || r.year !== currentYear) continue;
    if (!byQuarter[r.quarter] || new Date(r.createdAt ?? 0) > new Date(byQuarter[r.quarter].createdAt ?? 0)) {
      byQuarter[r.quarter] = r;
    }
  }

  const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
  return quarterOrder
    .filter((q) => byQuarter[q])
    .map((q) => {
      const r = byQuarter[q];
      const score = Math.round(r.totalScore);
      const pts = score === 100 ? 100 : score >= 97 ? 60 : score >= 94 ? 50 : score >= 85 ? 40 : score >= 70 ? 20 : 0;
      return {
        quarter: q,
        score,
        date: formatDate(r.date),
        points: pts,
      };
    });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: ChartPoint }[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-kameya-burgundy mb-1">{d.quarter} {new Date().getFullYear()}</p>
      <p className="text-slate-500">{d.date}</p>
      <p className="text-slate-700 font-semibold">Результат: {d.score}%</p>
      <p className="text-slate-700">Нараховано: <span className="font-semibold text-kameya-burgundy">+{d.points} балів</span></p>
    </div>
  );
};

export const ScoreChart: React.FC<ScoreChartProps> = ({ reports }) => {
  const data = buildChartData(reports);

  if (data.length === 0) return null;

  const minScore = Math.min(...data.map((d) => d.score));
  const yMin = Math.max(0, minScore - 5);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7B1C3A" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#7B1C3A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="quarter"
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[yMin, 100]}
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#7B1C3A"
          strokeWidth={2.5}
          fill="url(#scoreGradient)"
          dot={<Dot r={5} fill="#7B1C3A" stroke="#fff" strokeWidth={2} />}
          activeDot={{ r: 7, fill: '#7B1C3A', stroke: '#fff', strokeWidth: 2 }}
          label={{ position: 'top', fontSize: 11, fill: '#7B1C3A', fontWeight: 600, formatter: (v: any) => `${v}%` }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
