import { cn } from "../../lib/utils.ts";

export type FilterTabOption<T extends string = string> = {
  id: T;
  label: string;
  count?: number;
};

type FilterTabsProps<T extends string> = {
  tabs: FilterTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  activeCountClassName?: string;
  inactiveCountClassName?: string;
  showZeroCounts?: boolean;
};

export default function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  tabClassName,
  activeTabClassName = "border-accent text-primary",
  inactiveTabClassName = "border-transparent text-muted hover:text-primary",
  activeCountClassName = "bg-accent-muted text-accent",
  inactiveCountClassName = "bg-tertiary text-muted",
  showZeroCounts = false,
}: FilterTabsProps<T>) {
  return (
    <div className={cn("flex border-b border-primary shrink-0", className)}>
      {tabs.map(tab => {
        const isActive = value === tab.id;
        const shouldShowCount = tab.count !== undefined && (showZeroCounts || tab.count > 0);

        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer focus-ring -mb-px",
              isActive ? activeTabClassName : inactiveTabClassName,
              tabClassName,
            )}
          >
            {tab.label}
            {shouldShowCount && (
              <span className={cn("text-2xs px-1.5 py-0.5 rounded-full font-mono", isActive ? activeCountClassName : inactiveCountClassName)}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
