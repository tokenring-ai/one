import type { ReactNode } from "react";

export default function ActionButton({
  children,
  icon,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const cls = primary
    ? "flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed focus-ring shadow-button-primary"
    : "flex items-center gap-2 px-3 py-2 border border-primary text-sm text-secondary hover:text-primary hover:bg-hover disabled:opacity-50 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed focus-ring";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {icon}
      {children}
    </button>
  );
}
