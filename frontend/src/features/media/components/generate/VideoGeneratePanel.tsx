import formatError from "@tokenring-ai/utility/error/formatError";
import { Video as VideoIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { useVideoGenerationModels, videoGenerationRPCClient } from "../../../../rpc.ts";
import { keywordsFromPrompt } from "../../utils.ts";
import GenerateButton from "./GenerateButton.tsx";
import GeneratePanelShell from "./GeneratePanelShell.tsx";
import ImageShapeField, { type ImageShape } from "./ImageShapeField.tsx";
import ModelSelectField from "./ModelSelectField.tsx";
import PromptField from "./PromptField.tsx";
import VideoQualityField, { type VideoQuality } from "./VideoQualityField.tsx";

export default function VideoGeneratePanel({ agentId, onGenerated }: { agentId: string | null; onGenerated: (filename?: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>("");
  const [shape, setShape] = useState<ImageShape>("landscape");
  const [quality, setQuality] = useState<VideoQuality>("standard");
  const [duration, setDuration] = useState<number>(5);
  const [generating, setGenerating] = useState(false);
  const { data: modelsData } = useVideoGenerationModels();

  const availableModels = useMemo(() => {
    if (!modelsData) return [];
    return Object.entries(modelsData.models)
      .filter(([, m]) => m.available)
      .map(([name]) => name);
  }, [modelsData]);

  const selectedModel = model || availableModels[0] || "";

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toastManager.error("Please enter a prompt", { duration: 3000 });
      return;
    }
    if (!agentId) {
      toastManager.error("Agent not ready yet", { duration: 3000 });
      return;
    }
    setGenerating(true);
    try {
      const result = await videoGenerationRPCClient.generateVideo({
        agentId,
        ...(selectedModel && { model: selectedModel }),
        request: {
          prompt: prompt.trim(),
          sizing: {
            method: "guided",
            quality,
            shape,
          },
          ...(duration > 0 && { duration }),
          keywords: keywordsFromPrompt(prompt),
        },
      });
      if (result.status === "success") {
        toastManager.success(result.filename ? `Video generated: ${result.filename}` : "Video generated!", { duration: 3000 });
        setPrompt("");
        onGenerated(result.filename);
      } else {
        toastManager.error("Agent not found", { duration: 4000 });
      }
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleGenerate();
  };

  return (
    <GeneratePanelShell
      title="Generate Video"
      subtitle="Describe the video clip you want to create"
      icon={<VideoIcon className="w-7 h-7 text-white" />}
      gradient="from-purple-500 to-accent-hover"
    >
      <PromptField value={prompt} onChange={setPrompt} onKeyDown={handleKeyDown} placeholder="A drone shot flying over a misty forest at dawn..." />
      <ImageShapeField value={shape} onChange={setShape} />
      <VideoQualityField value={quality} onChange={setQuality} />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-secondary" htmlFor="video-duration">
          Duration (seconds)
        </label>
        <input
          id="video-duration"
          type="number"
          min={1}
          max={60}
          value={duration}
          onChange={e => setDuration(Number(e.target.value) || 0)}
          className="w-full bg-input border border-primary rounded-lg py-2 px-3 text-sm text-primary focus-accent transition-all"
        />
      </div>
      <ModelSelectField label="Model" value={selectedModel} onChange={setModel} options={availableModels} />
      <GenerateButton onClick={() => void handleGenerate()} disabled={generating || !agentId || !prompt.trim()} loading={generating}>
        Generate Video
      </GenerateButton>
    </GeneratePanelShell>
  );
}
