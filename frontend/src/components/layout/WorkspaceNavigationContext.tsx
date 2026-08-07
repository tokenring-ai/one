import { createContext, type ReactNode, useContext } from "react";

export interface WorkspaceNavigationContextValue {
  /** Collapse the desktop navigation pane. */
  collapseDesktopNavigation: () => void;
  /** Accessible label for the navigation pane (used by the contract control). */
  navigationLabel: string;
}

const WorkspaceNavigationContext = createContext<WorkspaceNavigationContextValue | null>(null);

export function WorkspaceNavigationProvider({ value, children }: { value: WorkspaceNavigationContextValue; children: ReactNode }) {
  return <WorkspaceNavigationContext.Provider value={value}>{children}</WorkspaceNavigationContext.Provider>;
}

/** Returns workspace navigation controls when rendered inside WorkspaceShell; otherwise null. */
export function useWorkspaceNavigation(): WorkspaceNavigationContextValue | null {
  return useContext(WorkspaceNavigationContext);
}
