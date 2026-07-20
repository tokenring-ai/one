import formatError from "@tokenring-ai/utility/error/formatError";
import { Video as VideoIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { useVideoGenerationModels, videoGenerationRPCClient } from "../../../../rpc.ts";
import AspectRatioField from "./AspectRatioField.tsx";
import GenerateButton from "./GenerateButton.tsx";
import GeneratePanelShell from "./GeneratePanelShell.tsx";
import ModelSelectField from "./ModelSelectField.tsx";
import PromptField from "./PromptField.tsx";

export default function VideoGeneratePanel({ agentId, onGenerated }: { agentId: string | null; onGenerated: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<"square" | "tall" | "wide">("wide");
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
      await videoGenerationRPCClient.generateVideo({
        agentId,
        prompt: prompt.trim(),
        ...(selectedModel && { model: selectedModel }),
        aspectRatio,
        ...(duration > 0 && { duration }),
        keywords: prompt
          .trim()
          .split(/[,\s]+/)
          .filter(Boolean)
          .slice(0, 10),
      });
      toastManager.success("Video generated!", { duration: 3000 });
      setPrompt("");
      onGenerated();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      <AspectRatioField value={aspectRatio} onChange={setAspectRatio} />
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-secondary">Duration (seconds)</label>
        <input
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
