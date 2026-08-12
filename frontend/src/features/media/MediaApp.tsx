import formatError from "@tokenring-ai/utility/error/formatError";
import { ImageIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import PanelToolbar from "../../components/ui/PanelToolbar.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { cleanupAgent } from "../../lib/agentCleanup.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { agentRPCClient, mediaLibraryRPCClient, useMedia, useMediaLibraryConfiguration } from "../../rpc.ts";
import GallerySidebar from "./components/GallerySidebar.tsx";
import RightPanel from "./components/RightPanel.tsx";
import { AGENT_TYPE_PREFERENCES, MEDIA_AGENT_TYPES } from "./constants.ts";
import type { MediaEntry, MediaKind } from "./types.ts";
import { useMediaServeDirectory } from "./useMediaPaths.ts";
import { workOnMediaMessage } from "./utils.ts";

const SEARCH_DEBOUNCE_MS = 300;
/** Clear auto-select pending state if the generated file never appears in the stream. */
const PENDING_SELECT_TIMEOUT_MS = 30_000;
/** Match prior per-kind cap (200 × 3) when streaming all kinds together. */
const MEDIA_STREAM_LIMIT = 600;

export default function MediaApp() {
  const configuration = useMediaLibraryConfiguration();
  const serveDirectory = useMediaServeDirectory();
  // Fallback matches MediaLibraryServiceConfigSchema.agentTypes default so headless
  // agent init can resolve a preferred type before the configuration RPC returns.
  const allowedAgentTypes = configuration.data?.agentTypes ?? [...MEDIA_AGENT_TYPES];
  const defaultAgentType = allowedAgentTypes[0] ?? "media";
  const allowedAgentTypesRef = useRefSync(allowedAgentTypes);

  const {
    agentId,
    initialising,
    error: initError,
  } = useHeadlessAgent({
    appName: "Media app",
    preferredTypes: allowedAgentTypes,
    noTypesMessage: "No agent types available.",
  });
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaKind>("image");
  const [selected, setSelected] = useState<MediaEntry | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [workingOn, setWorkingOn] = useState(false);

  // Keep the chat agent’s selected media in sync so addSelectedMedia can tag the filename.
  useEffect(() => {
    if (!chatAgentId) return;
    if (selected) {
      toastOnReject(
        mediaLibraryRPCClient.updateMediaLibraryState({
          agentId: chatAgentId,
          selectedFilename: selected.filename,
          selectedKind: selected.kind,
        }),
      );
      return;
    }
    toastOnReject(mediaLibraryRPCClient.updateMediaLibraryState({ agentId: chatAgentId, clearSelection: true }));
  }, [chatAgentId, selected]);

  // One stream for all kinds so tab badges stay populated without three sockets.
  // Search is applied client-side to the active tab only (also cleared on tab change).
  const mediaData = useMedia({ limit: MEDIA_STREAM_LIMIT });

  const media = mediaData.data?.media ?? [];

  const { images, videos, audios } = useMemo(() => {
    const images: MediaEntry[] = [];
    const videos: MediaEntry[] = [];
    const audios: MediaEntry[] = [];
    for (const entry of media) {
      if (entry.kind === "image") images.push(entry);
      else if (entry.kind === "video") videos.push(entry);
      else audios.push(entry);
    }
    return { images, videos, audios };
  }, [media]);

  const galleryEntries = useMemo(() => {
    const pool = kind === "image" ? images : kind === "video" ? videos : audios;
    if (!debouncedSearch) return pool;
    const q = debouncedSearch.toLowerCase();
    return pool.filter(
      entry =>
        entry.filename.toLowerCase().includes(q) ||
        entry.prompt?.toLowerCase().includes(q) ||
        entry.keywords.some(keyword => keyword.toLowerCase().includes(q)),
    );
  }, [kind, images, videos, audios, debouncedSearch]);

  const tabs: FilterTabOption<MediaKind>[] = [
    { id: "image", label: "Images", count: images.length },
    { id: "video", label: "Videos", count: videos.length },
    { id: "audio", label: "Audio", count: audios.length },
  ];

  // Auto-select a just-generated file once it appears in the active kind pool
  // (use the unfiltered partition so a still-debouncing search clear cannot block it).
  useEffect(() => {
    if (!pendingSelect) return;
    const pool = kind === "image" ? images : kind === "video" ? videos : audios;
    const match = pool.find(entry => entry.filename === pendingSelect);
    if (match) {
      setSelected(match);
      setPendingSelect(null);
    }
  }, [pendingSelect, kind, images, videos, audios]);

  // Drop pending auto-select if the generated file never shows up (failed indexing, etc.).
  useEffect(() => {
    if (!pendingSelect) return;
    const handle = setTimeout(() => {
      setPendingSelect(current => {
        if (current) {
          toastManager.warning(`Generated file "${current}" did not appear in the library`, { duration: 4000 });
        }
        return null;
      });
    }, PENDING_SELECT_TIMEOUT_MS);
    return () => clearTimeout(handle);
  }, [pendingSelect]);

  const streamError = mediaData.error?.message ?? null;

  const handleKindChange = (next: MediaKind) => {
    setKind(next);
    setSelected(null);
    setSearch("");
    setPendingSelect(null);
  };

  const syncSelectionToAgent = useCallback(async (id: string, entry: MediaEntry | null) => {
    if (entry) {
      await mediaLibraryRPCClient.updateMediaLibraryState({
        agentId: id,
        selectedFilename: entry.filename,
        selectedKind: entry.kind,
      });
      return;
    }
    await mediaLibraryRPCClient.updateMediaLibraryState({ agentId: id, clearSelection: true });
  }, []);

  const handleWorkOnSelection = async () => {
    if (!selected || workingOn) return;
    let createdAgentId: string | null = null;
    try {
      const allowed = allowedAgentTypesRef.current;
      const types = await agentRPCClient.getAgentTypes({});
      const prefs = AGENT_TYPE_PREFERENCES[selected.kind];
      // Prefer kind-specific types that are also configured for the media library.
      const preferred = types.find(t => allowed.includes(t.type) && prefs.includes(t.type)) ?? types.find(t => allowed.includes(t.type));
      if (!preferred) {
        toastManager.error("No agent type available for this media", { duration: 4000 });
        return;
      }
      setWorkingOn(true);
      const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, headless: false });
      createdAgentId = id;
      try {
        await syncSelectionToAgent(id, selected);
      } catch (error: unknown) {
        // Non-fatal — agent still usable, but tools may lack the selection.
        toastManager.warning(`Agent started, but media selection could not be synced: ${formatError(error)}`, {
          duration: 4000,
        });
      }
      await agentRPCClient.sendInput({
        agentId: id,
        input: {
          from: "Media app",
          message: workOnMediaMessage(selected.kind, selected.filename, selected.keywords, { directory: serveDirectory }),
        },
      });
      setChatAgentId(id);
      createdAgentId = null; // ownership transferred to chat dock
    } catch (err) {
      if (createdAgentId) {
        cleanupAgent(createdAgentId, "Media app work-on-selection failed");
      }
      toastManager.error(formatError(err), { duration: 4000 });
    } finally {
      setWorkingOn(false);
    }
  };

  const handleGenerated = (filename?: string) => {
    // Clear search so the newly generated item is not filtered out of the gallery stream.
    // debouncedSearch follows via useDebounce within SEARCH_DEBOUNCE_MS.
    if (search || debouncedSearch) {
      setSearch("");
    }
    void mediaData.mutate();
    // Only auto-select on success; leave the user's current selection alone on failure.
    if (filename) {
      setPendingSelect(filename);
    }
  };

  const handleRefresh = () => {
    void mediaData.mutate();
  };

  if (initError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-primary gap-4 p-6 text-center">
        <ImageIcon className="w-10 h-10 text-muted opacity-40" />
        <div>
          <h2 className="text-sm font-semibold text-primary mb-1">Media Unavailable</h2>
          <p className="text-xs text-muted max-w-sm">{initError}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg cursor-pointer focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  if (initialising && !agentId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-primary gap-3">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
        <p className="text-xs text-muted">Starting Media…</p>
      </div>
    );
  }

  const body = (
    <div className="flex flex-col h-full min-h-0">
      <FilterTabs tabs={tabs} value={kind} onChange={handleKindChange} showZeroCounts />
      <WorkspaceShell
        appId="media"
        title="Media library"
        navigationLabel="Media gallery"
        hasSelection
        className="flex-1"
        navigation={
          <div className="h-full flex flex-col min-h-0 bg-secondary">
            <GallerySidebar
              kind={kind}
              search={search}
              loading={mediaData.isLoading}
              error={streamError}
              selectedFilename={selected?.filename ?? null}
              entries={galleryEntries}
              onSearch={setSearch}
              onSelect={entry => {
                setPendingSelect(null);
                setSelected(entry);
              }}
              onRefresh={handleRefresh}
            />
          </div>
        }
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          <RightPanel
            kind={kind}
            agentId={agentId}
            selected={selected}
            workingOn={workingOn}
            onWorkOnSelection={handleWorkOnSelection}
            onClearSelection={() => {
              setPendingSelect(null);
              setSelected(null);
            }}
            onGenerated={handleGenerated}
          />
        </div>
      </WorkspaceShell>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <PanelToolbar
        icon={ImageIcon}
        iconGradient="from-pink-500 to-rose-600"
        title="Media"
        actions={
          <AgentLauncherBar
            defaultAgentType={defaultAgentType}
            allowedAgentTypes={allowedAgentTypes}
            buttonLabel="Open Agent"
            buttonClassName="bg-accent hover:bg-accent-hover text-white shadow-button-primary"
            onLaunch={id => {
              toastOnReject(syncSelectionToAgent(id, selected));
              setChatAgentId(id);
            }}
          />
        }
      />

      <div className="flex-1 min-h-0">
        <ChatDock agentId={chatAgentId} storageKey="media" initialRatio={0.6} headerTitle="Media Agent">
          {body}
        </ChatDock>
      </div>
    </div>
  );
}
