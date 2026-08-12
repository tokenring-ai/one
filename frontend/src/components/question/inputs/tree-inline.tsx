import { getTreeNodeValue, isTreeBranch, type ParsedTreeSelectQuestion, type TreeLeaf } from "@tokenring-ai/agent/question";
import type { MaybePromise } from "bun";
import { Check, ChevronDown, ChevronRight, Send, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRefSync } from "../../../hooks/useRefSync.ts";
import { sendInteractionResponse } from "../sendInteractionResponse.ts";

interface TreeInlineProps {
  question: ParsedTreeSelectQuestion;
  agentId: string;
  requestId: string;
  interactionId?: string;
  onSubmitValue?: (value: string[] | null) => MaybePromise<void>;
  onClose: () => void;
  autoFocus?: boolean;
}

/** True when the node has no children (only leaves are selectable). */
function isLeafNode(node: TreeLeaf): boolean {
  return !isTreeBranch(node) || node.children.length === 0;
}

/** Collect every selectable leaf value under a node. */
function collectLeafValues(node: TreeLeaf): string[] {
  if (isLeafNode(node)) return [getTreeNodeValue(node)];
  if (!isTreeBranch(node)) return [];
  return node.children.flatMap(collectLeafValues);
}

/**
 * Keep only default values that exist as selectable leaves.
 * Walks into children even when a branch name collides with a leaf value.
 */
function filterSelectableDefaults(tree: TreeLeaf[], values: string[] | undefined): string[] {
  if (!values?.length) return [];

  const leafValues = new Set(tree.flatMap(collectLeafValues));
  return values.filter(value => leafValues.has(value));
}

/** Ancestor branch keys that must be expanded so `targetValue` leaves are visible. */
function findAncestorKeys(tree: TreeLeaf[], targetValue: string): string[] {
  const walk = (node: TreeLeaf, ancestors: string[]): string[] | null => {
    const value = getTreeNodeValue(node);
    if (isLeafNode(node)) {
      return value === targetValue ? ancestors : null;
    }
    if (!isTreeBranch(node)) return null;
    const nextAncestors = [...ancestors, value];
    for (const child of node.children) {
      const found = walk(child, nextAncestors);
      if (found) return found;
    }
    return null;
  };

  for (const root of tree) {
    const found = walk(root, []);
    if (found) return found;
  }
  return [];
}

