import type React from "react";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "up" | "down" | "neutral";
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  const accentClass = accent === "up" ? "text-emerald-500" : accent === "down" ? "text-red-500" : "text-primary";
  return (
    <div className="px-3 py-2.5 bg-secondary rounded-lg border border-primary">
      <div className="text-2xs uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className={`text-sm font-semibold ${accentClass} truncate`}>{value}</div>
      {sub != null && <div className="text-2xs text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
