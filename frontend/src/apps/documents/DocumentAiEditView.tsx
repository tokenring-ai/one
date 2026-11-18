import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import MissingAgentTypeNotice from "../../features/agents/MissingAgentTypeNotice.tsx";
import AIEditPanel from "../../features/documents/components/AIEditPanel.tsx";
import { applyEditToSelection, setAiPrompt, useDocumentsState } from "../../features/documents/documentsStore.ts";
import { useAIEdit } from "../../features/documents/hooks/useAIEdit.ts";
import { useBackgroundAgent } from "../../hooks/useBackgroundAgent.ts";
import { WRITER_AGENT_TYPE } from "./shared.tsx";

/**
 * AI editing for the selected text.
 *
 * This is the only panel that owns an agent: `useBackgroundAgent` creates one on
 * mount and tears it down on unmount, so exactly one view may call it.
 */
export default function DocumentAiEditView() {
  const { content, selection, aiPrompt, aiFocusNonce } = useDocumentsState();
  const {
    agentId,
    initialising,
    error: initError,
    missingType,
  } = useBackgroundAgent({
    appName: "Documents app",
    preferredTypes: [WRITER_AGENT_TYPE],
    // Rewriting prose with a coding agent is not what the user asked for; explain instead.
    requirePreferred: true,
    noTypesMessage: `No "${WRITER_AGENT_TYPE}" agent type is configured`,
    onError: message => toastManager.error(`AI editing unavailable: ${message}`, { duration: 5000 }),
  });
  // The writer agent's chat opens beside the document (without stealing focus).
  const { loading, response, sendEdit, cancel, clear } = useAIEdit(agentId);

  const resetAI = useCallback(() => {
    cancel();
    clear();
  }, [cancel, clear]);

  // Drop in-flight or prior results when the selection range or text changes.
  const selectionIdentity = selection ? `${selection.start}:${selection.end}:${selection.text}` : null;
  const previousIdentity = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousIdentity.current;
    previousIdentity.current = selectionIdentity;
    if (previous === selectionIdentity) return;
    // First selection from nothing: only clear on a subsequent change or clear.
    if (previous === null && selectionIdentity !== null) return;
    resetAI();
  }, [selectionIdentity, resetAI]);

  const applyResponse = useCallback(() => {
    if (response === null || !selection) return;
    // The editor may have moved on since the selection was taken; refuse rather
    // than splice the suggestion into the wrong place.
    if (content.slice(selection.start, selection.end) !== selection.text) {
      toastManager.error("Document changed since the selection was made. Select the text again and re-run AI edit.", { duration: 4000 });
      return;
    }
    applyEditToSelection(response, selection);
    clear();
    // The editor performs the edit and confirms it (with an undo hint when it could).
  }, [clear, content, response, selection]);

  const submit = useCallback(async () => {
    if (!selection || !aiPrompt.trim()) return;
    await sendEdit(selection.text, aiPrompt.trim());
  }, [aiPrompt, selection, sendEdit]);

  return (
    <ViewShell
      scroll={false}
      header={<ViewHeader icon={Sparkles} title="AI edit" subtitle={selection ? `${selection.end - selection.start} chars selected` : "Select text to edit"} />}
    >
      <div className="h-full min-h-0 flex flex-col">
        {/* The panel renders the init error itself; only the missing-type case gets the richer notice. */}
        <AIEditPanel
          selection={selection}
          agentId={agentId}
          initError={initError}
          initialising={initialising}
          unavailableNotice={missingType ? <MissingAgentTypeNotice agentType={WRITER_AGENT_TYPE} feature="AI editing" className="max-w-sm" /> : undefined}
          focusNonce={aiFocusNonce}
          prompt={aiPrompt}
          onPromptChange={setAiPrompt}
          loading={loading}
          response={response}
          onSubmit={submit}
          onCancel={cancel}
          onApply={applyResponse}
          onClearResponse={clear}
        />
      </div>
    </ViewShell>
  );
}
