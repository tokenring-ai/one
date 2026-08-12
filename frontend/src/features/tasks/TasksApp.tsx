import formatError from "@tokenring-ai/utility/error/formatError";
import { ExternalLink, ListChecks, Loader2, Play, RotateCcw, Save, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ConfirmModal from "../../components/ui/ConfirmModal.tsx";
import CreateItemModal from "../../components/ui/CreateItemModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LaunchButton from "../../components/ui/LaunchButton.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SaveAsModal from "../../components/ui/SaveAsModal.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useExpandedSet } from "../../hooks/useExpandedSet.ts";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { tasksRPCClient, useTaskConfiguration, useTaskLists, useTaskRuns } from "../../rpc.ts";
import TaskEditor from "./TaskEditor.tsx";
import { ActiveRunPanel, TaskRunHistory } from "./TaskRunPanel.tsx";
import TaskSidebar from "./TaskSidebar.tsx";
import { TaskStatusBadge } from "./taskStatus.tsx";
import {
  isRunActive,
  isSameDraft,
  type Task,
  type TaskBatch,
  type TaskDraft,
  type TaskListSummary,
  type TaskPriority,
  type TaskRun,
  type TaskStatus,
  toDraft,
} from "./types.ts";

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const NAME_ERROR = "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.";

/** Newest first, with anything still running pinned to the top. */
function sortRunsNewestFirst(runs: TaskRun[]): TaskRun[] {
  return [...runs].sort((a, b) => {
    const aActive = isRunActive(a);
    const bActive = isRunActive(b);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt);
  });
}

