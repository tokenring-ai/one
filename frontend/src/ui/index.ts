/**
 * TokenRing UI kit. Apps import chrome from `@tokenring-ai/one-frontend/ui`.
 *
 * `className` is for layout (width, margin) only. New controls should use a
 * variant, not `btn-accent` or raw palette colors (emerald, amber, sky, rose).
 * Status color comes from the theme tokens.
 */

export { type ConfirmModalProps, default as ConfirmModal } from "../components/ui/ConfirmModal.tsx";
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.tsx";
export { default as EmptyState } from "../components/ui/EmptyState.tsx";
export { default as ErrorState } from "../components/ui/ErrorState.tsx";
export { default as LoadingState } from "../components/ui/LoadingState.tsx";
export { default as Dialog, type ModalShellProps as DialogProps } from "../components/ui/ModalShell.tsx";
export { toastManager } from "../components/ui/toast.tsx";
export { default as ViewHeader, type ViewHeaderProps } from "../components/ui/ViewHeader.tsx";
export { default as ViewShell, type ViewShellProps } from "../components/ui/ViewShell.tsx";
export { type BadgeProps, type BadgeTone, default as Badge } from "./badge.tsx";
export { type ButtonProps, type ButtonSize, type ButtonVariant, default as Button } from "./button.tsx";
export { type CheckboxProps, default as Checkbox } from "./checkbox.tsx";
export { controlClassName } from "./control.ts";
export { default as Field, type FieldProps } from "./field.tsx";
export { default as IconButton, type IconButtonProps } from "./icon-button.tsx";
export { default as SegmentedControl, type SegmentedControlProps, type SegmentedOption } from "./segmented-control.tsx";
export { default as Select, type SelectProps } from "./select.tsx";
export { default as Switch, type SwitchProps } from "./switch.tsx";
export { default as TextArea, type TextAreaProps } from "./text-area.tsx";
export { default as TextField, type TextFieldProps } from "./text-field.tsx";
