import formatError from "@tokenring-ai/utility/error/formatError";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Lightbulb,
  Mail,
  Plug,
  Receipt,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { prefillChatInput } from "../../components/ChatInputContext.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useLocalStorageState, writeLocalStorageState } from "../../hooks/useLocalStorageState.ts";
import type { ViewProps } from "../../layout/define.ts";
import { usePaneLink, usePanel } from "../../layout/hooks.ts";
import { agentRPCClient, useAgentTypes, useChatModelsByProvider } from "../../rpc.ts";
import Button from "../../ui/button.tsx";
import IconButton from "../../ui/icon-button.tsx";
import { AGENTS_PATH, MARKETPLACE_PATH } from "../agents/shared.tsx";
import { CHAT_VIEW } from "../chat/ids.ts";
import { AI_PROVIDERS_PATH, CONFIGURATION_APP } from "../configuration/manifest.ts";

const CONFIGURATION_PATH = CONFIGURATION_APP.path;

/** The getting-started guide on the docs site (the same site the README points at). */
export const SETUP_GUIDE_URL = "https://docs.tokenring.ai/docs/getting-started";

export interface StarterTask {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: typeof Mail;
  /** The agent type the card starts. The card is hidden when the install has no such type. */
  agentType: string;
}

/** The writing assistant: needs no accounts, and its tools only touch files. */
const WRITER = "writer";
/** The calendar assistant (calendar_* tools); the calendar card asks it to read and plan, never to change anything. */
const CALENDAR = "calendar";

const DRAFT_ONLY = "This is only a draft for me to read and edit. Do not send anything to anyone.";

/**
 * First tasks a small-business owner can use at once. The text is prefilled, never sent: the person edits the
 * [bracketed] parts, then presses Send. Prompts that touch email or the calendar ask for a draft and forbid sending or changing anything.
 */
export const STARTER_TASKS: readonly StarterTask[] = [
  {
    id: "reply",
    title: "Reply to a customer's email",
    description: "Paste the email and get a friendly draft reply, in the language they wrote in.",
    prompt: `Please write a friendly, polite reply to the customer's message below. Write the reply in the same language the customer wrote in (for example English or Spanish), and tell me at the top which language you used. Keep it short, thank them, and answer every question they asked. If you need details from me first, such as prices or dates, ask me instead of guessing. ${DRAFT_ONLY}\n\nCustomer's message:\n[paste it here]`,
    icon: Mail,
    agentType: WRITER,
  },
  {
    id: "quote",
    title: "Write a quote for a job",
    description: "Describe the job and get a clear quote you can check and send yourself.",
    prompt: `Please write a clear, friendly quote for the job below. List what is included, the price for each part and a total, and say how long the quote is valid. Use only the numbers I give you. If a price or detail is missing, leave a [blank] for me to fill in and do not guess. ${DRAFT_ONLY}\n\nThe customer: [name]\nThe job: [describe the work]\nPrices and details: [what you will charge, dates, anything else]`,
    icon: Receipt,
    agentType: WRITER,
  },
  {
    id: "invoice-reminder",
    title: "Friendly reminder for an unpaid invoice",
    description: "Get a polite, firm note to a customer who has not paid yet.",
    prompt: `Please write a short, polite reminder to a customer about an invoice that has not been paid yet. Keep it friendly and respectful, say clearly what is owed and by when, and make it easy for them to reply. If the customer wrote to me in another language, write in that language. ${DRAFT_ONLY}\n\nCustomer: [name]\nInvoice: [number, amount, date it was due]\nHow they can pay: [for example check, bank transfer, card]`,
    icon: Bell,
    agentType: WRITER,
  },
  {
    id: "schedule",
    title: "Plan next week's crew schedule",
    description: "Reads your calendar and drafts a plan for you to review. It changes nothing.",
    prompt: `Please look at my calendar for next week and draft a schedule for my crews. Only read the calendar: do not create, move, change or delete any event, and do not invite anyone. Show me the draft here as a simple day-by-day list, point out any clashes or gaps, and ask me if you need to know which crew is available or where a job is.\n\nWhat has to get done next week: [jobs, places, who is available]`,
    icon: CalendarDays,
    agentType: CALENDAR,
  },
  {
    id: "summarise",
    title: "Summarise a document",
    description: "Turn a long text into a few clear points, with any deadlines.",
    prompt:
      "Summarise the text below in five short bullet points for a busy reader. Then list any decisions that need to be made and any dates or deadlines it mentions.\n\nThe text:\n[paste the text here]",
    icon: FileText,
    agentType: WRITER,
  },
  {
    id: "brainstorm",
    title: "Brainstorm options for a decision",
    description: "Describe a choice you are weighing and get options to compare.",
    prompt:
      "I need to make a decision and would like help thinking it through. Give me five realistic options, each with one advantage and one drawback. Then ask me two questions that would help me choose.\n\nThe decision:\n[describe what you are deciding]",
    icon: Lightbulb,
    agentType: WRITER,
  },
];

