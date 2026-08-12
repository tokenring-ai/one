import { type ButtonHTMLAttributes, createContext, type MouseEvent, type ReactNode, useCallback, useContext, useEffect, useId, useState } from "react";
import { cn } from "../../lib/utils.ts";

interface InlineDropdownContextValue {
  close: () => void;
  closeOnSelect: boolean;
}

const InlineDropdownContext = createContext<InlineDropdownContextValue | null>(null);

/** Access close() from within InlineDropdown children (e.g. custom items). */
export function useInlineDropdown(): InlineDropdownContextValue {
  const ctx = useContext(InlineDropdownContext);
  if (!ctx) {
    throw new Error("useInlineDropdown must be used within an InlineDropdown");
  }
  return ctx;
}

export interface InlineDropdownProps {
  /** Content of the trigger button (or a render fn that receives open state) */
  trigger: ReactNode | ((open: boolean) => ReactNode);
  /** Menu panel content (typically a list of InlineDropdownItem) */
  children: ReactNode;
  /** Header text displayed above the menu items */
  header?: string;
  /** Menu width class (default: "w-48") */
  width?: string;
  /** Horizontal alignment: "left" or "right" (default: "left") */
  align?: "left" | "right";
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Additional className for the menu panel */
  panelClassName?: string;
  /** Additional className for the header section */
  headerClassName?: string;
  /** Whether the dropdown is currently open (controlled mode) */
  open?: boolean;
  /** Called when the open state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** Whether to close on item click via InlineDropdownItem (default: false) */
  closeOnSelect?: boolean;
  /** z-index for the backdrop (default: 40) */
  backdropZIndex?: number;
  /** z-index for the panel (default: 50) */
  panelZIndex?: number;
  /** Disable the trigger button */
  disabled?: boolean;
  /** Extra classes for the outer relative wrapper */
  className?: string;
  /** Accessibility label for the trigger */
  "aria-label"?: string;
}

/**
 * Lightweight non-Radix dropdown: trigger button, fixed backdrop, absolutely
 * positioned panel with optional header. Prefer for simple selectors; use
 * dropdown-menu.tsx when submenus / focus trapping are needed.
 */
export default function InlineDropdown({
  trigger,
  children,
  header,
  width = "w-48",
  align = "left",
  triggerClassName,
  panelClassName,
  headerClassName,
  open: controlledOpen,
  onOpenChange,
  closeOnSelect = false,
  backdropZIndex = 40,
  panelZIndex = 50,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: InlineDropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const headerId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, setOpen]);

  const triggerContent = typeof trigger === "function" ? trigger(isOpen) : trigger;

  return (
    <InlineDropdownContext.Provider value={{ close, closeOnSelect }}>
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen(!isOpen)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={ariaLabel}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary transition-all focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            triggerClassName,
          )}
        >
          {triggerContent}
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0" style={{ zIndex: backdropZIndex }} onClick={close} aria-hidden />
            <div
              role="menu"
              aria-labelledby={header ? headerId : undefined}
              className={cn(
                "absolute top-full mt-1 bg-secondary border border-primary rounded-xl shadow-card overflow-hidden",
                width,
                align === "right" ? "right-0" : "left-0",
                panelClassName,
              )}
              style={{ zIndex: panelZIndex }}
            >
              {header && (
                <div className={cn("px-3 py-2 border-b border-primary", headerClassName)}>
                  <p id={headerId} className="text-xs font-semibold text-muted uppercase tracking-wider">
                    {header}
                  </p>
                </div>
              )}
              {children}
            </div>
          </>
        )}
      </div>
    </InlineDropdownContext.Provider>
  );
}

export interface InlineDropdownItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Whether this item is the active/selected one */
  active?: boolean;
  /** Leading icon or indicator */
  leading?: ReactNode;
  /** Trailing indicator (e.g. custom active mark). When omitted and active, a default active dot is shown. */
  trailing?: ReactNode;
  /** Active indicator color class (default: "bg-red-500") */
  activeColor?: string;
  children: ReactNode;
}

/**
 * Full-width menu item with hover/focus styles and optional active indicator.
 * Honors closeOnSelect from the parent InlineDropdown.
 */
export function InlineDropdownItem({
  active = false,
  onClick,
  leading,
  trailing,
  activeColor = "bg-red-500",
  className,
  children,
  ...rest
}: InlineDropdownItemProps) {
  const ctx = useContext(InlineDropdownContext);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (ctx?.closeOnSelect) ctx.close();
  };

  const showDefaultActiveDot = active && trailing === undefined;

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-hover transition-colors cursor-pointer text-left focus-ring",
        active ? "text-primary font-medium" : "text-muted hover:text-primary",
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
      {showDefaultActiveDot && <span className={cn("ml-auto w-1.5 h-1.5 rounded-full shrink-0", activeColor)} />}
    </button>
  );
}
