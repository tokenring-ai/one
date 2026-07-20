import { Navigate, useParams } from "react-router-dom";
import ChatPanel from "../components/chat/ChatPanel.tsx";

export default function ChatPage() {
  const { agentId } = useParams<{ agentId: string }>();

  if (!agentId) {
    return <Navigate to="/" replace />;
  }

  return <ChatPanel agentId={agentId} />;
}