/**
 * What TokenRing asks about, as checked against the code: sending email, posting and publishing are safety
 * level 8 and always ask unless the person chose Always allow (or turned the automatic-approval setting up to 8
 * or more). Paid image, audio and video generation is level 5, which is below the default threshold, so it is NOT asked about.
 */
const ASK_FIRST_NOTE = 'TokenRing asks you before it sends an email, posts online or publishes, unless you have chosen "Always allow" for that.';

export const WELCOME_VIEW_ID = "welcome";
/** Per-browser dismissal; listed in CLIENT_PREFERENCE_KEYS so Clear local preferences brings it back. */
export const WELCOME_DISMISSED_KEY = "tokenring-welcome-dismissed";

type ProviderRecord = Record<string, Record<string, { available: boolean }>>;

/** How many providers and models are reachable right now. */
export function summarizeProviders(modelsByProvider: ProviderRecord | undefined): { providers: number; onlineProviders: number; onlineModels: number } {
  let onlineProviders = 0;
  let onlineModels = 0;
  const entries = Object.values(modelsByProvider ?? {});
  for (const models of entries) {
    const available = Object.values(models).filter(model => model.available).length;
    if (available > 0) onlineProviders++;
    onlineModels += available;
  }
  return { providers: entries.length, onlineProviders, onlineModels };
}

const linkClass =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-primary text-primary bg-tertiary hover:bg-hover transition-colors focus-ring";
const primaryLinkClass =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors focus-ring";

