import { Eye } from "lucide-react";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import MarkdownPreview from "../../features/documents/components/MarkdownPreview.tsx";
import { useDocumentsState } from "../../features/documents/documentsStore.ts";

/** Rendered markdown for the open document. */
export default function DocumentPreviewView() {
  const { content } = useDocumentsState();
  return (
    <ViewShell scroll={false} header={<ViewHeader icon={Eye} title="Preview" />}>
      <div className="h-full min-h-0 flex flex-col">
        <MarkdownPreview content={content} />
      </div>
    </ViewShell>
  );
}
