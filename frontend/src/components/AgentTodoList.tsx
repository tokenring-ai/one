import type { TodoItem } from "@tokenring-ai/todo";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../lib/utils.ts";
import { useTodos } from "../rpc";

const TODO_MAX = 7;
/** When trimming an over-long list, keep at most this many completed items at the top. */
const TODO_MAX_COMPLETED = 3;

const statusRanks = {
  completed: 0,
  in_progress: 1,
  pending: 2,
  cancelled: 3,
};

const statusMarkers = {
  in_progress: ">",
  completed: "✓",
  pending: "",
  cancelled: "✗",
};

const statusClasses = {
  in_progress: "text-accent-soft",
  completed: "text-success",
  pending: "text-secondary",
  cancelled: "text-failure",
};

const contentClasses = {
  in_progress: "text-secondary",
  completed: "text-success",
  pending: "text-secondary",
  cancelled: "text-failure",
};

/**
 * Cap a sorted todo list to {@link TODO_MAX} items.
 * 1. If over the max, drop completed items from the top until ≤3 remain (or under max).
 * 2. If still over the max, drop from the bottom.
 * Returns counts of hidden items for "+N more" labels above/below.
 */
function capTodos(todos: TodoItem[]): {
  items: TodoItem[];
  moreAbove: number;
  moreBelow: number;
} {
  if (todos.length <= TODO_MAX) {
    return { items: todos, moreAbove: 0, moreBelow: 0 };
  }

  const items = [...todos];
  let moreAbove = 0;
  let moreBelow = 0;

  const completedCount = () => items.filter(t => t.status === "completed").length;

  while (items.length > TODO_MAX && completedCount() > TODO_MAX_COMPLETED && items[0]?.status === "completed") {
    items.shift();
    moreAbove += 1;
  }

  while (items.length > TODO_MAX) {
    items.pop();
    moreBelow += 1;
  }

  return { items, moreAbove, moreBelow };
}

interface AgentTodoListProps {
  agentId: string;
  /** Used for the list's accessible name. */
  agentName: string;
  /** Extra classes on the list container, for callers that need their own spacing/separator. */
  className?: string;
  /** When set, the whole list becomes a click target (e.g. to open the agent). */
  onSelect?: () => void;
  /** Below `lg`, hide the list behind a "N todos" toggle so narrow layouts stay scannable. */
  collapsibleOnMobile?: boolean;
}

/**
 * Live todo list for a single agent, capped to a handful of rows.
 * Renders nothing while the agent has no todos.
 */
export default function AgentTodoList({ agentId, agentName, className, onSelect, collapsibleOnMobile = false }: AgentTodoListProps) {
  const todosStream = useTodos(agentId);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const capped = useMemo(() => {
    if (todosStream.data?.status !== "success") {
      return { items: [] as TodoItem[], moreAbove: 0, moreBelow: 0 };
    }
    // Completed at top (green), then in-progress, then pending — original order preserved within each status.
    const todos = [...todosStream.data.todos];
    todos.sort((a, b) => statusRanks[a.status] - statusRanks[b.status]);
    return capTodos(todos);
  }, [todosStream.data]);

  const total = todosStream.data?.status === "success" ? todosStream.data.todos.length : 0;

  if (capped.items.length === 0) return null;

  const list = (
    <ul className="space-y-1" aria-label={`Todos for ${agentName}`}>
      {capped.moreAbove > 0 && <li className="text-xs text-muted leading-snug">{capped.moreAbove} more</li>}
      {capped.items.map(todo => {
        const marker = statusMarkers[todo.status];
        return (
          <li key={todo.id} className={`relative min-w-0 text-xs leading-snug ${contentClasses[todo.status]}`} title={todo.content}>
            {/* Marker hangs left of the text column so rows align with "N more". */}
            {marker ? (
              <span className={`absolute top-0 right-full mr-2 select-none font-mono ${statusClasses[todo.status]}`} aria-hidden="true">
                {marker}
              </span>
            ) : null}
            <span className="line-clamp-2">{todo.content}</span>
          </li>
        );
      })}
      {capped.moreBelow > 0 && <li className="text-xs text-muted leading-snug">{capped.moreBelow} more</li>}
    </ul>
  );

  // No aria-label here: the todo text supplies the accessible name, so this button does not
  // collide with the card's own "Open agent …" control.
  const body = onSelect ? (
    <button type="button" onClick={onSelect} className="w-full text-left cursor-pointer focus-ring rounded">
      {list}
    </button>
  ) : (
    list
  );

  return (
    <div className={className}>
      {collapsibleOnMobile ? (
        <button
          type="button"
          onClick={() => setMobileExpanded(expanded => !expanded)}
          aria-expanded={mobileExpanded}
          className="lg:hidden flex items-center gap-1 px-1 py-1.5 text-xs text-muted hover:text-primary transition-colors cursor-pointer focus-ring rounded"
        >
          {mobileExpanded ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
          {total} {total === 1 ? "todo" : "todos"}
        </button>
      ) : null}
      <div className={cn(collapsibleOnMobile && !mobileExpanded && "hidden lg:block")}>{body}</div>
    </div>
  );
}
