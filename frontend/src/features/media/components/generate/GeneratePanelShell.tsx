import type { ReactNode } from "react";

export default function GeneratePanelShell({
  title,
  subtitle,
  icon,
  gradient,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  gradient: string;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-start py-8 px-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-1">
          <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${gradient} flex items-center justify-center shadow-lg mx-auto`}>{icon}</div>
          <h2 className="text-base font-semibold text-primary mt-3">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
