import { Share2 } from "lucide-react";
import AgentLauncherApp from "../../components/AgentLauncherApp.tsx";

const PLATFORM_CARDS = [
  { name: "Reddit", color: "from-orange-500 to-red-600", description: "Browse and post to Reddit" },
  { name: "Discord", color: "from-accent to-violet-600", description: "Manage Discord servers and channels" },
  { name: "Slack", color: "from-purple-500 to-accent-hover", description: "Send messages and manage workspaces" },
  { name: "Telegram", color: "from-sky-500 to-blue-600", description: "Send messages via Telegram" },
  { name: "X / Twitter", color: "from-gray-700 to-gray-900", description: "Post and browse X (Twitter)" },
];

function PlatformGrid() {
  return (
    <div className="space-y-3">
      <p className="text-2xs font-bold text-muted uppercase tracking-widest px-1">Connected Platforms</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PLATFORM_CARDS.map(platform => (
          <div key={platform.name} className="flex items-center gap-3 px-4 py-3 bg-secondary border border-primary rounded-xl opacity-60">
            <div className={`w-8 h-8 rounded-lg bg-linear-to-br ${platform.color} shrink-0`} />
            <div>
              <p className="text-sm font-medium text-primary">{platform.name}</p>
              <p className="text-2xs text-muted">{platform.description}</p>
            </div>
            <span className="ml-auto text-2xs text-muted border border-primary px-2 py-0.5 rounded-full">Not configured</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SocialApp() {
  return (
    <AgentLauncherApp
      label="Social"
      description="Connect Reddit, Discord, Slack, Telegram, and X"
      icon={<Share2 />}
      gradient="from-blue-500 to-accent-hover"
      agentType="social"
      launchDescription="Launch a social agent to interact with Reddit, Discord, Slack, Telegram, and X through a unified conversational interface."
      launchLabel="Launch Social Agent"
      chrome={<PlatformGrid />}
    />
  );
}