export default function TasksApp() {
  const navigate = useNavigate();
  const { listName: routeList, taskName: routeTask } = useParams<{ listName?: string; taskName?: string }>();
  const [theme] = useTheme();

  const configuration = useTaskConfiguration();
  const taskLists = useTaskLists();
  const taskRuns = useTaskRuns();

  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [savedTask, setSavedTask] = useState<Task | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [runningList, setRunningList] = useState<string | null>(null);

  const [newListOpen, setNewListOpen] = useState(false);
  const [newTaskFor, setNewTaskFor] = useState<string | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<{ list: string; name: string } | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<string | null>(null);

  const lists = (taskLists.data?.lists ?? []) as TaskListSummary[];
  const config = configuration.data;
  const allRuns = useMemo(() => sortRunsNewestFirst((taskRuns.data?.runs ?? []) as TaskRun[]), [taskRuns.data]);
  const batches = (taskRuns.data?.batches ?? []) as TaskBatch[];
  const activeRuns = useMemo(() => allRuns.filter(isRunActive), [allRuns]);

  const { expandedIds: expandedLists, toggle: toggleList, expand: expandList, collapse: collapseList } = useExpandedSet();

  const selected = routeList && routeTask ? { list: routeList, name: routeTask } : null;
  const selectedKey = selected ? `${selected.list}/${selected.name}` : null;

  const selectedRuns = useMemo(() => (selected ? allRuns.filter(run => run.list === selected.list && run.name === selected.name) : []), [allRuns, selected]);
  const featuredRun = selectedRuns[0] ?? null;
  const historyRuns = useMemo(() => selectedRuns.filter(run => run.id !== featuredRun?.id).slice(0, 10), [selectedRuns, featuredRun]);

  const isDirty = draft !== null && savedTask !== null && !isSameDraft(draft, toDraft(savedTask));

  // Load whatever the URL points at.
  const loadTask = useCallback(async (list: string, name: string) => {
    const key = `${list}/${name}`;
    setIsLoadingTask(true);
    setLoadError(null);
    try {
      const { task } = (await tasksRPCClient.getTask({ list, name })) as { task: Task | null };
      if (!task) {
        setLoadError(`Task "${key}" not found`);
        setSavedTask(null);
        setDraft(null);
        return;
      }
      setSavedTask(task);
      setDraft(toDraft(task));
      setLoadedKey(key);
    } catch (error) {
      setLoadError(formatError(error));
    } finally {
      setIsLoadingTask(false);
    }
  }, []);

  if (selectedKey && selectedKey !== loadedKey && !isLoadingTask && loadError === null) {
    void loadTask(selected!.list, selected!.name);
  }

  const refreshLists = useCallback(() => {
    toastOnReject(Promise.resolve(taskLists.mutate()), { message: err => `Failed to refresh task lists: ${formatError(err)}`, duration: 4000 });
  }, [taskLists]);

  const handleSelectTask = useCallback(
    (list: string, name: string) => {
      if (isDirty && !window.confirm("Discard unsaved changes to this task?")) return;
      setLoadedKey(null);
      setLoadError(null);
      void navigate(`/tasks/${encodeURIComponent(list)}/${encodeURIComponent(name)}`);
    },
    [isDirty, navigate],
  );

  const handleSave = useCallback(async () => {
    if (!draft || !selected || !savedTask) return;
    setIsSaving(true);
    try {
      const { task } = (await tasksRPCClient.updateTask({
        list: selected.list,
        name: selected.name,
        task: draft,
        expectedUpdatedAt: savedTask.updatedAt,
      })) as { task: Task };
      setSavedTask(task);
      setDraft(toDraft(task));
      refreshLists();
      toastManager.success("Saved", { duration: 2000 });
    } catch (error) {
      const message = formatError(error);
      toastManager.error(message.includes("changed on disk") ? `${message} — reload to see the newer version.` : message, { duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  }, [draft, selected, savedTask, refreshLists]);

  useKeyboardShortcuts([{ key: "s", handler: () => void handleSave() }]);

  const handleCreateTask = useCallback(
    async (list: string, name: string) => {
      try {
        await tasksRPCClient.createTask({ list, name, task: { body: "" } });
        setNewTaskFor(null);
        expandList(list);
        refreshLists();
        setLoadedKey(null);
        setLoadError(null);
        void navigate(`/tasks/${encodeURIComponent(list)}/${encodeURIComponent(name)}`);
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [expandList, navigate, refreshLists],
  );

  const handleCreateList = useCallback(
    async (name: string) => {
      try {
        await tasksRPCClient.createTaskList({ name });
        setNewListOpen(false);
        expandList(name);
        refreshLists();
        toastManager.success(`Task list "${name}" created`, { duration: 2000 });
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [expandList, refreshLists],
  );

  const handleDeleteTask = useCallback(
    async (list: string, name: string) => {
      setDeleteTaskTarget(null);
      try {
        const { success } = await tasksRPCClient.deleteTask({ list, name });
        if (!success) throw new Error(`Task "${list}/${name}" could not be deleted`);
        if (selectedKey === `${list}/${name}`) {
          setSavedTask(null);
          setDraft(null);
          setLoadedKey(null);
          void navigate("/tasks");
        }
        refreshLists();
        toastManager.success("Task deleted", { duration: 2000 });
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [navigate, refreshLists, selectedKey],
  );

  const handleDeleteList = useCallback(
    async (list: string) => {
      setDeleteListTarget(null);
      try {
        const { success } = await tasksRPCClient.deleteTaskList({ name: list });
        if (!success) throw new Error(`Task list "${list}" could not be deleted`);
        collapseList(list);
        if (selected?.list === list) {
          setSavedTask(null);
          setDraft(null);
          setLoadedKey(null);
          void navigate("/tasks");
        }
        refreshLists();
        toastManager.success("Task list deleted", { duration: 2000 });
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [collapseList, navigate, refreshLists, selected],
  );

  const handleRunTask = useCallback(async (list: string, name: string) => {
    setRunningTask(`${list}/${name}`);
    try {
      await tasksRPCClient.runTask({ list, name, headless: true });
      toastManager.success(`Started ${list}/${name}`, { duration: 2500 });
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setRunningTask(null);
    }
  }, []);

  const handleRunList = useCallback(
    async (list: string) => {
      setRunningList(list);
      try {
        const pending = lists.find(entry => entry.name === list)?.statusCounts.pending ?? 0;
        const { tasks } = (await tasksRPCClient.listTasks({ list, status: "pending" })) as { tasks: { name: string }[] };
        if (tasks.length === 0) {
          toastManager.info(`No pending tasks in "${list}"`, { duration: 3000 });
          return;
        }
        await tasksRPCClient.runTasks({ list, names: tasks.map(task => task.name), headless: true });
        expandList(list);
        toastManager.success(`Started ${pending} task${pending === 1 ? "" : "s"} from "${list}"`, { duration: 2500 });
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setRunningList(null);
      }
    },
    [expandList, lists],
  );

  const handleCancelRun = useCallback(async (runId: string) => {
    try {
      await tasksRPCClient.cancelRun({ runId });
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  }, []);

  const openAgent = useCallback((agentId: string) => void navigate(`/agent/${agentId}`), [navigate]);

  const activeBatch = useMemo(() => {
    const running = batches.find(batch => batch.finishedAt === null);
    if (!running) return null;
    const runs = allRuns.filter(run => run.batchId === running.id);
    return { batch: running, done: runs.filter(run => !isRunActive(run)).length, total: runs.length };
  }, [batches, allRuns]);

  const mainPane = () => {
    if (selected && loadError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-primary text-center">
          <p className="text-xs text-red-500 max-w-md">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              void navigate("/tasks");
            }}
            className="px-3 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            Back to tasks
          </button>
        </div>
      );
    }

    if (selected && (isLoadingTask || !draft)) {
      return <LoadingState message={`Loading ${selected.list}/${selected.name}…`} className="flex-1" />;
    }

    if (!selected || !draft) {
      if (taskLists.isLoading && lists.length === 0) return <LoadingState message="Loading task lists…" className="flex-1" />;
      if (taskLists.error && lists.length === 0) {
        return <ErrorState title="Unable to load task lists" error={taskLists.error} onRetry={() => void taskLists.mutate()} variant="page" />;
      }
      return (
        <EmptyState
          variant="page"
          className="bg-primary"
          icon={ListChecks}
          iconBadgeClassName="bg-linear-to-br from-orange-500 to-amber-600"
          title={lists.length > 0 ? "Select a task" : "No tasks yet"}
          hint={
            lists.length > 0
              ? "Pick a task from a list to edit its instructions, or run a whole list to hand every pending task to its own agent."
              : "Tasks are markdown files an agent can read, write, and execute. Create a list to get started."
          }
          ctaLabel="New task list"
          onCta={() => setNewListOpen(true)}
        >
          {config?.directory && (
            <p className="text-xs text-muted mt-2">
              Stored as markdown files in <code className="font-mono text-secondary">{config.directory}</code>
            </p>
          )}
        </EmptyState>
      );
    }

    return (
      <div className="h-full flex flex-col bg-primary">
        <AppPageHeader
          title={draft.title || selected.name}
          subtitle={
            <span className="flex items-center gap-2 flex-wrap">
              <code className="font-mono">
                {selected.list}/{selected.name}.md
              </code>
              {savedTask && <span className="text-muted">· updated {new Date(savedTask.updatedAt).toLocaleString()}</span>}
              {isDirty && <span className="text-amber-600 dark:text-amber-500 font-medium">· unsaved changes</span>}
              <TaskStatusBadge status={draft.status} />
            </span>
          }
          icon={<ListChecks />}
          iconGradient="from-orange-500 to-amber-600"
          size="compact"
        >
          {featuredRun?.agentId && (
            <button
              type="button"
              onClick={() => openAgent(featuredRun.agentId!)}
              title="Open the agent that ran this task"
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open agent
            </button>
          )}
          <LaunchButton
            loading={runningTask === selectedKey}
            onClick={() => void handleRunTask(selected.list, selected.name)}
            title="Run this task on a new agent"
            label="Run"
            bgClassName="bg-orange-600 hover:bg-orange-500"
          />
          <button
            type="button"
            onClick={() => savedTask && setDraft(toDraft(savedTask))}
            disabled={!isDirty}
            title="Discard unsaved changes"
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Revert
          </button>
          <button
            type="button"
            onClick={() => setDeleteTaskTarget(selected)}
            title="Delete this task"
            aria-label="Delete task"
            className="p-1.5 text-muted hover:text-red-500 border border-primary rounded-lg transition-colors cursor-pointer focus-ring"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </AppPageHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <div className="max-w-3xl mx-auto space-y-5">
            <section className="space-y-2" aria-label="Run monitoring">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">Runs</span>
                <span className="text-xs text-muted">Live progress and recent history</span>
              </div>
              {featuredRun && <ActiveRunPanel run={featuredRun} onOpenAgent={openAgent} onCancel={runId => void handleCancelRun(runId)} />}
              <TaskRunHistory
                runs={historyRuns}
                emptyMessage={featuredRun ? null : "No runs yet for this task. Run it to see progress here."}
                onOpenAgent={openAgent}
              />
            </section>

            <TaskEditor
              draft={draft}
              onChange={setDraft}
              agentTypes={config?.agentTypes ?? []}
              statuses={(config?.statuses ?? []) as TaskStatus[]}
              priorities={(config?.priorities ?? []) as TaskPriority[]}
              defaultAgentType={config?.defaultAgentType ?? ""}
              theme={theme}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      {activeBatch && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/30 text-xs">
          <Loader2 className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-primary font-medium truncate">{activeBatch.batch.label}</span>
          <span className="text-muted">
            {activeBatch.done} of {activeBatch.total} complete
          </span>
          <button
            type="button"
            onClick={() => void tasksRPCClient.cancelBatch({ batchId: activeBatch.batch.id }).catch(() => {})}
            className="ml-auto px-2 py-0.5 text-muted hover:text-red-500 rounded transition-colors cursor-pointer focus-ring shrink-0"
          >
            Cancel batch
          </button>
        </div>
      )}

      <WorkspaceShell
        appId="tasks"
        title="Tasks"
        navigationLabel="Task lists and runs"
        hasSelection={selected !== null}
        className="flex-1"
        navigation={
          <TaskSidebar
            lists={lists}
            isLoading={taskLists.isLoading}
            error={taskLists.error}
            onRetry={() => void taskLists.mutate()}
            expandedLists={expandedLists}
            onToggleList={toggleList}
            selected={selected}
            activeRuns={activeRuns}
            runningList={runningList}
            onSelectTask={handleSelectTask}
            onNewTask={setNewTaskFor}
            onNewList={() => setNewListOpen(true)}
            onRunList={list => void handleRunList(list)}
            onDeleteList={setDeleteListTarget}
            onOpenAgent={openAgent}
          />
        }
      >
        {mainPane()}
      </WorkspaceShell>

      {newListOpen && (
        <CreateItemModal
          title="New task list"
          placeholder="refactor"
          pattern={NAME_PATTERN}
          validationError={NAME_ERROR}
          onCreate={handleCreateList}
          onClose={() => setNewListOpen(false)}
        />
      )}

      {newTaskFor !== null && (
        <SaveAsModal
          title="New task"
          containerField={{
            label: "List",
            placeholder: "refactor",
            initialValue: newTaskFor,
            pattern: NAME_PATTERN,
            validationError: NAME_ERROR,
            options: lists.map(list => ({ value: list.name })),
          }}
          itemField={{
            label: "Task name",
            placeholder: "extract-parser",
            initialValue: "",
            pattern: NAME_PATTERN,
            validationError: NAME_ERROR,
            options: [],
            autoFocus: true,
          }}
          onSave={handleCreateTask}
          onClose={() => setNewTaskFor(null)}
          saveLabel="Create"
          saveIcon={Play}
        />
      )}

      {deleteTaskTarget && (
        <ConfirmModal
          title="Delete task?"
          message={`This permanently deletes "${deleteTaskTarget.list}/${deleteTaskTarget.name}.md" from disk.`}
          onConfirm={() => handleDeleteTask(deleteTaskTarget.list, deleteTaskTarget.name)}
          onClose={() => setDeleteTaskTarget(null)}
          closeOnBackdrop
        />
      )}

      {deleteListTarget && (
        <ConfirmModal
          title="Delete task list?"
          message={`This permanently deletes the list "${deleteListTarget}" and every task inside it.`}
          onConfirm={() => handleDeleteList(deleteListTarget)}
          onClose={() => setDeleteListTarget(null)}
          closeOnBackdrop
        />
      )}
    </div>
  );
}
