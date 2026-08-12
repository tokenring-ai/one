import type { AudioIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Download, Loader2, Music, Pause, Play, Sparkles, Type, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import ViewerHeader from "../../../../components/ui/ViewerHeader.tsx";
import { audioRPCClient } from "../../../../rpc.ts";
import { useMediaFileUrl, useMediaServeDirectory } from "../../useMediaPaths.ts";
import { downloadMedia, formatDuration } from "../../utils.ts";
import ActionButton from "./ActionButton.tsx";

export default function AudioViewer({
  audio,
  agentId,
  workingOn,
  onWorkOnAudio,
  onClose,
}: {
  audio: AudioIndexEntry;
  agentId: string | null;
  workingOn?: boolean | undefined;
  onWorkOnAudio: () => Promise<void>;
  onClose: () => void;
}) {
  const busy = workingOn ?? false;
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const src = useMediaFileUrl(audio.filename);
  const serveDirectory = useMediaServeDirectory();

  // Reset per-clip UI when selection changes so transcript/playback don't leak across files.
  useEffect(() => {
    setTranscript(null);
    setTranscribing(false);
    setPlaying(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [audio.filename]);

  const subtitleParts: string[] = [];
  if (audio.duration !== undefined) subtitleParts.push(formatDuration(audio.duration));
  if (audio.sampleRate) subtitleParts.push(`${(audio.sampleRate / 1000).toFixed(1)} kHz`);
  if (audio.channels) subtitleParts.push(audio.channels === 1 ? "mono" : audio.channels === 2 ? "stereo" : `${audio.channels}ch`);

  const handleTranscribe = async () => {
    if (!agentId) {
      toastManager.error("Agent not ready", { duration: 3000 });
      return;
    }
    setTranscribing(true);
    try {
      const result = await audioRPCClient.transcribeAudio({ agentId, filename: audio.filename });
      if (result.status === "success") {
        setTranscript(result.text);
      } else {
        toastManager.error("Agent not found", { duration: 4000 });
      }
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setTranscribing(false);
    }
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {
        setPlaying(false);
        toastManager.error("Unable to play audio", { duration: 3000 });
      });
    } else {
      el.pause();
    }
  };

  const handleDownload = () => {
    void downloadMedia(audio.filename, { directory: serveDirectory }).catch(() => {
      toastManager.error("Download failed", { duration: 3000 });
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ViewerHeader
        title={audio.filename}
        subtitle={subtitleParts.join(" · ")}
        keywords={audio.keywords}
        onClose={onClose}
        actions={
          <>
            <ActionButton
              onClick={() => void onWorkOnAudio()}
              primary
              disabled={busy}
              icon={busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            >
              {busy ? "Opening..." : "Work on this audio"}
            </ActionButton>
            <ActionButton
              onClick={() => void handleTranscribe()}
              disabled={transcribing || !agentId}
              icon={transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Type className="w-3.5 h-3.5" />}
            >
              {transcribing ? "Transcribing..." : "Transcribe"}
            </ActionButton>
            <ActionButton onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>
              Download
            </ActionButton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 bg-primary flex flex-col items-center justify-start gap-6">
        <div className="w-full max-w-xl bg-tertiary rounded-2xl p-6 flex flex-col items-center gap-4 shadow-lg">
          <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
            <Music className="w-10 h-10 text-white" />
          </div>
          <button
            type="button"
            onClick={togglePlay}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-full transition-colors cursor-pointer shadow-button-primary"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? "Pause" : "Play"}
          </button>
          <audio
            key={audio.filename}
            ref={audioRef}
            src={src}
            controls
            className="w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          {audio.prompt && (
            <div className="w-full">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Prompt</p>
              <p className="text-sm text-secondary italic">{audio.prompt}</p>
            </div>
          )}
        </div>

        {transcript !== null && (
          <div className="w-full max-w-xl bg-tertiary rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Transcript</p>
              <button
                type="button"
                onClick={() => setTranscript(null)}
                className="text-muted hover:text-primary transition-colors"
                aria-label="Dismiss transcript"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">{transcript || "(empty transcript)"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
