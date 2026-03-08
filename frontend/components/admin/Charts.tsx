'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'

const COLORS = ['#C9A84C', '#86efac', '#60a5fa', '#fca5a5', '#c084fc', '#facc15']

export function DailyVisitsChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div style={{ width: '100%', minHeight: 260, height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="date" stroke="rgba(245,240,232,0.65)" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} width={34} stroke="rgba(245,240,232,0.65)" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#C9A84C" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LanguagePie({ data }: { data: { language: string; count: number }[] }) {
  return (
    <div style={{ width: '100%', minHeight: 260, height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="language" outerRadius={80} label>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HeatmapBars({ data }: { data: { exhibit_id: string; scan_count: number }[] }) {
  return (
    <div style={{ width: '100%', minHeight: 280, height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 10)} margin={{ top: 8, right: 8, left: -12, bottom: 42 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="exhibit_id" stroke="rgba(245,240,232,0.65)" tick={{ fontSize: 11 }} interval={0} angle={-16} textAnchor="end" height={54} />
          <YAxis allowDecimals={false} width={34} stroke="rgba(245,240,232,0.65)" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="scan_count" fill="#C9A84C" radius={[6, 6, 0, 0]} maxBarSize={40} minPointSize={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
