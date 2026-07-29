import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/utils.ts";
import type { EmailBoxRecord } from "../types.ts";
import { getBoxPresentation } from "../utils.ts";

export default function MailboxDropdown({ boxes, selected, onSelect }: { boxes: EmailBoxRecord[]; selected: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const currentBox = boxes.find(b => b.id === selected) ?? { id: selected, name: selected };
  const { icon: Icon, color, label } = getBoxPresentation(currentBox);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer"
      >
        <Icon className={cn("w-4 h-4 shrink-0", color)} />
        <span className="text-sm font-medium text-primary">{label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-52 bg-secondary border border-primary rounded-xl shadow-card z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-primary">
              <p className="text-2xs font-semibold text-muted uppercase tracking-wider">Mailboxes</p>
            </div>
            <nav className="py-1">
              {boxes.map(box => {
                const { label: boxLabel, icon: BoxIcon, color: boxColor } = getBoxPresentation(box);
                return (
                  <button
                    type="button"
                    key={box.id}
                    onClick={() => {
                      onSelect(box.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-hover transition-colors cursor-pointer text-left focus-ring",
                      selected === box.id ? "text-primary font-medium bg-active" : "text-muted hover:text-primary",
                    )}
                  >
                    <BoxIcon className={cn("w-4 h-4 shrink-0", selected === box.id ? boxColor : "text-muted")} />
                    {boxLabel}
                    {selected === box.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
