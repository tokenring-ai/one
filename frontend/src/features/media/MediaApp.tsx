import type { AudioIndexEntry, ImageIndexEntry, VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { ImageIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { agentRPCClient, mediaLibraryRPCClient, useAudios, useImages, useVideos } from "../../rpc.ts";
import GallerySidebar from "./components/GallerySidebar.tsx";
import RightPanel from "./components/RightPanel.tsx";
import { AGENT_TYPE_PREFERENCES, MEDIA_AGENT_TYPES } from "./constants.ts";
import type { MediaEntry, MediaKind } from "./types.ts";
import { workOnMediaMessage } from "./utils.ts";

const SEARCH_DEBOUNCE_MS = 300;

export default function MediaApp() {
  const {
    agentId,
    initialising,
    error: initError,
  } = useHeadlessAgent({
    appName: "Media app",
    preferredTypes: [...MEDIA_AGENT_TYPES],
    noTypesMessage: "No agent types available.",
  });
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaKind>("image");
  const [selected, setSelected] = useState<MediaEntry | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [workingOn, setWorkingOn] = useState(false);

  useEffect(() => {
    const trimmed = search.trim();
    const handle = setTimeout(() => setDebouncedSearch(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  // Keep the chat agent’s selected media in sync so addSelectedMedia can tag the filename.
  useEffect(() => {
    if (!chatAgentId) return;
    if (selected) {
      mediaLibraryRPCClient
        .updateMediaLibraryState({
          agentId: chatAgentId,
          selectedFilename: selected.filename,
          selectedKind: selected.kind,
        })
        .catch(() => {});
      return;
    }
    mediaLibraryRPCClient.updateMediaLibraryState({ agentId: chatAgentId, clearSelection: true }).catch(() => {});
  }, [chatAgentId, selected]);

  const imageSearch = kind === "image" && debouncedSearch ? debouncedSearch : undefined;
  const videoSearch = kind === "video" && debouncedSearch ? debouncedSearch : undefined;
  const audioSearch = kind === "audio" && debouncedSearch ? debouncedSearch : undefined;

  const imagesData = useImages(imageSearch);
  const videosData = useVideos(videoSearch);
  const audiosData = useAudios(audioSearch);

  const images: ImageIndexEntry[] = imagesData.data?.images ?? [];
  const videos: VideoIndexEntry[] = videosData.data?.videos ?? [];
  const audios: AudioIndexEntry[] = audiosData.data?.audios ?? [];

  // Prefer server-reported counts (pre-limit) so badges stay accurate past the stream limit.
  const imageCount = imagesData.data?.count ?? images.length;
  const videoCount = videosData.data?.count ?? videos.length;
  const audioCount = audiosData.data?.count ?? audios.length;

  const tabs: FilterTabOption<MediaKind>[] = [
    { id: "image", label: "Images", count: imageCount },
    { id: "video", label: "Videos", count: videoCount },
    { id: "audio", label: "Audio", count: audioCount },
  ];

  // Auto-select a just-generated file once it appears in the active stream.
  useEffect(() => {
    if (!pendingSelect) return;
    const pool: MediaEntry[] = kind === "image" ? images : kind === "video" ? videos : audios;
    const match = pool.find(entry => entry.filename === pendingSelect);
    if (match) {
      setSelected(match);
      setPendingSelect(null);
    }
  }, [pendingSelect, kind, images, videos, audios]);

  const streamError = useMemo(() => {
    const err = kind === "image" ? imagesData.error : kind === "video" ? videosData.error : audiosData.error;
    return err?.message ?? null;
  }, [kind, imagesData.error, videosData.error, audiosData.error]);

  const handleKindChange = (next: MediaKind) => {
    setKind(next);
    setSelected(null);
    setSearch("");
    setDebouncedSearch("");
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
    setWorkingOn(true);
    try {
      const types = await agentRPCClient.getAgentTypes({});
      const prefs = AGENT_TYPE_PREFERENCES[selected.kind];
      const preferred = types.find(t => prefs.includes(t.type)) ?? types[0];
      if (!preferred) {
        toastManager.error("No agent type available for this media", { duration: 4000 });
        return;
      }
      const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, headless: false });
      try {
        await syncSelectionToAgent(id, selected);
      } catch {
        // Non-fatal — agent still usable
      }
      await agentRPCClient.sendInput({
        agentId: id,
        input: {
          from: "Media app",
          message: workOnMediaMessage(selected.kind, selected.filename, selected.keywords),
        },
      });
      setChatAgentId(id);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 4000 });
    } finally {
      setWorkingOn(false);
    }
  };

  const handleGenerated = (filename?: string) => {
    if (kind === "image") void imagesData.mutate();
    else if (kind === "video") void videosData.mutate();
    else void audiosData.mutate();
    if (filename) {
      setPendingSelect(filename);
    } else {
      setSelected(null);
    }
  };

  const handleRefresh = () => {
    if (kind === "image") void imagesData.mutate();
    else if (kind === "video") void videosData.mutate();
    else void audiosData.mutate();
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

  const loading = kind === "image" ? imagesData.isLoading : kind === "video" ? videosData.isLoading : audiosData.isLoading;

  const body = (
    <div className="flex flex-col h-full min-h-0">
      <FilterTabs tabs={tabs} value={kind} onChange={handleKindChange} showZeroCounts />
      <div className="flex flex-1 min-h-0">
        <div className="w-64 shrink-0 border-r border-primary flex flex-col min-h-0 bg-secondary">
          <GallerySidebar
            kind={kind}
            search={search}
            loading={loading}
            error={streamError}
            selectedFilename={selected?.filename ?? null}
            images={images}
            videos={videos}
            audios={audios}
            onSearch={setSearch}
            onSelect={setSelected}
            onRefresh={handleRefresh}
          />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <RightPanel
            kind={kind}
            agentId={agentId}
            selected={selected}
            workingOn={workingOn}
            onWorkOnSelection={handleWorkOnSelection}
            onClearSelection={() => setSelected(null)}
            onGenerated={handleGenerated}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <div className="shrink-0 h-11 border-b border-primary bg-secondary flex items-center gap-2 px-3">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-sm shrink-0">
          <ImageIcon className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-primary">Media</span>

        <div className="flex-1" />

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
        <AgentLauncherBar
          defaultAgentType="media"
          buttonLabel="Open Agent"
          buttonClassName="bg-accent hover:bg-accent-hover text-white shadow-button-primary"
          onLaunch={id => {
            void syncSelectionToAgent(id, selected).catch(() => {});
            setChatAgentId(id);
          }}
        />
      </div>

      <div className="flex-1 min-h-0">
        <ChatDock agentId={chatAgentId} storageKey="media" initialRatio={0.6} headerTitle="Media Agent">
          {body}
        </ChatDock>
      </div>
    </div>
  );
}
