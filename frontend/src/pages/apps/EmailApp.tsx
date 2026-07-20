import type { EmailMessage } from "@tokenring-ai/email";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Clock,
  FileText,
  Globe,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatPanel from "../../components/chat/ChatPanel.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { useLazyAgent } from "../../hooks/useLazyAgent.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, emailRPCClient, useEmailBoxes, useEmailMessage, useEmailMessages, useEmailProviders, useEmailSearch } from "../../rpc.ts";

const BOX_META = {
  inbox: { icon: Inbox, color: "text-blue-400" },
  starred: { icon: Star, color: "text-amber-400" },
  sent: { icon: Send, color: "text-green-400" },
  drafts: { icon: FileText, color: "text-purple-400" },
  archive: { icon: Archive, color: "text-muted" },
  trash: { icon: Trash2, color: "text-red-400" },
  spam: { icon: AlertCircle, color: "text-amber-500" },
} as const;

type EmailBoxRecord = { id: string; name: string };
type MessageFilter = "all" | "read" | "unread";

const MESSAGE_FILTERS: FilterTabOption<MessageFilter>[] = [
  { id: "all", label: "All" },
  { id: "read", label: "Read" },
  { id: "unread", label: "Unread" },
];

function senderName(msg: EmailMessage): string {
  return msg.from.name || msg.from.email;
}

function getBoxPresentation(box: EmailBoxRecord) {
  const normalized = box.id.toLowerCase();
  const meta = normalized in BOX_META ? BOX_META[normalized as keyof typeof BOX_META] : { icon: Mail, color: "text-muted" };

  return {
    ...meta,
    label: box.name,
  };
}

