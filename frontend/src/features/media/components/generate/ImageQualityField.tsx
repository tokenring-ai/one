export type ImageQuality = "ultra" | "high" | "standard" | "low";

const OPTIONS: { value: ImageQuality; label: string; detail: string }[] = [
  { value: "low", label: "Low", detail: "0.5 MP" },
  { value: "standard", label: "Standard", detail: "1 MP" },
  { value: "high", label: "High", detail: "4 MP" },
  { value: "ultra", label: "Ultra", detail: "10 MP" },
];

export default function ImageQualityField({ value, onChange }: { value: ImageQuality; onChange: (v: ImageQuality) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-secondary">Quality</label>
      <div className="flex gap-2">
        {OPTIONS.map(opt => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer focus-ring ${
              value === opt.value ? "border-accent bg-accent-subtle text-accent-soft" : "border-primary text-muted hover:text-primary hover:bg-hover"
            }`}
          >
            <span>{opt.label}</span>
            <span className="text-xs opacity-60">{opt.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
