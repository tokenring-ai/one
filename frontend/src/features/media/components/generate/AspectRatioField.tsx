export default function AspectRatioField({ value, onChange }: { value: "square" | "tall" | "wide"; onChange: (v: "square" | "tall" | "wide") => void }) {
  const options: { value: "square" | "tall" | "wide"; label: string; ratio: string }[] = [
    { value: "square", label: "Square", ratio: "1:1" },
    { value: "wide", label: "Wide", ratio: "16:9" },
    { value: "tall", label: "Tall", ratio: "9:16" },
  ];
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-secondary">Aspect Ratio</label>
      <div className="flex gap-2">
        {options.map(opt => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer focus-ring ${
              value === opt.value ? "border-accent bg-accent-subtle text-accent-soft" : "border-primary text-muted hover:text-primary hover:bg-hover"
            }`}
          >
            <div
              className={`border-2 rounded-sm ${value === opt.value ? "border-accent-soft" : "border-current"} ${
                opt.value === "square" ? "w-5 h-5" : opt.value === "wide" ? "w-7 h-5" : "w-5 h-7"
              }`}
            />
            <span>{opt.label}</span>
            <span className="text-2xs opacity-60">{opt.ratio}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