function ProviderSelector({
  provider,
  availableProviders,
  loading,
  onProviderChange,
}: {
  provider: string | null;
  availableProviders: string[];
  loading: boolean;
  onProviderChange: (p: string) => void | Promise<void>;
}) {
  const [changing, setChanging] = useState(false);
  const [open, setOpen] = useState(false);

  if (loading && availableProviders.length === 0) {
    return (
      <span className="text-2xs text-muted flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading providers
      </span>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <span className="text-2xs text-muted flex items-center gap-1">
        <WifiOff className="w-3 h-3" /> No providers configured
      </span>
    );
  }

  const switchProvider = async (name: string) => {
    setChanging(true);
    setOpen(false);
    try {
      await onProviderChange(name);
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={changing}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:border-red-500/40 transition-all focus-ring cursor-pointer disabled:opacity-50"
      >
        <Globe className="w-3 h-3" />
        <span className="font-medium text-primary max-w-32 truncate">{provider ?? "No provider"}</span>
        {changing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-48 bg-secondary border border-primary rounded-xl shadow-card z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-primary">
              <p className="text-2xs font-semibold text-muted uppercase tracking-wider">Switch Provider</p>
            </div>
            {availableProviders.map(p => (
              <button
                type="button"
                key={p}
                onClick={() => switchProvider(p)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-hover transition-colors cursor-pointer text-left focus-ring ${p === provider ? "text-red-500 font-medium" : "text-primary"}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p === provider ? "bg-red-500" : "bg-transparent"}`} />
                {p}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MailboxDropdown({ boxes, selected, onSelect }: { boxes: EmailBoxRecord[]; selected: string; onSelect: (id: string) => void }) {
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

function MessageListItem({ msg, selected, onClick }: { msg: EmailMessage; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex flex-col gap-1 px-3 py-3 text-left border-b border-primary hover:bg-hover transition-colors focus-ring cursor-pointer border-l-2",
        selected ? "bg-active border-l-red-500" : "border-l-transparent",
      )}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs truncate flex-1 min-w-0", msg.isRead ? "text-muted" : "text-primary font-semibold")}>{senderName(msg)}</span>
        <span className="text-2xs text-muted shrink-0">{formatDate(msg.receivedAt)}</span>
      </div>
      <span className={cn("text-xs truncate", msg.isRead ? "text-muted" : "text-secondary font-medium")}>{msg.subject || "(no subject)"}</span>
      {msg.snippet && <span className="text-2xs text-muted truncate">{msg.snippet}</span>}
      {!msg.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute right-3 top-3" />}
    </button>
  );
}

function MessageViewer({ provider, messageId, onReply }: { provider: string; messageId: string; onReply: (cmd: string) => void }) {
  const { data, isLoading, error } = useEmailMessage(provider, messageId);
  const msg = data?.email;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted animate-spin" />
      </div>
    );
  }

  if (error || !msg) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted p-6 text-center">
        <AlertCircle className="w-8 h-8 opacity-30" />
        <p className="text-sm">Could not load message.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-primary space-y-3">
        <h2 className="text-base font-semibold text-primary leading-tight">{msg.subject || "(no subject)"}</h2>
        <div className="space-y-1 text-xs text-muted">
          <div className="flex gap-2">
            <span className="font-medium text-secondary w-8 shrink-0">From</span>
            <span>{msg.from.name ? `${msg.from.name} <${msg.from.email}>` : msg.from.email}</span>
          </div>
          {msg.to.length > 0 && (
            <div className="flex gap-2">
              <span className="font-medium text-secondary w-8 shrink-0">To</span>
              <span className="truncate">{msg.to.map(a => a.name || a.email).join(", ")}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="font-medium text-secondary w-8 shrink-0">Date</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(msg.receivedAt).toLocaleString()}
            </span>
          </div>
        </div>
        {msg.labels && msg.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.labels.map(l => (
              <span key={l} className="px-2 py-0.5 bg-tertiary border border-primary rounded-full text-2xs text-muted">
                {l}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => onReply(`Reply to the email from ${senderName(msg)} with subject "${msg.subject}"`)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
        >
          <Reply className="w-3.5 h-3.5" /> Reply with AI
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        {msg.htmlBody ? (
          <iframe srcDoc={msg.htmlBody} className="w-full h-full border-0" sandbox="allow-same-origin" title="Email content" />
        ) : msg.textBody ? (
          <pre className="text-xs text-primary whitespace-pre-wrap font-sans leading-relaxed">{msg.textBody}</pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
            <Mail className="w-6 h-6 opacity-30" />
            <p className="text-sm">No body content.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageListPane({
  provider,
  box,
  selectedId,
  onSelect,
  messageFilter,
  onMessageFilterChange,
  searchQuery,
}: {
  provider: string | null;
  box: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  messageFilter: MessageFilter;
  onMessageFilterChange: (filter: MessageFilter) => void;
  searchQuery: string | null;
}) {
  const listing = useEmailMessages(searchQuery ? undefined : (provider ?? undefined), { box, limit: 50 });
  const search = useEmailSearch(provider ?? undefined, searchQuery !== null ? searchQuery : undefined, { box, limit: 50 });
  const result = searchQuery ? search : listing;
  const messages = (result.data?.messages ?? []) as EmailMessage[];
  const filteredMessages = useMemo(
    () =>
      messages.filter(msg => {
        if (messageFilter === "read") return msg.isRead;
        if (messageFilter === "unread") return !msg.isRead;
        return true;
      }),
    [messageFilter, messages],
  );
  const countLabel = useMemo(() => {
    if (!result.data) return "";
    if (messageFilter === "all") {
      return searchQuery ? `${result.data.count} results` : `${result.data.count} messages`;
    }
    return searchQuery ? `${filteredMessages.length} ${messageFilter} results` : `${filteredMessages.length} ${messageFilter} messages`;
  }, [filteredMessages.length, messageFilter, result.data, searchQuery]);
  const emptyMessage = searchQuery
    ? `No ${messageFilter === "all" ? "emails" : messageFilter} emails found for "${searchQuery}"`
    : messageFilter === "unread"
      ? `No unread messages in ${box}`
      : messageFilter === "read"
        ? `No read messages in ${box}`
        : `${box} is empty`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <FilterTabs
        tabs={MESSAGE_FILTERS}
        value={messageFilter}
        onChange={onMessageFilterChange}
        className="bg-secondary"
        activeTabClassName="border-red-500 text-primary"
      />

      <div className="shrink-0 h-9 border-b border-primary bg-secondary flex items-center justify-between px-3">
        <span className="text-2xs text-muted">{countLabel}</span>
        <button
          type="button"
          onClick={() => result.mutate()}
          className="p-1 text-muted hover:text-primary transition-colors focus-ring rounded cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {result.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted p-4 text-center">
            <Inbox className="w-8 h-8 opacity-30" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          filteredMessages.map(msg => <MessageListItem key={msg.id} msg={msg} selected={msg.id === selectedId} onClick={() => onSelect(msg.id)} />)
        )}
      </div>
    </div>
  );
}

function EmailPreview({
  provider,
  selectedMessageId,
  onSendToAgent,
  onClose,
}: {
  provider: string;
  selectedMessageId: string | null;
  onSendToAgent: (message: string) => void | Promise<void>;
  onClose: () => void;
}) {
  if (selectedMessageId) {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 flex justify-end px-3 py-1.5 border-b border-primary bg-secondary">
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
            aria-label="Close email"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <MessageViewer provider={provider} messageId={selectedMessageId} onReply={onSendToAgent} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center text-muted">
      <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
        <Mail className="w-7 h-7 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-primary">No message selected</p>
        <p className="text-xs mt-1 max-w-xs">Select a message from the list to preview it here.</p>
      </div>
    </div>
  );
}

function EmailBrowserPane({
  provider,
  availableProviders,
  providersLoading,
  selectedMessageId,
  onSelectMessage,
  onProviderChange,
  onSendToAgent,
  agentId,
  onAgentLaunched,
}: {
  provider: string | null;
  availableProviders: string[];
  providersLoading: boolean;
  selectedMessageId: string | null;
  onSelectMessage: (id: string | null) => void;
  onProviderChange: (p: string) => void | Promise<void>;
  onSendToAgent: (message: string) => void | Promise<void>;
  agentId: string | null;
  onAgentLaunched: (agentId: string) => void;
}) {
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  const { data: boxesData, isLoading: boxesLoading } = useEmailBoxes(provider ?? undefined);
  const boxes = boxesData?.boxes ?? [];

  useEffect(() => {
    setActiveSearch(null);
    setSearchInput("");
    onSelectMessage(null);
  }, [onSelectMessage]);

  useEffect(() => {
    if (boxes.length === 0) return;
    if (boxes.some(box => box.id === selectedFolder)) return;
    setSelectedFolder(boxes.find(box => box.id === "inbox")?.id ?? boxes[0]!.id);
  }, [boxes, selectedFolder]);

  const handleFolderSelect = (id: string) => {
    setSelectedFolder(id);
    setActiveSearch(null);
    onSelectMessage(null);
  };

  const handleSearch = (e: { preventDefault(): void }) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim() || null);
    onSelectMessage(null);
  };

  if (!providersLoading && availableProviders.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <WifiOff className="w-10 h-10 text-muted opacity-30" />
        <div>
          <h2 className="text-base font-semibold text-primary mb-1">No email providers configured</h2>
          <p className="text-sm text-muted max-w-xs">Add an email provider to browse your inbox here.</p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
        <p className="text-sm text-muted">Loading email providers…</p>
      </div>
    );
  }

  if (!boxesLoading && boxes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Mail className="w-10 h-10 text-muted opacity-30" />
        <div>
          <h2 className="text-base font-semibold text-primary mb-1">No email boxes available</h2>
          <p className="text-sm text-muted max-w-xs">The selected provider did not expose any readable email boxes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Title bar: mailbox dropdown + search + controls ── */}
      <div className="shrink-0 h-11 border-b border-primary bg-secondary flex items-center gap-2 px-3">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm shrink-0">
          <Mail className="w-4 h-4 text-white" />
        </div>

        <MailboxDropdown boxes={boxes} selected={selectedFolder} onSelect={handleFolderSelect} />

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-1.5 min-w-0 ml-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search emails…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full bg-input border border-primary rounded-lg py-1.5 pl-8 pr-3 text-xs text-primary placeholder-muted focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
            />
          </div>
          {activeSearch && (
            <button
              type="button"
              onClick={() => {
                setActiveSearch(null);
                setSearchInput("");
              }}
              className="px-2 text-2xs text-muted hover:text-primary transition-colors cursor-pointer shrink-0"
            >
              Clear
            </button>
          )}
        </form>

        <ProviderSelector provider={provider} availableProviders={availableProviders} loading={providersLoading} onProviderChange={onProviderChange} />

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />

        <AgentLauncherBar
          buttonLabel="Compose Email"
          buttonClassName="bg-red-600 hover:bg-red-500 text-white shadow-button-primary"
          onLaunch={onAgentLaunched}
        />
      </div>

      {/* ── Main content: message list (left) | preview + agent (right) ── */}
      <div className="flex-1 min-h-0">
        <ResizableSplit direction="horizontal" initialRatio={0.3} minFirst={200} minSecond={300} className="h-full">
          {/* Left: Message list */}
          <div className="h-full flex flex-col min-h-0 bg-primary">
            <MessageListPane
              provider={provider}
              box={selectedFolder}
              selectedId={selectedMessageId}
              onSelect={id => onSelectMessage(id)}
              messageFilter={messageFilter}
              onMessageFilterChange={filter => {
                setMessageFilter(filter);
                onSelectMessage(null);
              }}
              searchQuery={activeSearch}
            />
          </div>

          {/* Right: Preview (top) + Agent pane (bottom, only when active) */}
          {agentId ? (
            <ResizableSplit direction="vertical" initialRatio={0.6} minFirst={200} minSecond={120} className="h-full">
              {/* Email preview */}
              <div className="h-full overflow-hidden bg-primary">
                <EmailPreview provider={provider} selectedMessageId={selectedMessageId} onSendToAgent={onSendToAgent} onClose={() => onSelectMessage(null)} />
              </div>

              {/* AI Agent pane */}
              <div className="h-full overflow-hidden bg-primary">
                <ChatPanel agentId={agentId} />
              </div>
            </ResizableSplit>
          ) : (
            <div className="h-full overflow-hidden bg-primary">
              <EmailPreview provider={provider} selectedMessageId={selectedMessageId} onSendToAgent={onSendToAgent} onClose={() => onSelectMessage(null)} />
            </div>
          )}
        </ResizableSplit>
      </div>
    </div>
  );
}

export default function EmailApp() {
  const providers = useEmailProviders();
  const [provider, setProvider] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const {
    agentId,
    ensureAgent,
    assignAgent: handleAgentLaunched,
  } = useLazyAgent({
    appName: "Email app",
    agentType: "email",
    headless: false,
  });

  useEffect(() => {
    const availableProviders = providers.data?.providers ?? [];
    if (!availableProviders.length) return;

    const newProvider = availableProviders[0];
    if (!provider && newProvider && newProvider !== provider) {
      setProvider(newProvider);
      setSelectedMessageId(null);
    }
  }, [providers.data, provider]);

  useEffect(() => {
    if (!agentId || (!provider && !selectedMessageId)) return;
    emailRPCClient
      .updateEmailState({
        agentId,
        ...(provider !== null && { selectedProvider: provider }),
        ...(selectedMessageId !== null && { selectedMessageId }),
      })
      .catch(() => {});
  }, [agentId, provider, selectedMessageId]);

  const handleSendToAgent = useCallback(
    async (message: string) => {
      const id = await ensureAgent();
      if (!id) return;
      await agentRPCClient.sendInput({ agentId: id, input: { from: "Email App", message } });
    },
    [ensureAgent],
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-primary">
      <EmailBrowserPane
        provider={provider}
        availableProviders={providers.data?.providers ?? []}
        providersLoading={providers.isLoading}
        selectedMessageId={selectedMessageId}
        onSelectMessage={setSelectedMessageId}
        onProviderChange={p => {
          setProvider(p);
          setSelectedMessageId(null);
        }}
        onSendToAgent={handleSendToAgent}
        agentId={agentId}
        onAgentLaunched={handleAgentLaunched}
      />
    </div>
  );
}
