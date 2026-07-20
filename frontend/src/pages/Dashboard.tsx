import formatError from "@tokenring-ai/utility/error/formatError";
import {
  BookOpen,
  CalendarDays,
  Cpu,
  DollarSign,
  FileText,
  FolderOpen,
  GitBranch,
  Image,
  ListOrdered,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Package,
  PenTool,
  Plug,
  Search,
  Settings,
  Share2,
  Sparkles,
  Terminal,
  Timer,
  TrendingUp,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import CheckpointBrowser from "../components/CheckpointBrowser.tsx";
import AppCard, { type AppCardDef } from "../components/dashboard/AppCard.tsx";
import { useAgentList } from "../rpc.ts";

const APPS: AppCardDef[] = [
  {
    id: "agents",
    path: "/agents",
    label: "Agents",
    description: "Create and manage AI agents",
    icon: <Cpu />,
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "workflows",
    path: "/workflows",
    label: "Workflows",
    description: "Launch and monitor automated workflows",
    icon: <GitBranch />,
    gradient: "from-cyan-500 to-teal-600",
  },
  {
    id: "scheduler",
    path: "/scheduler",
    label: "Scheduler",
    description: "Schedule recurring agent tasks and monitor runs",
    icon: <Timer />,
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    id: "queue",
    path: "/queue",
    label: "Queue",
    description: "Dispatch work to typed agents and track results",
    icon: <ListOrdered />,
    gradient: "from-sky-500 to-blue-600",
  },
  {
    id: "skills",
    path: "/skills",
    label: "Skills",
    description: "Install, enable, and try agent skills",
    icon: <Sparkles />,
    gradient: "from-violet-500 to-fuchsia-600",
  },
  {
    id: "canvas",
    path: "/canvas",
    label: "Canvas",
    description: "Build interactive frontend code with agents",
    icon: <PenTool />,
    gradient: "from-purple-500 to-violet-600",
  },
  {
    id: "documents",
    path: "/documents",
    label: "Documents",
    description: "Write and edit documents with AI assistance",
    icon: <FileText />,
    gradient: "from-lime-500 to-green-600",
  },
  {
    id: "research",
    path: "/research",
    label: "Research",
    description: "Deep multi-file research reports with web search",
    icon: <Search />,
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    id: "blog",
    path: "/blog",
    label: "Blog",
    description: "Manage posts on Ghost, WordPress, and more",
    icon: <BookOpen />,
    gradient: "from-rose-500 to-pink-600",
  },
  {
    id: "files",
    path: "/files",
    label: "Files",
    description: "Browse and manage your filesystem",
    icon: <FolderOpen />,
    gradient: "from-accent to-blue-600",
  },
  {
    id: "terminal",
    path: "/terminal",
    label: "Terminal",
    description: "Interactive shell sessions powered by agents",
    icon: <Terminal />,
    gradient: "from-gray-600 to-slate-800",
  },
  {
    id: "email",
    path: "/email",
    label: "Email",
    description: "Read, compose, and manage emails",
    icon: <Mail />,
    gradient: "from-red-500 to-rose-600",
  },
  {
    id: "calendar",
    path: "/calendar",
    label: "Calendar",
    description: "Schedule events and manage your time",
    icon: <CalendarDays />,
    gradient: "from-sky-500 to-blue-600",
  },
  {
    id: "stocks",
    path: "/stocks",
    label: "Stocks",
    description: "Real-time quotes, charts, history, and news",
    icon: <TrendingUp />,
    gradient: "from-emerald-500 to-green-600",
  },
  {
    id: "media",
    path: "/media",
    label: "Media",
    description: "Generate and manage images, audio, and video",
    icon: <Image />,
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "social",
    path: "/social",
    label: "Social",
    description: "Connect Reddit, Discord, Slack, Telegram, and X",
    icon: <Share2 />,
    gradient: "from-blue-500 to-accent-hover",
  },
  {
    id: "messaging",
    path: "/messaging",
    label: "Messaging",
    description: "Unified inbox for all your messages",
    icon: <MessageSquare />,
    gradient: "from-emerald-500 to-green-600",
  },
  {
    id: "plugins",
    path: "/plugins",
    label: "Plugins",
    description: "Manage installed plugins and extensions",
    icon: <Package />,
    gradient: "from-fuchsia-500 to-pink-600",
  },
  {
    id: "services",
    path: "/services",
    label: "Services",
    description: "Tools, models, hooks, and integrations",
    icon: <Plug />,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "metrics",
    path: "/metrics",
    label: "Metrics",
    description: "Live cost tracking across agents and models",
    icon: <DollarSign />,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    description: "Configure theme, agents, and preferences",
    icon: <Settings />,
    gradient: "from-stone-500 to-gray-600",
  },
  {
    id: "vault",
    path: "/vault",
    label: "Vault",
    description: "Manage encrypted credentials and secrets",
    icon: <Lock />,
    gradient: "from-yellow-500 to-amber-600",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const activeCount = agents.data?.length ?? 0;
  const showAgentBadge = !agents.isLoading && !agents.error && activeCount > 0;

  // Inject live badges
  const appsWithBadges = APPS.map(app => {
    if (app.id === "agents" && showAgentBadge) {
      return { ...app, badge: String(activeCount) };
    }
    return app;
  });

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-primary text-2xl font-bold tracking-tight mb-1">TokenRing</h1>
            <p className="text-xs text-muted">AI-powered platform for agents, workflows, and automation</p>
          </div>

          {/* Live status bar */}
          <div className="flex items-center gap-4 px-4 py-3 bg-secondary border border-primary rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              {agents.isLoading ? (
                <>
                  <Loader2 className="w-3 h-3 text-muted animate-spin" />
                  <span className="text-xs text-muted">Loading agents…</span>
                </>
              ) : agents.error ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-xs text-warning" title={formatError(agents.error)}>
                    Unable to load agents
                  </span>
                </>
              ) : (
                <>
                  <div className={`w-2 h-2 rounded-full ${activeCount > 0 ? "bg-amber-500 animate-pulse" : "bg-tertiary"}`} />
                  <span className="text-xs text-primary font-medium">
                    {activeCount} active {activeCount === 1 ? "agent" : "agents"}
                  </span>
                </>
              )}
            </div>
            <div className="w-px h-4 bg-primary" />
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => navigate("/agents")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring shadow-button-primary"
            >
              <User className="w-3.5 h-3.5" />
              New Agent
            </button>
          </div>

          {/* App grid */}
          <div>
            <p className="text-2xs font-bold text-muted uppercase tracking-widest px-1 mb-3">Apps</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {appsWithBadges.map(app => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          </div>

          {/* Checkpoints */}
          <CheckpointBrowser agents={agents} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-primary bg-secondary px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-2xs text-muted">© {new Date().getFullYear()} TokenRing AI</span>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/tokenring-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs text-muted hover:text-primary transition-colors focus-ring cursor-pointer"
            >
              GitHub
            </a>
            <a
              href="https://tokenring.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs text-muted hover:text-primary transition-colors focus-ring cursor-pointer"
            >
              tokenring.ai
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
