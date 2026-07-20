import { motion } from "framer-motion";
import type React from "react";
import { useNavigate } from "react-router-dom";

export interface AppCardDef {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  badge?: string;
}

interface AppCardProps {
  app: AppCardDef;
}

export default function AppCard({ app }: AppCardProps) {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate(app.path)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="group flex flex-col items-center gap-3 p-4 bg-secondary border border-primary rounded-xl hover:border-accent/40 hover:shadow-card transition-all cursor-pointer focus-ring text-center w-full"
      aria-label={`Open ${app.label}`}
    >
      {/* Icon badge */}
      <div
        className={`relative w-14 h-14 rounded-xl bg-linear-to-br ${app.gradient} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow`}
      >
        <div className="text-white [&>svg]:w-7 [&>svg]:h-7">{app.icon}</div>
        {app.badge && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-amber-500 text-white text-2xs font-bold rounded-full flex items-center justify-center shadow-sm">
            {app.badge}
          </span>
        )}
      </div>

      {/* Label */}
      <div>
        <div className="text-sm font-semibold text-primary group-hover:text-accent transition-colors">{app.label}</div>
        <div className="text-2xs text-muted mt-0.5 line-clamp-2 leading-relaxed">{app.description}</div>
      </div>
    </motion.button>
  );
}
