import { Share2 } from "lucide-react";
import AgentLauncherApp from "../../components/AgentLauncherApp.tsx";
import SocialPlatforms from "../../features/social/SocialPlatforms.tsx";

export default function SocialApp() {
  return (
    <AgentLauncherApp
      label="Social"
      description="Connect messaging platforms, manage bots, and launch a social agent"
      icon={<Share2 />}
      gradient="from-blue-500 to-accent-hover"
      agentType="social"
      launchDescription="Launch a social agent to draft posts, manage conversations, and work across Slack, Telegram, and other connected platforms through a unified chat interface."
      launchLabel="Launch Social Agent"
      chrome={<SocialPlatforms />}
    />
  );
}