const CompactTreeNode: React.FC<{
  node: TreeLeaf;
  depth: number;
  selected: Set<string>;
  onToggle: (value: string) => void;
  onExpand: (nodeValue: string) => void;
  isExpanded: boolean;
  canSelect: (value: string) => boolean;
  focusedValue: string | null;
  isFocused: boolean;
  onFocus: (value: string) => void;
  onNavigate: (direction: "up" | "down" | "home" | "end") => void;
  isExpandedChild: (value: string) => boolean;
}> = ({ node, depth, selected, onToggle, onExpand, isExpanded, canSelect, focusedValue, isFocused, onFocus, onNavigate, isExpandedChild }) => {
  const value = getTreeNodeValue(node);
  const isSelected = selected.has(value);
  const hasChildren = isTreeBranch(node) && node.children.length > 0;
  // Only leaf nodes are selectable. Branches are for navigation/expansion only.
  const isSelectableNode = !hasChildren;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onExpand(value);
    } else if (canSelect(value)) {
      onToggle(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (hasChildren) {
        onExpand(value);
      } else if (canSelect(value)) {
        onToggle(value);
      }
    } else if (e.key === "ArrowRight" && !isExpanded && hasChildren) {
      e.preventDefault();
      onExpand(value);
    } else if (e.key === "ArrowLeft" && isExpanded) {
      e.preventDefault();
      onExpand(value);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onNavigate("down");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onNavigate("up");
    } else if (e.key === "Home") {
      e.preventDefault();
      onNavigate("home");
    } else if (e.key === "End") {
      e.preventDefault();
      onNavigate("end");
    }
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand(value);
  };

  const handleFocus = () => {
    onFocus(value);
  };

  return (
    <div className="flex flex-col">
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelectableNode ? isSelected : undefined}
        tabIndex={0}
        data-tree-value={value}
        data-tree-selectable={isSelectableNode ? "true" : undefined}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors outline-none focus-ring ${
          isSelected ? "bg-accent/20" : isFocused ? "bg-accent/10" : "hover:bg-hover"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {hasChildren ? (
          <span onClick={handleExpandClick} className="text-muted hover:text-accent transition-colors" aria-hidden="true">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        ) : (
          <span className="w-3.5" aria-hidden="true"></span>
        )}
        <span className={`text-sm ${isSelected || isFocused ? "text-accent font-medium" : "text-primary"}`}>{node.name}</span>
        {isSelectableNode && isSelected && <Check className="w-3.5 h-3.5 text-accent ml-auto" aria-hidden="true" />}
      </div>
      {isExpanded && hasChildren && (
        <div role="group">
          {node.children.map((child: TreeLeaf) => {
            const childValue = getTreeNodeValue(child);
            return (
              <CompactTreeNode
                key={childValue}
                node={child}
                depth={depth + 1}
                selected={selected}
                onToggle={onToggle}
                onExpand={onExpand}
                isExpanded={isExpandedChild(childValue)}
                canSelect={canSelect}
                focusedValue={focusedValue}
                isFocused={focusedValue === childValue}
                onFocus={onFocus}
                onNavigate={onNavigate}
                isExpandedChild={isExpandedChild}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function TreeInlineQuestion({ question, agentId, requestId, interactionId, onSubmitValue, onClose, autoFocus = true }: TreeInlineProps) {
  const { minimumSelections, maximumSelections, tree, defaultValue } = question;
  const multiple = maximumSelections !== 1;

  const initialSelected = useMemo(() => filterSelectableDefaults(tree, defaultValue), [tree, defaultValue]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  // Keep a ref so submit always sees the latest selection (avoids stale closure if defaults were set on mount)
  const selectedRef = useRefSync(selected);

  // Expand first root plus every ancestor of pre-selected leaves so defaults are visible and interactable
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    if (tree[0]) {
      expanded.add(getTreeNodeValue(tree[0]));
    }
    for (const value of initialSelected) {
      for (const ancestor of findAncestorKeys(tree, value)) {
        expanded.add(ancestor);
      }
    }
    return expanded;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const focusedValueRef = useRefSync(focusedValue);
  const containerRef = useRef<HTMLDivElement>(null);

  // Seed selection from defaults once. Avoid re-running when parent re-creates the question object.
  const didSeedDefaultsRef = useRef(initialSelected.length > 0);
  useEffect(() => {
    if (didSeedDefaultsRef.current) return;
    const defaults = filterSelectableDefaults(tree, defaultValue);
    if (defaults.length === 0) return;

    didSeedDefaultsRef.current = true;
    const next = new Set(defaults);
    selectedRef.current = next;
    setSelected(next);

    setExpandedNodes(prev => {
      const expanded = new Set(prev);
      for (const value of defaults) {
        for (const ancestor of findAncestorKeys(tree, value)) {
          expanded.add(ancestor);
        }
      }
      return expanded;
    });
  }, [tree, defaultValue]);

  // Auto-focus on mount: prefer a pre-selected leaf, else the first focusable row.
  // For single-select, if a selectable leaf receives initial focus and nothing is selected yet,
  // treat it as selected so Submit works without an extra click (matches CLI Enter-on-focus).
  useEffect(() => {
    if (!autoFocus || !containerRef.current) return;

    containerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const preferredValue = initialSelected[0];
    const preferredEl = preferredValue ? (containerRef.current.querySelector(`[data-tree-value="${CSS.escape(preferredValue)}"]`) as HTMLElement | null) : null;
    const target = preferredEl ?? (containerRef.current.querySelector("[data-tree-value]") as HTMLElement | null);

    if (!target) return;

    target.focus();
    const value = target.getAttribute("data-tree-value");
    if (!value) return;

    setFocusedValue(value);

    const isSelectableLeaf = target.getAttribute("data-tree-selectable") === "true";
    if (!multiple && isSelectableLeaf && selectedRef.current.size === 0) {
      const next = new Set([value]);
      selectedRef.current = next;
      setSelected(next);
    }
  }, [autoFocus, initialSelected, multiple]);

  const canSelect = useCallback(
    (value: string): boolean => {
      if (!multiple) return true;
      const current = selectedRef.current;
      const isCurrentlySelected = current.has(value);
      if (isCurrentlySelected) {
        return minimumSelections === undefined || current.size > minimumSelections;
      }
      return maximumSelections === undefined || current.size < maximumSelections;
    },
    [multiple, minimumSelections, maximumSelections],
  );

  const handleToggle = useCallback(
    (value: string) => {
      if (!canSelect(value)) return;

      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(value)) {
          // Single-select (radio): re-clicking the selected item keeps it selected
          // when at least one selection is required (or single-select in general)
          if (!multiple) {
            return prev;
          }
          next.delete(value);
        } else {
          if (!multiple) next.clear();
          next.add(value);
        }
        selectedRef.current = next;
        return next;
      });
    },
    [canSelect, multiple],
  );

  const toggleExpand = (nodeValue: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeValue)) {
        next.delete(nodeValue);
      } else {
        next.add(nodeValue);
      }
      return next;
    });
  };

  const handleNavigate = (direction: "up" | "down" | "home" | "end") => {
    const allFocusable = Array.from(containerRef.current?.querySelectorAll("[data-tree-value]") || []) as HTMLElement[];

    if (allFocusable.length === 0) return;

    const currentIndex = allFocusable.findIndex(el => el.getAttribute("data-tree-value") === focusedValue);
    let newIndex: number;

    switch (direction) {
      case "up":
        newIndex = currentIndex > 0 ? currentIndex - 1 : allFocusable.length - 1;
        break;
      case "down":
        newIndex = currentIndex < allFocusable.length - 1 ? currentIndex + 1 : 0;
        break;
      case "home":
        newIndex = 0;
        break;
      case "end":
        newIndex = allFocusable.length - 1;
        break;
      default:
        return;
    }

    const nextElement = allFocusable[newIndex];
    if (nextElement) {
      nextElement.focus();
      const value = nextElement.getAttribute("data-tree-value");
      if (value) {
        setFocusedValue(value);
        nextElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  };

  const handleNodeFocus = (value: string) => {
    setFocusedValue(value);
  };

  /** Resolve values to submit: current selection, or focused leaf for single-select when nothing checked. */
  const resolveSubmitValues = (): string[] => {
    const current = selectedRef.current;
    if (current.size > 0) {
      return Array.from(current);
    }

    // Single-select: focused leaf counts as the choice (matches CLI Enter-on-focused-leaf behavior).
    // This covers the case where the initial focused item looks selected but was never toggled.
    if (!multiple) {
      const focused = focusedValueRef.current;
      if (focused) {
        const leafValues = new Set(tree.flatMap(collectLeafValues));
        if (leafValues.has(focused)) {
          return [focused];
        }
      }
    }

    return [];
  };

  const isSelectionValid = (values: string[]) => {
    const count = values.length;
    if (minimumSelections !== undefined && count < minimumSelections) return false;
    if (maximumSelections !== undefined && count > maximumSelections) return false;
    return true;
  };

  const handleSubmit = async () => {
    const values = resolveSubmitValues();
    if (!isSelectionValid(values)) return;

    // Persist resolved single-select focus into visible selection before sending
    if (values.length > 0 && selectedRef.current.size === 0) {
      const next = new Set(values);
      selectedRef.current = next;
      setSelected(next);
    }

    setIsSubmitting(true);
    // Multi-select: always send the array (empty means "none selected"). Cancel is the Cancel button.
    // Single-select: send the chosen value(s); empty should not happen when valid.
    const result = multiple ? values : values.length > 0 ? values : null;

    if (onSubmitValue) {
      await onSubmitValue(result);
    } else if (interactionId) {
      await sendInteractionResponse({
        agentId,
        requestId,
        interactionId,
        result,
      });
    }
    onClose();
  };

  const handleCancel = async () => {
    if (onSubmitValue) {
      await onSubmitValue(null);
    } else if (interactionId) {
      await sendInteractionResponse({
        agentId,
        requestId,
        interactionId,
        result: null,
      });
    }
    onClose();
  };

  // For validity display, include the single-select focus fallback so Submit enables when a leaf is focused
  const effectiveValues = resolveSubmitValues();
  const selectionCount = effectiveValues.length;
  const isValid = isSelectionValid(effectiveValues);

  return (
    <div ref={containerRef} className="p-4 space-y-3">
      <div
        role="tree"
        aria-label="Select from tree"
        className="max-h-75 overflow-y-auto custom-scrollbar border border-primary rounded-lg bg-secondary shadow-md"
      >
        {tree.map(root => {
          const rootValue = getTreeNodeValue(root);
          return (
            <CompactTreeNode
              key={rootValue}
              node={root}
              depth={0}
              selected={selected}
              onToggle={handleToggle}
              onExpand={toggleExpand}
              isExpanded={expandedNodes.has(rootValue)}
              canSelect={canSelect}
              focusedValue={focusedValue}
              isFocused={focusedValue === rootValue}
              onFocus={handleNodeFocus}
              onNavigate={handleNavigate}
              isExpandedChild={(value: string) => expandedNodes.has(value)}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs ${isValid ? "text-primary" : "text-error"}`} aria-live="polite">
            {selectionCount} selected
          </span>
          {(minimumSelections !== undefined || maximumSelections !== undefined) && (
            <span className="text-xs text-muted">
              {minimumSelections !== undefined && `min ${minimumSelections}`}
              {minimumSelections !== undefined && maximumSelections !== undefined && " · "}
              {maximumSelections !== undefined && `max ${maximumSelections}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 p-1.5 rounded-md text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 focus-ring"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !isValid}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
          >
            {isSubmitting ? "Sending..." : "Submit"}
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
