import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useOptionalLayoutApi } from "../../layout/context.ts";
import { CHAT_VIEW } from "./ids.ts";

/**
 * Opens an agent's chat from anywhere: inside the current app when it shows
 * chats (it gets `/<app>/agent/<id>`), else in the Agents app (`/agent/<id>`).
 */
export function useOpenAgentChat(): (agentId: string) => void {
  const api = useOptionalLayoutApi();
  const navigate = useNavigate();
  return useCallback(
    (agentId: string) => {
      if (api?.app.views.includes(CHAT_VIEW)) api.open(CHAT_VIEW, { agentId });
      else void navigate(`/agent/${encodeURIComponent(agentId)}`);
    },
    [api, navigate],
  );
}
