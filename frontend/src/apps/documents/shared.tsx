/** Vocabulary for the Documents app. */

export const DOCUMENTS_PATH = "/documents";

export const DOCUMENT_EDITOR_VIEW = "document-editor";
export const DOCUMENT_PREVIEW_VIEW = "document-preview";
export const DOCUMENT_AI_EDIT_VIEW = "document-ai-edit";

export const DISCARD_DIALOG = {
  dialog: {
    title: "Unsaved changes",
    message: "You have unsaved changes. Discard them and continue?",
    confirmLabel: "Discard",
  },
} as const;

/** The agent type AI editing runs on. It is not bundled; the AI panel explains how to get one. */
export const WRITER_AGENT_TYPE = "writer";
