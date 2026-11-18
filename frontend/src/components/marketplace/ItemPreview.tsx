import { toDraft } from "@tokenring-ai/one-frontend/features/agents/agentDraft.ts";
import { formatStepLabel, type WorkflowStep } from "@tokenring-ai/one-frontend/features/workflows/commandStep.ts";
import type { MarketplaceKind } from "./marketplaceItems.ts";

function Section({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">{title}</h2>
        {meta && <span className="text-xs text-muted">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="max-h-96 overflow-auto bg-tertiary border border-primary rounded-lg p-3 text-xs font-mono text-secondary whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Chips({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) return <p className="text-xs text-muted italic">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map(value => (
        <span key={value} className="px-2 py-1 bg-secondary border border-primary rounded-md text-xs font-mono text-secondary">
          {value}
        </span>
      ))}
    </div>
  );
}

/** An ordered list of steps, shared by the tool and workflow previews. */
function StepList({ steps }: { steps: string[] }) {
  if (steps.length === 0) return <p className="text-xs text-muted italic">No steps defined.</p>;
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => (
        // Steps have no ids and may repeat, so the index is the only stable key available.
        <li key={index} className="flex gap-2.5 min-w-0">
          <span className="shrink-0 w-5 h-5 mt-px rounded-full bg-tertiary text-muted text-xs font-mono flex items-center justify-center tabular-nums">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 text-xs text-secondary leading-relaxed whitespace-pre-wrap break-words">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function AgentPreview({ item }: { item: Record<string, unknown> }) {
  const draft = toDraft(item);
  return (
    <>
      <Section title="Enabled tools" meta={`${draft.enabledTools.length} configured`}>
        <Chips values={draft.enabledTools} empty="No tools are enabled for this agent." />
      </Section>
      {draft.systemPrompt && (
        <Section title="System prompt">
          <CodeBlock>{draft.systemPrompt}</CodeBlock>
        </Section>
      )}
    </>
  );
}

function ToolPreview({ item }: { item: Record<string, unknown> }) {
  const agentType = typeof item.agentType === "string" ? item.agentType : "";
  const inputArguments = (item.inputArguments ?? {}) as Record<string, { description?: string; defaultValue?: string }>;
  const steps = Array.isArray(item.steps) ? item.steps.filter((step): step is string => typeof step === "string") : [];
  const argumentEntries = Object.entries(inputArguments);

  return (
    <>
      <Section title="Runs agent">
        <Chips values={agentType ? [agentType] : []} empty="This tool does not name an agent." />
        {agentType && <p className="text-xs text-muted">Install the {agentType} agent under this name, or the tool will not run.</p>}
      </Section>

      <Section title="Input arguments" meta={`${argumentEntries.length} argument${argumentEntries.length === 1 ? "" : "s"}`}>
        {argumentEntries.length === 0 ? (
          <p className="text-xs text-muted italic">This tool takes no arguments.</p>
        ) : (
          <dl className="space-y-2">
            {argumentEntries.map(([name, argument]) => (
              <div key={name} className="min-w-0">
                <dt className="flex items-baseline gap-2 min-w-0">
                  <code className="text-xs font-mono font-semibold text-primary">{name}</code>
                  {argument.defaultValue !== undefined && <span className="text-xs text-muted truncate">default: {argument.defaultValue || "(empty)"}</span>}
                </dt>
                <dd className="text-xs text-secondary leading-relaxed">{argument.description || "No description provided."}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section title="Steps" meta={`${steps.length} step${steps.length === 1 ? "" : "s"}`}>
        <StepList steps={steps} />
      </Section>
    </>
  );
}

function WorkflowPreview({ item }: { item: Record<string, unknown> }) {
  const agentType = typeof item.agentType === "string" ? item.agentType : "";
  const rawSteps = Array.isArray(item.steps) ? (item.steps as WorkflowStep[]) : [];
  // Command steps are objects; formatStepLabel renders them the way the workflow editor does.
  const steps = rawSteps.map(formatStepLabel);

  return (
    <>
      <Section title="Runs as agent">
        <Chips values={agentType ? [agentType] : []} empty="This workflow does not name an agent." />
        {agentType && <p className="text-xs text-muted">Install the {agentType} agent under this name, or the workflow will not start.</p>}
      </Section>

      <Section title="Steps" meta={`${steps.length} step${steps.length === 1 ? "" : "s"}`}>
        <StepList steps={steps} />
      </Section>
    </>
  );
}

function SkillPreview({ item }: { item: Record<string, unknown> }) {
  const body = typeof item.body === "string" ? item.body : "";
  const argumentHint = typeof item.argumentHint === "string" ? item.argumentHint : "";
  const agent = typeof item.agent === "string" ? item.agent : "";
  const context = typeof item.context === "string" ? item.context : "";
  const userInvocable = item.userInvocable !== false;
  const details = [
    userInvocable ? "User invocable" : "Not user invocable",
    ...(argumentHint ? [`Arguments: ${argumentHint}`] : []),
    ...(context ? [`Context: ${context}`] : []),
    ...(agent ? [`Agent: ${agent}`] : []),
  ];

  return (
    <>
      <Section title="Invocation">
        <Chips values={details} empty="No invocation options." />
      </Section>
      <Section title="Instructions">{body ? <CodeBlock>{body}</CodeBlock> : <p className="text-xs text-muted italic">No instructions.</p>}</Section>
    </>
  );
}

/**
 * What an item actually does, rendered per kind: an agent's prompt and tools, a tool's arguments and
 * steps, a workflow's agent and steps, a skill's instructions. This is the one place in the
 * marketplace UI that reads the item body, which is why it is the one place that branches on kind.
 */
export default function ItemPreview({ kind, item }: { kind: MarketplaceKind; item: Record<string, unknown> }) {
  switch (kind) {
    case "agent":
      return <AgentPreview item={item} />;
    case "tool":
      return <ToolPreview item={item} />;
    case "workflow":
      return <WorkflowPreview item={item} />;
    case "skill":
      return <SkillPreview item={item} />;
  }
}
