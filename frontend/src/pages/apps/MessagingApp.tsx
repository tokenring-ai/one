import { MessageSquare } from "lucide-react";
import AgentLauncherApp from "../../components/AgentLauncherApp.tsx";

export default function MessagingApp() {
  return (
    <AgentLauncherApp
      label="Messaging"
      description="Unified inbox for all your messages"
      icon={<MessageSquare />}
      gradient="from-emerald-500 to-green-600"
      agentType="messaging"
      launchDescription="Launch a messaging agent for a unified inbox across email, Slack, Discord, and Telegram. Read, reply, and manage all your conversations in one place."
      launchLabel="Open Messaging"
    />
  );
}
