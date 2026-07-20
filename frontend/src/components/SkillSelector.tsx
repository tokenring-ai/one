import formatError from "@tokenring-ai/utility/error/formatError";
import { Check, ExternalLink, Play, Search, Sparkles, X, XCircle } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { skillsRPCClient, useEnabledSkills, useSkills } from "../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";
import { toastManager } from "./ui/toast.tsx";

interface SkillSelectorProps {
  agentId: string;
  triggerVariant?: "default" | "icon";
  /** Prefill the chat input with `/skill-name ` for one-click try. */
  onTrySkill?: (skillName: string) => void;
}

export default function SkillSelector({ agentId, triggerVariant = "default", onTrySkill }: SkillSelectorProps) {
  const navigate = useNavigate();
  const skillsQuery = useSkills(agentId);
  const enabledSkills = useEnabledSkills(agentId);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const isIconTrigger = triggerVariant === "icon";

  const enabledSkillsData = enabledSkills.data?.status === "success" ? enabledSkills.data : null;
  const enabledSet = useMemo(() => new Set(enabledSkillsData?.skills || []), [enabledSkillsData?.skills]);

  const skills = skillsQuery.data?.status === "success" ? skillsQuery.data.skills : [];
  const skillCount = skills.length;
  const enabledCount = enabledSkillsData ? enabledSet.size : skills.filter(s => s.enabled).length;

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const query = searchQuery.toLowerCase();
    return skills.filter(
      skill => skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query) || skill.slug.toLowerCase().includes(query),
    );
  }, [skills, searchQuery]);

  const handleToggleSkill = useCallback(
    async (skillName: string) => {
      try {
        const isEnabled = enabledSet.has(skillName);
        if (isEnabled) {
          await skillsRPCClient.disableSkill({ agentId, name: skillName });
        } else {
          await skillsRPCClient.enableSkill({ agentId, name: skillName });
        }
        void enabledSkills.mutate();
        void skillsQuery.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [agentId, enabledSkills, enabledSet, skillsQuery],
  );

  const handleTrySkill = useCallback(
    (skillName: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      if (onTrySkill) {
        onTrySkill(skillName);
        return;
      }
      // Fallback: navigate stays on chat; parent should pass onTrySkill from ChatFooter.
      toastManager.info(`Type /${skillName} in chat to run this skill`, { duration: 3000 });
    },
    [onTrySkill],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, skillName: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        void handleToggleSkill(skillName);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev + 1;
          return next < filteredSkills.length ? next : 0;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev - 1;
          return next >= 0 ? next : filteredSkills.length - 1;
        });
      }
    },
    [handleToggleSkill, filteredSkills.length],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            isIconTrigger
              ? "flex items-center justify-center p-1.5 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring text-muted hover:text-primary"
              : "hidden md:flex items-center gap-2 px-2 py-1 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring"
          }
          aria-label={`Select skills. ${enabledCount} of ${skillCount} enabled`}
          title={`${enabledCount} of ${skillCount} skills enabled`}
        >
          <Sparkles className={isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5 text-muted group-hover:text-primary"} />
          {!isIconTrigger && (
            <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-48">
              {enabledCount}/{skillCount} enabled
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="max-h-150 w-100 overflow-hidden flex flex-col bg-secondary border-primary shadow-card" aria-label="Select agent skills">
        <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 border-b border-primary">
          <span className="text-sm flex-1 font-mono text-muted shrink-0">Skills</span>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              type="text"
              placeholder="Filter skills..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  if (searchQuery) {
                    setSearchQuery("");
                  }
                }
              }}
              className="w-full bg-input border border-primary rounded-md py-1.5 pl-9 pr-8 text-xs text-primary placeholder-muted focus-ring transition-all"
              onClick={e => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setSearchQuery("");
                }}
                className="absolute inset-y-0 right-2 flex items-center p-0.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
                aria-label="Clear search"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-1 space-y-0.5" role="listbox" aria-label="Installed skills">
          {filteredSkills.map((skill, index) => {
            const isEnabled = enabledSkillsData ? enabledSet.has(skill.name) : skill.enabled;
            const isFocused = focusedIndex === index;
            const canTry = skill.userInvocable !== false;
            return (
              <div
                key={skill.slug || skill.name}
                role="option"
                aria-selected={isEnabled}
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  void handleToggleSkill(skill.name);
                }}
                onKeyDown={e => {
                  e.stopPropagation();
                  handleKeyDown(e, skill.name);
                }}
                onFocus={() => setFocusedIndex(index)}
                className={`flex items-center cursor-pointer py-1.5 rounded-md px-3 transition-colors group focus-ring ${
                  isFocused ? "bg-hover" : "hover:bg-hover"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 ${isEnabled ? "bg-violet-500" : "bg-muted/50"}`} />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-mono leading-tight truncate ${
                      isEnabled ? "text-violet-500 dark:text-violet-400 font-medium" : "text-muted group-hover:text-primary"
                    }`}
                  >
                    /{skill.name}
                  </div>
                  {skill.description && <div className="text-2xs text-dim font-mono leading-tight truncate mt-0.5">{skill.description}</div>}
                </div>
                {canTry && (
                  <button
                    type="button"
                    title={skill.argumentHint ? `Try /${skill.name} (${skill.argumentHint})` : `Try /${skill.name}`}
                    aria-label={`Try skill ${skill.name}`}
                    onClick={e => handleTrySkill(skill.name, e)}
                    className="p-1 rounded-md text-muted hover:text-violet-500 hover:bg-violet-500/10 transition-colors focus-ring ml-1 shrink-0"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                )}
                {isEnabled ? (
                  <Check className="w-3 h-3 text-violet-500 dark:text-violet-400 ml-1.5 shrink-0" aria-label="Enabled" />
                ) : (
                  <X className="w-3 h-3 text-muted group-hover:text-primary ml-1.5 shrink-0" aria-label="Disabled" />
                )}
              </div>
            );
          })}

          {filteredSkills.length === 0 && searchQuery && (
            <div className="px-3 py-4 text-center text-xs text-muted" role="status">
              No skills found matching "{searchQuery}"
            </div>
          )}

          {skillCount === 0 && !skillsQuery.isLoading && (
            <div className="px-3 py-4 text-center text-xs text-muted space-y-2">
              <p>No skills installed</p>
              <p className="text-2xs text-dim">Download skills from the Skills app or use /skills download</p>
            </div>
          )}

          {skillsQuery.isLoading && skillCount === 0 && <div className="px-3 py-4 text-center text-xs text-muted">Loading skills…</div>}
        </div>

        <div className="border-t border-primary px-2 py-1.5 shrink-0">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              void navigate("/skills");
            }}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-mono text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
          >
            <ExternalLink className="w-3 h-3" />
            Manage skills
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
