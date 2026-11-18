import hljs from "highlight.js/lib/common";
import { Check, Copy, WrapText } from "lucide-react";
import { useMemo, useState } from "react";
import { useCopyToClipboard } from "../../../../hooks/useCopyToClipboard.ts";

/** Highlighted HTML for the code, or null when highlighting should be skipped. */
function highlightCode(code: string, lang: string): string | null {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    if (code.length <= 10_000) {
      // Auto-detection is O(langs × code length); skip it for very large blocks.
      return hljs.highlightAuto(code).value;
    }
  } catch {
    // Fall through to plain rendering — a highlighter failure must never lose code.
  }
  return null;
}

export default function CodeBlock({ children, className }: { children: string; className?: string }) {
  const { copy, copied } = useCopyToClipboard();
  const [wrap, setWrap] = useState(false);
  const lang = className?.replace("language-", "") ?? "";

  const html = useMemo(() => highlightCode(children, lang), [children, lang]);

  const handleCopy = async () => {
    await copy(children);
  };

  return (
    <div className="not-prose my-3 rounded-lg overflow-hidden border border-line shadow-sm">
      <div className="flex items-center justify-between px-4 py-1.5 bg-raised border-b border-line">
        <span className="text-[11px] font-mono text-muted">{lang || "code"}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setWrap(on => !on)}
            aria-pressed={wrap}
            className={`p-1 rounded transition-colors focus-ring ${wrap ? "text-accent bg-hover" : "hover:bg-hover"}`}
            title={wrap ? "Disable line wrap" : "Enable line wrap"}
            aria-label={wrap ? "Disable line wrap" : "Enable line wrap"}
          >
            <WrapText className="w-3.5 h-3.5 text-dim" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-hover transition-colors focus-ring"
            title="Copy code"
            aria-label="Copy code to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-dim" />}
          </button>
        </div>
      </div>
      <pre className={`p-4 overflow-x-auto bg-sunken m-0 ${wrap ? "whitespace-pre-wrap break-words" : ""}`}>
        {html !== null ? (
          <code className="hljs text-[13px] font-mono leading-relaxed text-fg" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className="text-[13px] font-mono leading-relaxed text-fg">{children}</code>
        )}
      </pre>
    </div>
  );
}
