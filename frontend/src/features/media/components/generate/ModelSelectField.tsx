export default function ModelSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const isEmpty = options.length === 0;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-secondary">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={isEmpty}
        className="w-full bg-input border border-primary rounded-lg py-2 px-3 text-sm text-primary focus-accent transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isEmpty ? (
          <option value="">No models available</option>
        ) : (
          options.map(m => (
            <option key={m} value={m}>
              {m}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
