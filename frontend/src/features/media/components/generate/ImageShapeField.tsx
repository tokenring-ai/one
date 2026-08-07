export type ImageShape = "square" | "landscape" | "portrait" | "ultrawide" | "ultratall";

const OPTIONS: { value: ImageShape; label: string; ratio: string; boxClass: string }[] = [
  { value: "square", label: "Square", ratio: "1:1", boxClass: "w-5 h-5" },
  { value: "landscape", label: "Landscape", ratio: "16:9", boxClass: "w-7 h-4" },
  { value: "portrait", label: "Portrait", ratio: "9:16", boxClass: "w-4 h-7" },
  { value: "ultrawide", label: "Ultrawide", ratio: "21:9", boxClass: "w-8 h-3.5" },
  { value: "ultratall", label: "Ultratall", ratio: "9:21", boxClass: "w-3.5 h-8" },
];

export default function ImageShapeField({ value, onChange }: { value: ImageShape; onChange: (v: ImageShape) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-secondary">Shape</label>
      <div className="grid grid-cols-5 gap-1.5">
        {OPTIONS.map(opt => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-all cursor-pointer focus-ring ${
              value === opt.value ? "border-accent bg-accent-subtle text-accent-soft" : "border-primary text-muted hover:text-primary hover:bg-hover"
            }`}
          >
            <div className={`border-2 rounded-sm ${value === opt.value ? "border-accent-soft" : "border-current"} ${opt.boxClass}`} />
            <span className="leading-tight text-center">{opt.label}</span>
            <span className="opacity-60">{opt.ratio}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
