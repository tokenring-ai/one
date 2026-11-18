import { Eye, FileText, Sparkles } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import DocumentAiEditView from "./DocumentAiEditView.tsx";
import DocumentEditorView from "./DocumentEditorView.tsx";
import DocumentPreviewView from "./DocumentPreviewView.tsx";
import { DOCUMENT_AI_EDIT_VIEW, DOCUMENT_EDITOR_VIEW, DOCUMENT_PREVIEW_VIEW } from "./shared.tsx";

/**
 * Views of the Documents app. Every panel stays mounted while hidden: the
 * editor owns the textarea and caret, the AI panel owns the background writer agent.
 */
export const DOCUMENTS_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: DOCUMENT_EDITOR_VIEW,
    kind: "document",
    title: "Editor",
    description: "The markdown editor for the open document",
    icon: FileText,
    route: "",
    closable: false,
    component: DocumentEditorView,
  }),
  defineView({
    id: DOCUMENT_PREVIEW_VIEW,
    kind: "document-tool",
    title: "Preview",
    description: "Rendered markdown for the open document",
    icon: Eye,
    route: "preview",
    component: DocumentPreviewView,
  }),
  defineView({
    id: DOCUMENT_AI_EDIT_VIEW,
    kind: "document-tool",
    title: "AI edit",
    description: "Rewrite the selected text with a writer agent",
    icon: Sparkles,
    route: "ai",
    component: DocumentAiEditView,
  }),
];
