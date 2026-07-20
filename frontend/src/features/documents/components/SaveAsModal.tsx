import { Loader2, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SaveAsModalProps {
  providers: string[];
  initialPath: string;
  onSave: (path: string, provider: string) => Promise<void>;
  onClose: () => void;
}

export default function SaveAsModal({ providers, initialPath, onSave, onClose }: SaveAsModalProps) {
  const [path, setPath] = useState(initialPath);
  const [provider, setProvider] = useState(providers[0] ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async () => {
    if (!path.trim() || !provider) return;
    setSaving(true);
    try {
      await onSave(path.trim(), provider);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-secondary border border-primary rounded-xl p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">Save As</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {providers.length > 1 && (
            <div className="space-y-1">
              <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Location</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value)}
                className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-ring"
              >
                {providers.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted uppercase tracking-wide">File path</label>
            <input
              ref={inputRef}
              type="text"
              value={path}
              onChange={e => setPath(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !saving) void handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="documents/my-file.md"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!path.trim() || !provider || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
