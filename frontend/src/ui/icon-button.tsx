import { cn } from "../lib/utils.ts";
import Button, { type ButtonProps } from "./button.tsx";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "busyLabel" | "icon"> {
  /** Accessible name. Also used as the tooltip. */
  label: string;
  icon: NonNullable<ButtonProps["icon"]>;
}

/** Square button with no visible text. `label` is required. */
export default function IconButton({ label, size = "sm", className, ...rest }: IconButtonProps) {
  return <Button {...rest} size={size} aria-label={label} title={label} className={cn(size === "md" ? "w-9 px-0" : "w-7 px-0", className)} />;
}
