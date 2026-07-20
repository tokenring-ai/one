import { getTreeNodeValue, isTreeBranch, type ParsedTreeSelectQuestion, type TreeLeaf } from "@tokenring-ai/agent/question";
import type { MaybePromise } from "bun";
import { Check, ChevronDown, ChevronRight, Send, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
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
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors outline-none focus-ring ${
          isFocused ? "bg-accent/10" : ""
        } ${isSelected && !isFocused ? "bg-accent/20" : ""} ${!isSelected && !isFocused ? "hover:bg-hover" : ""}`}
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
        <span className={`text-sm ${isFocused ? "text-accent font-medium" : isSelected ? "text-accent font-medium" : "text-primary"}`}>{node.name}</span>
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
  // Helper to check if a node is a leaf (not a branch)
  const isLeafNode = (node: TreeLeaf): boolean => !isTreeBranch(node) || node.children.length === 0;

  // Filter default values to only include leaf nodes
  const filterSelectableDefaults = (values: string[]): string[] => {
    const isValueInTree = (value: string): boolean => {
      const checkNode = (node: TreeLeaf): boolean => {
        if (getTreeNodeValue(node) === value) return isLeafNode(node);
        if (isTreeBranch(node)) return node.children.some(checkNode);
        return false;
      };
      return question.tree.some(checkNode);
    };
    return values.filter(isValueInTree);
  };

  const [selected, setSelected] = useState<Set<string>>(new Set(filterSelectableDefaults(question.defaultValue)));

  // Initialize with the first root node expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    if (question.tree[0]) {
      return new Set([getTreeNodeValue(question.tree[0])]);
    }
    return new Set();
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { minimumSelections, maximumSelections } = question;
  const multiple = maximumSelections !== 1;

  // Auto-focus on mount and scroll into view
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const firstFocusable = containerRef.current.querySelector("[data-tree-value]") as HTMLElement | null;
      if (firstFocusable) {
        firstFocusable.focus();
        const value = firstFocusable.getAttribute("data-tree-value");
        if (value) setFocusedValue(value);
      }
    }
  }, [autoFocus]);

  const canSelect = (value: string): boolean => {
    if (!multiple) return true;
    const isCurrentlySelected = selected.has(value);
    if (isCurrentlySelected) {
      return minimumSelections === undefined || selected.size > minimumSelections;
    }
    return maximumSelections === undefined || selected.size < maximumSelections;
  };

  const handleToggle = (value: string) => {
    if (!canSelect(value)) return;

    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (!multiple) next.clear();
        next.add(value);
      }
      return next;
    });
  };

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

  const isSelectionValid = () => {
    const count = selected.size;
    if (minimumSelections !== undefined && count < minimumSelections) return false;
    if (maximumSelections !== undefined && count > maximumSelections) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!isSelectionValid()) return;
    setIsSubmitting(true);
    const values = Array.from(selected);
    const result = values.length > 0 ? values : null;
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

  const selectionCount = selected.size;
  const isValid = isSelectionValid();

  return (
    <div ref={containerRef} className="p-4 space-y-3">
      <div
        role="tree"
        aria-label="Select from tree"
        className="max-h-75 overflow-y-auto custom-scrollbar border border-primary rounded-lg bg-secondary shadow-md"
      >
        {question.tree.map(root => {
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
          <span className={`text-2xs ${isValid ? "text-primary" : "text-error"}`} aria-live="polite">
            {selectionCount} selected
          </span>
          {(minimumSelections !== undefined || maximumSelections !== undefined) && (
            <span className="text-2xs text-muted">
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
            onClick={handleSubmit}
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
