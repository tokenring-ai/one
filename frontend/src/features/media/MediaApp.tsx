import type { AudioIndexEntry, ImageIndexEntry, VideoIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatPanel from "../../components/chat/ChatPanel.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { agentRPCClient, useAudios, useImages, useVideos } from "../../rpc.ts";
import GallerySidebar from "./components/GallerySidebar.tsx";
import RightPanel from "./components/RightPanel.tsx";
import { AGENT_TYPE_PREFERENCES } from "./constants.ts";
import type { MediaEntry, MediaKind } from "./types.ts";

export default function MediaApp() {
  const { agentId, error: initError } = useHeadlessAgent({
    appName: "Media app",
    resolvePreferred: types => types.find(t => Object.values(AGENT_TYPE_PREFERENCES).flat().includes(t.type)) ?? types[0],
    noTypesMessage: "No agent types available.",
  });
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaKind>("image");
  const [selected, setSelected] = useState<MediaEntry | null>(null);
  const [search, setSearch] = useState("");

  const imagesData = useImages(kind === "image" && search ? search : undefined);
  const videosData = useVideos(kind === "video" && search ? search : undefined);
  const audiosData = useAudios(kind === "audio" && search ? search : undefined);

  const images: ImageIndexEntry[] = imagesData.data?.images ?? [];
  const videos: VideoIndexEntry[] = videosData.data?.videos ?? [];
  const audios: AudioIndexEntry[] = audiosData.data?.audios ?? [];

  const tabs: FilterTabOption<MediaKind>[] = [
    { id: "image", label: "Images", count: images.length },
    { id: "video", label: "Videos", count: videos.length },
    { id: "audio", label: "Audio", count: audios.length },
  ];

  const handleKindChange = (next: MediaKind) => {
    setKind(next);
    setSelected(null);
    setSearch("");
  };

  const handleWorkOnSelection = async () => {
    if (!selected) return;
    try {
      const types = await agentRPCClient.getAgentTypes({});
      const prefs = AGENT_TYPE_PREFERENCES[selected.kind];
      const preferred = types.find(t => prefs.includes(t.type)) ?? types[0];
      if (!preferred) return;
      const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, headless: false });
      setChatAgentId(id);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 4000 });
    }
  };

  const handleGenerated = () => {
    if (kind === "image") void imagesData.mutate();
    else if (kind === "video") void videosData.mutate();
    else void audiosData.mutate();
    setSelected(null);
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
          buttonLabel="Open Agent"
          buttonClassName="bg-accent hover:bg-accent-hover text-white shadow-button-primary"
          onLaunch={id => setChatAgentId(id)}
        />
      </div>

      <div className="flex-1 min-h-0">
        {chatAgentId ? (
          <ResizableSplit direction="vertical" initialRatio={0.6} minFirst={200} minSecond={120} className="h-full">
            {body}
            <div className="h-full overflow-hidden bg-primary">
              <ChatPanel agentId={chatAgentId} />
            </div>
          </ResizableSplit>
        ) : (
          body
        )}
      </div>
    </div>
  );
}
