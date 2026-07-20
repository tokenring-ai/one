import formatError from "@tokenring-ai/utility/error/formatError";
import { Mic } from "lucide-react";
import { useMemo, useState } from "react";
import { toastManager } from "../../../../components/ui/toast.tsx";
import { audioRPCClient, useSpeechModels } from "../../../../rpc.ts";
import GenerateButton from "./GenerateButton.tsx";
import GeneratePanelShell from "./GeneratePanelShell.tsx";
import ModelSelectField from "./ModelSelectField.tsx";

export default function SpeechGeneratePanel({ agentId, onGenerated }: { agentId: string | null; onGenerated: () => void }) {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState<number>(1);
  const [model, setModel] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const { data: modelsData } = useSpeechModels();

  const availableModels = useMemo(() => {
    if (!modelsData) return [];
    return Object.entries(modelsData.models)
      .filter(([, m]) => m.available)
      .map(([name]) => name);
  }, [modelsData]);

  const selectedModel = model || availableModels[0] || "";

  const handleGenerate = async () => {
    if (!text.trim()) {
      toastManager.error("Please enter some text", { duration: 3000 });
      return;
    }
    if (!agentId) {
      toastManager.error("Agent not ready yet", { duration: 3000 });
      return;
    }
    setGenerating(true);
    try {
      const result = await audioRPCClient.generateSpeech({
        agentId,
        text: text.trim(),
        ...(voice && { voice }),
        ...(speed > 0 && { speed }),
        ...(selectedModel && { model: selectedModel }),
        keywords: text.trim().split(/\s+/).filter(Boolean).slice(0, 10),
      });
      if (result.status === "success") {
        toastManager.success("Speech generated!", { duration: 3000 });
        setText("");
        onGenerated();
      } else {
        toastManager.error("Agent not found", { duration: 4000 });
      }
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
      title="Generate Speech"
      subtitle="Convert text to spoken audio"
      icon={<Mic className="w-7 h-7 text-white" />}
      gradient="from-emerald-500 to-teal-600"
    >
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-secondary">Text</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hello, welcome to the TokenRing media studio..."
          rows={5}
          className="w-full bg-input border border-primary rounded-xl py-2.5 px-3 text-sm text-primary placeholder-muted focus-accent transition-all resize-none"
        />
        <p className="text-2xs text-muted text-right">⌘↵ to generate</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-secondary">Voice</label>
          <input
            type="text"
            value={voice}
            onChange={e => setVoice(e.target.value)}
            placeholder="alloy"
            className="w-full bg-input border border-primary rounded-lg py-2 px-3 text-sm text-primary placeholder-muted focus-accent transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-secondary">Speed</label>
          <input
            type="number"
            step={0.1}
            min={0.25}
            max={4}
            value={speed}
            onChange={e => setSpeed(Number(e.target.value) || 1)}
            className="w-full bg-input border border-primary rounded-lg py-2 px-3 text-sm text-primary focus-accent transition-all"
          />
        </div>
      </div>
      <ModelSelectField label="Model" value={selectedModel} onChange={setModel} options={availableModels} />
      <GenerateButton onClick={() => void handleGenerate()} disabled={generating || !agentId || !text.trim()} loading={generating}>
        Generate Speech
      </GenerateButton>
    </GeneratePanelShell>
  );
}
