import { motion } from "framer-motion";
import type React from "react";
import { useId } from "react";
import { useNavigate } from "react-router-dom";

export interface DashboardCardDef {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  badge?: string;
}

interface DashboardCardProps {
  dashboard: DashboardCardDef;
}

/** Launcher tile for one dashboard. */
export default function DashboardCard({ dashboard }: DashboardCardProps) {
  const navigate = useNavigate();
  const labelId = useId();
  const descriptionId = useId();
  const badgeId = useId();

  return (
    <motion.button
      type="button"
      onClick={() => navigate(dashboard.path)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="group flex flex-col items-center gap-3 p-4 bg-secondary border border-primary rounded-xl hover:border-accent/40 hover:shadow-card transition-all cursor-pointer focus-ring text-center w-full"
      // Name from the visible label; description and badge stay announced as the description.
      aria-labelledby={labelId}
      aria-describedby={dashboard.badge ? `${descriptionId} ${badgeId}` : descriptionId}
    >
      {/* Icon badge */}
      <div
        className={`relative w-14 h-14 rounded-xl bg-linear-to-br ${dashboard.gradient} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}
      >
        <div className="text-white [&>svg]:w-7 [&>svg]:h-7">{dashboard.icon}</div>
        {dashboard.badge && (
          <span
            id={badgeId}
            className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-sm"
          >
            {dashboard.badge}
          </span>
        )}
      </div>

      {/* Label */}
      <div>
        <div id={labelId} className="text-sm font-semibold text-primary group-hover:text-accent-soft transition-colors">
          {dashboard.label}
        </div>
        <div id={descriptionId} className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">
          {dashboard.description}
        </div>
      </div>
    </motion.button>
  );
}
