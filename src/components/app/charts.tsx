"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

const axis = { stroke: "#6f8273", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltip = {
  contentStyle: { background: "#111711", border: "1px solid #33463a", borderRadius: 10, fontSize: 12, color: "#eaf3eb" },
  labelStyle: { color: "#9fb1a3" },
  cursor: { fill: "rgb(16 185 129 / 0.06)" },
};
const brl = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function CaptureChart({ data }: { data: { label: string; leads: number; qualified: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={240}>
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.45} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke="#1c261e" vertical={false} />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axis} allowDecimals={false} width={44} />
        <Tooltip {...tooltip} />
        <Area type="monotone" dataKey="leads" name="Captados" stroke="#34d399" strokeWidth={2} fill="url(#cap)" />
        <Area type="monotone" dataKey="qualified" name="Score ≥ 60" stroke="#a7f3d0" strokeDasharray="4 3" strokeWidth={1.5} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis type="number" hide domain={[0, max]} />
        <YAxis type="category" dataKey="stage" {...axis} width={86} />
        <Tooltip {...tooltip} />
        <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]} barSize={18} label={{ position: "right", fill: "#9fb1a3", fontSize: 11 }}>
          {data.map((d) => <Cell key={d.stage} fill={d.stage === "Perdido" ? "#4b5f50" : d.stage === "Vendido" ? "#34d399" : "#10b981"} fillOpacity={d.stage === "Vendido" || d.stage === "Perdido" ? 1 : 0.75} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: { label: string; real: number; estimated: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid stroke="#1c261e" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={brl} width={70} />
        <Tooltip {...tooltip} formatter={(v) => brl(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9fb1a3" }} iconType="circle" />
        <Bar dataKey="real" name="Receita realizada" fill="#34d399" radius={[6, 6, 0, 0]} />
        <Bar dataKey="estimated" name="Pipeline estimado" fill="#10b981" fillOpacity={0.25} stroke="#10b981" strokeDasharray="3 3" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeeklyChart({ data }: { data: { label: string; leads: number; won: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <CartesianGrid stroke="#1c261e" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} allowDecimals={false} width={44} />
        <Tooltip {...tooltip} />
        <Bar dataKey="leads" name="Captados" fill="#10b981" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
        <Bar dataKey="won" name="Vendidos" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
