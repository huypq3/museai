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
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="date" stroke="rgba(245,240,232,0.65)" />
          <YAxis stroke="rgba(245,240,232,0.65)" />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#C9A84C" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LanguagePie({ data }: { data: { language: string; count: number }[] }) {
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
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

export function HeatmapBars({ data }: { data: { artifact_id: string; scan_count: number }[] }) {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data.slice(0, 10)}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="artifact_id" stroke="rgba(245,240,232,0.65)" />
          <YAxis stroke="rgba(245,240,232,0.65)" />
          <Tooltip />
          <Bar dataKey="scan_count" fill="#C9A84C" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
