import { Loader2, Mail, PenSquare, Search, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { useLazyAgent } from "../../hooks/useLazyAgent.ts";
import { agentRPCClient, emailRPCClient, useEmailBoxes, useEmailProviders } from "../../rpc.ts";
import EmailPreview from "./components/EmailPreview.tsx";
import MailboxDropdown from "./components/MailboxDropdown.tsx";
import MessageListPane from "./components/MessageListPane.tsx";
import ProviderSelector from "./components/ProviderSelector.tsx";
import type { ComposeDraft, MessageFilter } from "./types.ts";
import { emptyComposeDraft } from "./utils.ts";

function EmailBrowserPane({
  provider,
  availableProviders,
  providersLoading,
  providersError,
  onProvidersRetry,
  selectedMessageId,
  onSelectMessage,
  onProviderChange,
  onSendToAgent,
  ensureAgent,
  agentId,
  onAgentLaunched,
}: {
  provider: string | null;
  availableProviders: string[];
  providersLoading: boolean;
  providersError?: unknown;
  onProvidersRetry?: () => void;
  selectedMessageId: string | null;
  onSelectMessage: (id: string | null) => void;
  onProviderChange: (p: string) => void | Promise<void>;
  onSendToAgent: (message: string) => void | Promise<void>;
  ensureAgent: () => string | Promise<string | null>;
  agentId: string | null;
  onAgentLaunched: (agentId: string) => void;
}) {
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const { data: boxesData, isLoading: boxesLoading, error: boxesError, mutate: mutateBoxes } = useEmailBoxes(provider ?? undefined);
  const boxes = boxesData?.boxes ?? [];

  // Reset folder/search when provider changes
  useEffect(() => {
    setActiveSearch(null);
    setSearchInput("");
    setSelectedFolder("inbox");
    setComposeDraft(null);
    onSelectMessage(null);
  }, [provider, onSelectMessage]);

  useEffect(() => {
    if (boxes.length === 0) return;
    if (boxes.some(box => box.id === selectedFolder)) return;
    setSelectedFolder(boxes.find(box => box.id === "inbox")?.id ?? boxes[0]!.id);
  }, [boxes, selectedFolder]);

  const handleFolderSelect = (id: string) => {
    setSelectedFolder(id);
    setActiveSearch(null);
    setComposeDraft(null);
    onSelectMessage(null);
  };

  const handleSearch = (e: { preventDefault(): void }) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim() || null);
    setComposeDraft(null);
    onSelectMessage(null);
  };

  const openCompose = () => {
    onSelectMessage(null);
    setComposeDraft(emptyComposeDraft());
  };

  if (!providersLoading && availableProviders.length === 0) {
    if (providersError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
          <WifiOff className="w-10 h-10 text-muted opacity-30" />
          <div>
            <h2 className="text-base font-semibold text-primary mb-1">Failed to load email providers</h2>
            <p className="text-sm text-muted max-w-xs mb-3">Could not reach the email service.</p>
            {onProvidersRetry && (
              <button
                type="button"
                onClick={() => onProvidersRetry()}
                className="px-3 py-1.5 text-xs bg-secondary border border-primary rounded-lg hover:bg-hover focus-ring cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      );
    }

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

  if (boxesLoading && boxes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
        <p className="text-sm text-muted">Loading mailboxes…</p>
      </div>
    );
  }

  if (!boxesLoading && boxesError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Mail className="w-10 h-10 text-muted opacity-30" />
        <div>
          <h2 className="text-base font-semibold text-primary mb-1">Failed to load mailboxes</h2>
          <p className="text-sm text-muted max-w-xs mb-3">Could not list boxes for this provider.</p>
          <button
            type="button"
            onClick={() => void mutateBoxes()}
            className="px-3 py-1.5 text-xs bg-secondary border border-primary rounded-lg hover:bg-hover focus-ring cursor-pointer"
          >
            Retry
          </button>
        </div>
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

        <button
          type="button"
          onClick={openCompose}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg shadow-button-primary focus-ring cursor-pointer transition-colors shrink-0"
        >
          <PenSquare className="w-3.5 h-3.5" />
          Compose
        </button>

        <AgentLauncherBar
          buttonLabel="AI Agent"
          buttonClassName="bg-secondary border border-primary text-primary hover:bg-hover shadow-sm"
          defaultAgentType="email"
          onLaunch={onAgentLaunched}
        />
      </div>

      {/* ── Main content: message list (left) | preview + agent (right) ── */}
      <div className="flex-1 min-h-0">
        <ResizableSplit direction="horizontal" initialRatio={0.3} minFirst={200} minSecond={300} className="h-full">
          <div className="h-full flex flex-col min-h-0 bg-primary">
            <MessageListPane
              provider={provider}
              box={selectedFolder}
              selectedId={selectedMessageId}
              onSelect={id => {
                setComposeDraft(null);
                onSelectMessage(id);
              }}
              messageFilter={messageFilter}
              onMessageFilterChange={filter => {
                setMessageFilter(filter);
                onSelectMessage(null);
              }}
              searchQuery={activeSearch}
              refreshKey={listRefreshKey}
            />
          </div>

          <ChatDock agentId={agentId} storageKey="email" initialRatio={0.6} headerTitle="Email Agent">
            <div className="h-full overflow-hidden bg-primary">
              <EmailPreview
                provider={provider}
                selectedMessageId={selectedMessageId}
                composeDraft={composeDraft}
                onComposeChange={setComposeDraft}
                onSendToAgent={onSendToAgent}
                ensureAgent={ensureAgent}
                onSent={() => setListRefreshKey(k => k + 1)}
                onClose={() => {
                  setComposeDraft(null);
                  onSelectMessage(null);
                }}
              />
            </div>
          </ChatDock>
        </ResizableSplit>
      </div>
    </div>
  );
}

export default function EmailApp() {
  const navigate = useNavigate();
  const { provider: routeProvider } = useParams<{ provider?: string }>();
  // URL is the source of truth for which provider is open (params are already decoded).
  const provider = routeProvider ?? null;

  const providers = useEmailProviders();
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

  const openProvider = useCallback(
    (name: string | null, options?: { replace?: boolean }) => {
      const path = name ? `/email/${encodeURIComponent(name)}` : "/email";
      void navigate(path, options?.replace ? { replace: true } : undefined);
    },
    [navigate],
  );

  useEffect(() => {
    if (providers.isLoading) return;
    const availableProviders = providers.data?.providers ?? [];
    if (!availableProviders.length) {
      if (routeProvider) {
        openProvider(null, { replace: true });
        setSelectedMessageId(null);
      }
      return;
    }

    if (!provider || !availableProviders.includes(provider)) {
      openProvider(availableProviders[0]!, { replace: true });
      setSelectedMessageId(null);
    }
  }, [providers.data, providers.isLoading, provider, routeProvider, openProvider]);

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
        providersError={providers.error}
        onProvidersRetry={() => void providers.mutate()}
        selectedMessageId={selectedMessageId}
        onSelectMessage={setSelectedMessageId}
        onProviderChange={p => {
          openProvider(p);
          setSelectedMessageId(null);
        }}
        onSendToAgent={handleSendToAgent}
        ensureAgent={ensureAgent}
        agentId={agentId}
        onAgentLaunched={handleAgentLaunched}
      />
    </div>
  );
}
