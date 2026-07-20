import { Loader2, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";

export default function GenerateButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 py-3 bg-linear-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed focus-ring shadow-button-primary"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Generating...
        </>
      ) : (
        <>
          <WandSparkles className="w-4 h-4" /> {children}
        </>
      )}
    </button>
  );
}
