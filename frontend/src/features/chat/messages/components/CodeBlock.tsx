import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="not-prose my-3 rounded-lg overflow-hidden border border-stone-200 dark:border-neutral-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-1.5 bg-stone-100 dark:bg-neutral-800 border-b border-stone-200 dark:border-neutral-700">
        <span className="text-[11px] font-mono text-stone-500 dark:text-neutral-400">{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded hover:bg-stone-200 dark:hover:bg-neutral-700 transition-colors focus-ring"
          title="Copy code"
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-stone-400 dark:text-neutral-500" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto bg-stone-50 dark:bg-neutral-900 m-0">
        <code className="text-[13px] font-mono leading-relaxed text-stone-800 dark:text-neutral-200">{children}</code>
      </pre>
    </div>
  );
}
