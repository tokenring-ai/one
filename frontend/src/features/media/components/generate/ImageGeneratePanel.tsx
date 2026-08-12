import formatError from "@tokenring-ai/utility/error/formatError";
import { WandSparkles } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import GenerateButton from "../../../../components/ui/GenerateButton.tsx";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { imageGenerationRPCClient, useImageGenerationModels } from "../../../../rpc.ts";
import { keywordsFromPrompt } from "../../utils.ts";
import GeneratePanelShell from "./GeneratePanelShell.tsx";
import ImageQualityField, { type ImageQuality } from "./ImageQualityField.tsx";
import ImageShapeField, { type ImageShape } from "./ImageShapeField.tsx";
import ModelSelectField from "./ModelSelectField.tsx";
import PromptField from "./PromptField.tsx";

export default function ImageGeneratePanel({ agentId, onGenerated }: { agentId: string | null; onGenerated: (filename?: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>("");
  const [shape, setShape] = useState<ImageShape>("square");
  const [quality, setQuality] = useState<ImageQuality>("standard");
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
      const result = await imageGenerationRPCClient.generateImage({
        agentId,
        ...(selectedModel && { model: selectedModel }),
        request: {
          prompt: prompt.trim(),
          sizing: {
            method: "guided",
            quality,
            shape,
          },
          keywords: keywordsFromPrompt(prompt),
        },
      });
      if (result.status === "success") {
        const fileName = result.results[0]?.fileName;
        if (!fileName) {
          toastManager.error("Image generation returned no files", { duration: 4000 });
          onGenerated();
          return;
        }
        toastManager.success(`Image generated: ${fileName}`, { duration: 3000 });
        setPrompt("");
        onGenerated(fileName);
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
      title="Generate Image"
      subtitle="Describe the image you want to create"
      icon={<WandSparkles className="w-7 h-7 text-white" />}
      gradient="from-pink-500 to-rose-600"
    >
      <PromptField value={prompt} onChange={setPrompt} onKeyDown={handleKeyDown} placeholder="A serene mountain lake at sunset with reflections..." />
      <ImageShapeField value={shape} onChange={setShape} />
      <ImageQualityField value={quality} onChange={setQuality} />
      <ModelSelectField label="Model" value={selectedModel} onChange={setModel} options={availableModels} />
      <GenerateButton
        onClick={() => void handleGenerate()}
        disabled={generating || !agentId || !prompt.trim() || (modelsData != null && availableModels.length === 0)}
        loading={generating}
      >
        Generate Image
      </GenerateButton>
    </GeneratePanelShell>
  );
}
