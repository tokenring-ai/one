import type { AudioIndexEntry } from "@tokenring-ai/media-library/rpc/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Music, Pause, Play, Sparkles, Type, X } from "lucide-react";
import { useRef, useState } from "react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { audioRPCClient } from "../../../../rpc.ts";
import { formatDuration, mediaUrl } from "../../utils.ts";
import ActionButton from "./ActionButton.tsx";
import ViewerHeader from "./ViewerHeader.tsx";

export default function AudioViewer({
  audio,
  agentId,
  onWorkOnAudio,
  onClose,
}: {
  audio: AudioIndexEntry;
  agentId: string | null;
  onWorkOnAudio: () => Promise<void>;
  onClose: () => void;
}) {
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

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
      void el.play();
    } else {
      el.pause();
    }
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
            <ActionButton onClick={() => void onWorkOnAudio()} primary icon={<Sparkles className="w-3.5 h-3.5" />}>
              Work on this audio
            </ActionButton>
            <ActionButton
              onClick={() => void handleTranscribe()}
              disabled={transcribing}
              icon={transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Type className="w-3.5 h-3.5" />}
            >
              {transcribing ? "Transcribing..." : "Transcribe"}
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
            ref={audioRef}
            src={mediaUrl(audio.filename)}
            controls
            className="w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          {audio.prompt && (
            <div className="w-full">
              <p className="text-2xs font-medium text-muted uppercase tracking-wide mb-1">Prompt</p>
              <p className="text-sm text-secondary italic">{audio.prompt}</p>
            </div>
          )}
        </div>

        {transcript !== null && (
          <div className="w-full max-w-xl bg-tertiary rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xs font-medium text-muted uppercase tracking-wide">Transcript</p>
              <button type="button" onClick={() => setTranscript(null)} className="text-muted hover:text-primary transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">{transcript}</p>
          </div>
        )}
      </div>
    </div>
  );
}
