import formatError from "@tokenring-ai/utility/error/formatError";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Pencil, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useVaultKeys, vaultRPCClient } from "../../rpc.ts";

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES: { id: string; label: string }[] = [
  { id: "env", label: "Environment Variables" },
  { id: "token", label: "Stored Auth Tokens" },
];

// ─── Key row ──────────────────────────────────────────────────────────────────

function KeyRow({ category, keyName, onDeleted, onSaved }: { category: string; keyName: string; onDeleted: () => void; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await vaultRPCClient.setItems({ updates: [{ category, key: keyName, value }] });
      toastManager.success(`"${keyName}" saved`, { duration: 3000 });
      setEditing(false);
      setValue("");
      onSaved();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await vaultRPCClient.deleteItems({ updates: [{ category, key: keyName }] });
      toastManager.success(`"${keyName}" deleted`, { duration: 3000 });
      onDeleted();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-primary last:border-b-0">
      <div className="flex items-center gap-3">
        <KeyRound className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="flex-1 text-sm font-mono text-primary truncate">{keyName}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setConfirmDelete(false);
              }}
              className="p-1.5 text-muted hover:text-primary transition-colors rounded-md focus-ring cursor-pointer"
              title="Update value"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {confirmDelete ? (
            <>
              <span className="text-xs text-red-500 font-medium">Confirm?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-md cursor-pointer disabled:opacity-50 focus-ring"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 text-muted hover:text-primary transition-colors rounded-md focus-ring cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 text-muted hover:text-red-500 transition-colors rounded-md focus-ring cursor-pointer"
              title="Delete key"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex items-center gap-2 pl-6">
          <div className="relative flex-1">
            <input
              type={showValue ? "text" : "password"}
              placeholder="New value..."
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") void handleSave();
                if (e.key === "Escape") {
                  setEditing(false);
                  setValue("");
                }
              }}
              autoFocus
              className="w-full bg-input border border-primary rounded-lg py-1.5 pl-3 pr-8 text-xs text-primary placeholder-muted focus-accent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowValue(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary cursor-pointer"
            >
              {showValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !value}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setValue("");
            }}
            className="p-1.5 text-muted hover:text-primary transition-colors rounded-md focus-ring cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add key form ─────────────────────────────────────────────────────────────

