import { ChevronDown } from "lucide-react";
import InlineDropdown, { InlineDropdownItem } from "../../../components/ui/InlineDropdown.tsx";
import { cn } from "../../../lib/utils.ts";
import type { EmailBoxRecord } from "../types.ts";
import { getBoxPresentation } from "../utils.ts";

export default function MailboxDropdown({ boxes, selected, onSelect }: { boxes: EmailBoxRecord[]; selected: string; onSelect: (id: string) => void }) {
  const currentBox = boxes.find(b => b.id === selected) ?? { id: selected, name: selected };
  const { icon: Icon, color, label } = getBoxPresentation(currentBox);

  return (
    <InlineDropdown
      header="Mailboxes"
      width="w-52"
      align="left"
      closeOnSelect
      triggerClassName="gap-2 bg-transparent border-transparent hover:bg-hover text-primary"
      trigger={open => (
        <>
          <Icon className={cn("w-4 h-4 shrink-0", color)} />
          <span className="text-sm font-medium text-primary">{label}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted transition-transform", open && "rotate-180")} />
        </>
      )}
    >
      <nav className="py-1">
        {boxes.map(box => {
          const { label: boxLabel, icon: BoxIcon, color: boxColor } = getBoxPresentation(box);
          const isSelected = selected === box.id;
          return (
            <InlineDropdownItem
              key={box.id}
              active={isSelected}
              onClick={() => onSelect(box.id)}
              className={cn("gap-2.5", isSelected && "bg-active")}
              leading={<BoxIcon className={cn("w-4 h-4 shrink-0", isSelected ? boxColor : "text-muted")} />}
            >
              {boxLabel}
            </InlineDropdownItem>
          );
        })}
      </nav>
    </InlineDropdown>
  );
}