function ProviderStatus({ models, summary }: { models: ReturnType<typeof useChatModelsByProvider>; summary: ReturnType<typeof summarizeProviders> }) {
  if (models.isLoading && !models.data) return <LoadingState size="sm" message="Checking AI providers…" />;

  if (models.error && !models.data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5" role="alert">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-medium text-primary">Could not check AI providers</p>
          <p className="text-xs text-muted">{formatError(models.error)}</p>
          <Button variant="secondary" onClick={() => void models.mutate()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (summary.onlineModels === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5" data-testid="welcome-no-provider">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-medium text-primary">No AI service is connected yet</p>
          <p className="text-xs text-muted">
            {summary.providers === 0
              ? "The assistants in TokenRing need an AI service to think with. Connect one by pasting a key from your OpenAI or Anthropic account (a key is a long password that lets TokenRing use your account), or use an AI that runs on your own computer."
              : `${summary.providers} AI provider${summary.providers === 1 ? " is" : "s are"} set up but none can be reached. Check the key or address you entered.`}
          </p>
          <Link to={AI_PROVIDERS_PATH} className={primaryLinkClass}>
            <Plug className="w-3.5 h-3.5" aria-hidden="true" />
            Connect an AI service
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-primary bg-secondary px-3 py-2.5" data-testid="welcome-provider-ready">
      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-success" aria-hidden="true" />
      <p className="text-xs text-primary">
        You are connected: {summary.onlineModels} AI model{summary.onlineModels === 1 ? "" : "s"} ready from {summary.onlineProviders} provider
        {summary.onlineProviders === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

/** First tasks. Each starts its assistant and opens its chat with the request typed in, unsent. */
function StarterTasks() {
  const types = useAgentTypes();
  const openPane = usePaneLink();
  const [starting, setStarting] = useState<string | null>(null);
  const installed = new Set(types.data?.map(type => type.type));
  const tasks = STARTER_TASKS.filter(task => installed.has(task.agentType));
  if (tasks.length === 0) return null;

  const start = async (task: StarterTask) => {
    setStarting(task.id);
    try {
      const { id } = await agentRPCClient.createAgent({ agentType: task.agentType });
      // Before opening the chat, so its composer starts with the text.
      prefillChatInput(id, task.prompt);
      openPane(CHAT_VIEW, { agentId: id });
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setStarting(null);
    }
  };

  return (
    <section className="space-y-2" aria-label="Try your first task" data-testid="welcome-starter-tasks">
      <div>
        <h3 className="text-xs font-semibold text-primary">Try your first task</h3>
        <p className="text-xs text-muted mt-0.5">Pick one. A chat opens with the request already typed. Edit it, then press Send.</p>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {tasks.map(task => {
          const Icon = task.icon;
          return (
            <li key={task.id}>
              <button
                type="button"
                disabled={starting !== null}
                onClick={() => void start(task)}
                aria-label={task.title}
                className="w-full h-full min-h-11 flex items-start gap-2 px-2.5 py-2.5 rounded-lg border border-primary bg-secondary text-left hover:border-accent/50 hover:bg-hover focus-ring disabled:opacity-60"
              >
                <Icon className="mt-0.5 w-3.5 h-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-primary">{task.title}</span>
                  <span className="block text-[11px] text-muted">{task.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * First-run guide on Home: whether a model provider is reachable (nothing
 * works until one is), and where to go next. Dismissal is per browser.
 */
export default function WelcomeView(_props: ViewProps) {
  const panel = usePanel();
  const models = useChatModelsByProvider();
  const summary = useMemo(() => summarizeProviders(models.data?.modelsByProvider), [models.data]);
  const [dismissed, setDismissed] = useLocalStorageState<boolean>(WELCOME_DISMISSED_KEY, false);

  if (dismissed) {
    return (
      <ViewShell pad="compact">
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-muted">The welcome guide is hidden in this browser.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDismissed(false)}>
              Show it again
            </Button>
            <Button variant="ghost" icon={X} onClick={() => panel.close()}>
              Close panel
            </Button>
          </div>
        </div>
      </ViewShell>
    );
  }

  return (
    <ViewShell pad="compact">
      <section className="space-y-3" aria-label="Welcome to TokenRing">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-primary">Welcome to TokenRing</h2>
            <p className="text-xs text-muted mt-0.5">
              AI assistants for writing, documents, research, design and code. They run on your own computer and share one set of settings.
            </p>
          </div>
          <IconButton
            variant="ghost"
            icon={X}
            label="Dismiss welcome"
            onClick={() => {
              // Written directly: closing unmounts this view before a state updater would persist it.
              writeLocalStorageState(WELCOME_DISMISSED_KEY, true);
              panel.close();
            }}
          />
        </div>

        <ProviderStatus models={models} summary={summary} />

        {summary.onlineModels > 0 && <StarterTasks />}

        <p className="flex items-start gap-2 text-xs text-muted" data-testid="welcome-ask-first">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" aria-hidden="true" />
          <span>
            {ASK_FIRST_NOTE}{" "}
            <Link to={`${CONFIGURATION_PATH}/permissions`} className="text-accent-soft hover:underline focus-ring rounded">
              See what is allowed
            </Link>
          </span>
        </p>

        <div className="flex flex-wrap gap-2">
          <a href={SETUP_GUIDE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            Setup guide
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <Link to={AGENTS_PATH} className={linkClass}>
            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
            Open Agents
          </Link>
          <Link to={MARKETPLACE_PATH} className={linkClass}>
            <Store className="w-3.5 h-3.5" aria-hidden="true" />
            Browse marketplace
          </Link>
          <Link to={CONFIGURATION_PATH} className={linkClass}>
            <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
            Configuration
          </Link>
        </div>
      </section>
    </ViewShell>
  );
}