function AddKeyForm({ category, onAdded }: { category: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!key.trim() || !value) return;
    setSaving(true);
    try {
      await vaultRPCClient.setItems({ updates: [{ category, key: key.trim(), value }] });
      toastManager.success(`"${key.trim()}" added`, { duration: 3000 });
      setKey("");
      setValue("");
      setOpen(false);
      onAdded();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 w-full text-left text-xs text-muted hover:text-primary hover:bg-hover transition-colors border-t border-primary cursor-pointer focus-ring"
      >
        <Plus className="w-3.5 h-3.5" /> Add new key
      </button>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-primary space-y-2">
      <input
        type="text"
        placeholder="Key name"
        value={key}
        onChange={e => setKey(e.target.value)}
        autoFocus
        className="w-full bg-input border border-primary rounded-lg py-1.5 px-3 text-xs text-primary placeholder-muted focus-accent font-mono"
      />
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={showValue ? "text" : "password"}
            placeholder="Value"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") setOpen(false);
            }}
            className="w-full bg-input border border-primary rounded-lg py-1.5 pl-3 pr-8 text-xs text-primary placeholder-muted focus-accent font-mono"
          />
          <button
            type="button"
            onClick={() => setShowValue(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary cursor-pointer"
          >
            {showValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !key.trim() || !value}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1.5 text-muted hover:text-primary transition-colors rounded-md focus-ring cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Bulk import modal ────────────────────────────────────────────────────────

function BulkImportModal({
  category,
  categoryLabel,
  onClose,
  onImported,
}: {
  category: string;
  categoryLabel: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);

  const parseEntries = (raw: string) => {
    const entries: { key: string; value: string }[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1);
      if (key) entries.push({ key, value });
    }
    return entries;
  };

  const preview = parseEntries(text);

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    try {
      await vaultRPCClient.setItems({
        updates: preview.map(({ key, value }) => ({ category, key, value })),
      });
      toastManager.success(`Imported ${preview.length} key${preview.length !== 1 ? "s" : ""} into "${categoryLabel}"`, { duration: 4000 });
      onImported();
      onClose();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-secondary border border-primary rounded-xl shadow-2xl flex flex-col gap-0 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-primary">
          <Upload className="w-4 h-4 text-accent-soft shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Bulk Import</p>
            <p className="text-2xs text-muted">Into: {categoryLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-muted hover:text-primary transition-colors rounded-md focus-ring">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Textarea */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-2xs text-muted">
            Paste <span className="font-mono">KEY=value</span> pairs, one per line. Lines starting with <span className="font-mono">#</span> are ignored.
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"API_KEY=abc123\nSECRET_TOKEN=xyz789\n# this is a comment"}
            rows={8}
            className="w-full bg-input border border-primary rounded-lg py-2 px-3 text-xs text-primary placeholder-muted font-mono resize-none focus-accent"
          />
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mx-4 mb-3 bg-input border border-primary rounded-lg overflow-hidden">
            <p className="px-3 py-1.5 text-2xs text-muted border-b border-primary">
              {preview.length} key{preview.length !== 1 ? "s" : ""} detected
            </p>
            <div className="max-h-32 overflow-y-auto">
              {preview.map(({ key }) => (
                <div key={key} className="flex items-center gap-2 px-3 py-1 border-b border-primary last:border-b-0">
                  <KeyRound className="w-3 h-3 text-muted shrink-0" />
                  <span className="text-xs font-mono text-primary truncate">{key}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-primary">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors cursor-pointer focus-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !preview.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
          >
            {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Import {preview.length > 0 ? `${preview.length} key${preview.length !== 1 ? "s" : ""}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  category,
  label,
  keys = [],
  search,
  onMutate,
}: {
  category: string;
  label: string;
  keys: string[] | undefined;
  search: string;
  onMutate: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);

  const filtered = search.trim() ? keys.filter(k => k.toLowerCase().includes(search.toLowerCase())) : keys;

  return (
    <>
      {importOpen && <BulkImportModal category={category} categoryLabel={label} onClose={() => setImportOpen(false)} onImported={onMutate} />}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</h2>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md hover:bg-hover transition-colors cursor-pointer focus-ring"
            title="Bulk import KEY=value pairs"
          >
            <Upload className="w-3 h-3" /> Import
          </button>
        </div>

        <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
              <KeyRound className="w-6 h-6 text-muted opacity-30" />
              <p className="text-xs text-muted">{search ? `No keys matching "${search}"` : "No keys stored"}</p>
            </div>
          ) : (
            filtered.map(k => <KeyRow key={k} category={category} keyName={k} onDeleted={onMutate} onSaved={onMutate} />)
          )}
          <AddKeyForm category={category} onAdded={onMutate} />
        </div>

        <p className="text-2xs text-muted text-right">
          {keys.length} key{keys.length !== 1 ? "s" : ""}
        </p>
      </div>
    </>
  );
}

// ─── Main VaultApp ────────────────────────────────────────────────────────────

export default function VaultApp() {
  const vault = useVaultKeys();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const entries = vault.data ?? {};

  const displayedCategories = activeCategory ? CATEGORIES.filter(c => c.id === activeCategory) : CATEGORIES;

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Vault"
        subtitle="Manage encrypted credentials and secrets"
        icon={<Lock className="w-4 h-4" />}
        iconGradient="from-yellow-500 to-amber-600"
      >
        <button
          type="button"
          onClick={() => vault.mutate()}
          className="p-2 text-muted hover:text-primary border border-primary rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </AppPageHeader>

      {/* Category tabs */}
      <div className="shrink-0 flex items-center gap-1 px-4 sm:px-6 pt-3 pb-0 border-b border-primary overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeCategory === null ? "text-primary border-accent" : "text-muted border-transparent hover:text-primary"
          }`}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            type="button"
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeCategory === c.id ? "text-primary border-accent" : "text-muted border-transparent hover:text-primary"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {vault.isLoading ? (
          <LoadingState message="Loading vault…" className="py-16" />
        ) : vault.error ? (
          <ErrorState title="Failed to load vault" error={vault.error} onRetry={() => void vault.mutate()} variant="page" />
        ) : (
          <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            {/* Search */}
            <input
              type="text"
              placeholder="Search keys..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-input border border-primary rounded-lg py-1.5 px-3 text-xs text-primary placeholder-muted focus-accent"
            />

            {/* Category sections */}
            {displayedCategories.map(c => (
              <CategorySection key={c.id} category={c.id} label={c.label} keys={entries[c.id]} search={search} onMutate={() => vault.mutate()} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
