import { useState } from "react";

interface ChartTabProps {
  symbol: string;
}

export default function ChartTab({ symbol }: ChartTabProps) {
  const [chartInterval, setChartInterval] = useState("daily");
  const intervals = [
    { label: "1D", value: "1" },
    { label: "5D", value: "5" },
    { label: "1M", value: "daily" },
    { label: "3M", value: "daily3m" },
    { label: "1Y", value: "weekly" },
  ];

  const chartUrl = `https://chart.financialcontent.com/Chart?shwidth=3&fillshx=0&height=200&lncolor=6366f1&interval=${chartInterval}&fillshy=0&gtcolor=6366f1&vucolor=10b981&bvcolor=1e293b&gmcolor=334155&shcolor=475569&grcolor=0f172a&vdcolor=ef4444&brcolor=0f172a&gbcolor=0f172a&lnwidth=2&volume=1&pvcolor=ef4444&mkcolor=ef4444&itcolor=94a3b8&fillalpha=20&ticker=${symbol}&Client=stocks&txcolor=94a3b8&output=svg&bgcolor=1e293b&arcolor=null&type=0&width=800`;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {intervals.map(iv => (
          <button
            type="button"
            key={iv.value}
            onClick={() => setChartInterval(iv.value)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer focus-ring ${
              chartInterval === iv.value ? "bg-accent text-white" : "bg-secondary text-muted hover:text-primary border border-primary"
            }`}
          >
            {iv.label}
          </button>
        ))}
      </div>
      <div className="bg-secondary rounded-xl border border-primary overflow-hidden">
        <img
          src={chartUrl}
          alt={`${symbol} price chart`}
          className="w-full h-48 object-cover"
          onError={e => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    </div>
  );
}
