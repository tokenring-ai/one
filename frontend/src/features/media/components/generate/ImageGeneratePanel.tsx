import formatError from "@tokenring-ai/utility/error/formatError";
import { WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { imageGenerationRPCClient, useImageGenerationModels } from "../../../../rpc.ts";
import AspectRatioField from "./AspectRatioField.tsx";
import GenerateButton from "./GenerateButton.tsx";
import GeneratePanelShell from "./GeneratePanelShell.tsx";
import ModelSelectField from "./ModelSelectField.tsx";
import PromptField from "./PromptField.tsx";

export default function ImageGeneratePanel({ agentId, onGenerated }: { agentId: string | null; onGenerated: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<"square" | "tall" | "wide">("square");
  const [generating, setGenerating] = useState(false);
  const { data: modelsData } = useImageGenerationModels();

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
      await imageGenerationRPCClient.generateImage({
        agentId,
        prompt: prompt.trim(),
        ...(selectedModel && { model: selectedModel }),
        aspectRatio,
        keywords: prompt
          .trim()
          .split(/[,\s]+/)
          .filter(Boolean)
          .slice(0, 10),
      });
      toastManager.success("Image generated!", { duration: 3000 });
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
      title="Generate Image"
      subtitle="Describe the image you want to create"
      icon={<WandSparkles className="w-7 h-7 text-white" />}
      gradient="from-pink-500 to-rose-600"
    >
      <PromptField value={prompt} onChange={setPrompt} onKeyDown={handleKeyDown} placeholder="A serene mountain lake at sunset with reflections..." />
      <AspectRatioField value={aspectRatio} onChange={setAspectRatio} />
      <ModelSelectField label="Model" value={selectedModel} onChange={setModel} options={availableModels} />
      <GenerateButton onClick={() => void handleGenerate()} disabled={generating || !agentId || !prompt.trim()} loading={generating}>
        Generate Image
      </GenerateButton>
    </GeneratePanelShell>
  );
}
