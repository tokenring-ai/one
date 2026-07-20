import type { MediaEntry, MediaKind } from "../types.ts";
import ImageGeneratePanel from "./generate/ImageGeneratePanel.tsx";
import SpeechGeneratePanel from "./generate/SpeechGeneratePanel.tsx";
import VideoGeneratePanel from "./generate/VideoGeneratePanel.tsx";
import AudioViewer from "./viewers/AudioViewer.tsx";
import ImageViewer from "./viewers/ImageViewer.tsx";
import VideoViewer from "./viewers/VideoViewer.tsx";

export default function RightPanel({
  kind,
  agentId,
  selected,
  onWorkOnSelection,
  onClearSelection,
  onGenerated,
}: {
  kind: MediaKind;
  agentId: string | null;
  selected: MediaEntry | null;
  onWorkOnSelection: () => Promise<void>;
  onClearSelection: () => void;
  onGenerated: () => void;
}) {
  if (selected) {
    switch (selected.kind) {
      case "image":
        return <ImageViewer image={selected} onWorkOnImage={onWorkOnSelection} onClose={onClearSelection} />;
      case "video":
        return <VideoViewer video={selected} onWorkOnVideo={onWorkOnSelection} onClose={onClearSelection} />;
      case "audio":
        return <AudioViewer audio={selected} agentId={agentId} onWorkOnAudio={onWorkOnSelection} onClose={onClearSelection} />;
      default: {
        const exhaustive: any = selected satisfies never;
        console.error(`Unhandled media kind: ${exhaustive}`);
        return null;
      }
    }
  }

  switch (kind) {
    case "image":
      return <ImageGeneratePanel agentId={agentId} onGenerated={onGenerated} />;
    case "video":
      return <VideoGeneratePanel agentId={agentId} onGenerated={onGenerated} />;
    case "audio":
      return <SpeechGeneratePanel agentId={agentId} onGenerated={onGenerated} />;
    default: {
      const exhaustive: any = kind satisfies never;
      console.error(`Unhandled media kind: ${exhaustive}`);
      return null;
    }
  }
}
