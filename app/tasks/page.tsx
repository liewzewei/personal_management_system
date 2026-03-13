/**
 * Tasks page — main task management interface.
 *
 * Three-column layout:
 * - Left sidebar (fixed ~220px): tag filters with counts
 * - Main content area: task list grouped by status
 * - Right panel (slide-in): task detail view
 *
 * Features: search, sort, status filter, keyboard shortcut (N),
 * optimistic checkbox updates, and toast notifications.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskModal, type TaskFormData } from "@/components/tasks/TaskModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTags } from "@/lib/hooks/useTags";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Task, TaskFilters, TaskWithSubtasks } from "@/types";

const DEFAULT_TAGS = ["Personal", "Exercise", "Academic", "Extra-Academic"];

type StatusFilter = "all" | "todo" | "in_progress" | "done";
type SortOption = "created_at" | "deadline" | "priority" | "title";

export default function TasksPage() {
  // Filters
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created_at");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal & panel
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskWithSubtasks | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Collapsed "done" group
  const [showDone, setShowDone] = useState(false);

  // Subtask counts cache: taskId -> { total, done }
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, { total: number; done: number }>>({});

  const { toast } = useToast();
  const { tags: userTags, refetch: refetchTags } = useTags();

  // Build API filters
  const apiFilters: TaskFilters = useMemo(() => {
    const f: TaskFilters = { sortBy };
    if (activeTag) f.tag = activeTag;
    if (statusFilter !== "all") f.status = statusFilter;
    if (debouncedSearch) f.search = debouncedSearch;
    return f;
  }, [activeTag, statusFilter, debouncedSearch, sortBy]);

  const { tasks, loading, refetch } = useTasks(apiFilters);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Compute the combined tag list: defaults + any user tags not in defaults
  const allTags = useMemo(() => {
    const combined = [...DEFAULT_TAGS];
    for (const tag of userTags) {
      if (!combined.includes(tag)) combined.push(tag);
    }
    return combined;
  }, [userTags]);

  // Compute tag counts (incomplete tasks only)
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of allTags) counts[tag] = 0;
    for (const task of tasks) {
      if (task.status !== "done" && task.tags) {
        for (const tag of task.tags) {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [tasks, allTags]);

  // Group tasks by status
  const grouped = useMemo(() => {
    const inProgress: Task[] = [];
    const todo: Task[] = [];
    const done: Task[] = [];
    for (const task of tasks) {
      if (task.status === "in_progress") inProgress.push(task);
      else if (task.status === "todo") todo.push(task);
      else done.push(task);
    }
    return { inProgress, todo, done };
  }, [tasks]);

  // Fetch subtask counts for all tasks
  useEffect(() => {
    async function fetchSubtaskCounts() {
      const counts: Record<string, { total: number; done: number }> = {};
      await Promise.all(
        tasks.map(async (task) => {
          try {
            const res = await fetch(`/api/tasks/${task.id}`);
            const body = (await res.json()) as { data: TaskWithSubtasks | null };
            if (body.data && body.data.subtasks.length > 0) {
              counts[task.id] = {
                total: body.data.subtasks.length,
                done: body.data.subtasks.filter((s) => s.status === "done").length,
              };
            }
          } catch { /* skip */ }
        })
      );
      setSubtaskCounts(counts);
    }
    if (tasks.length > 0) fetchSubtaskCounts();
  }, [tasks]);

  // Keyboard shortcut: N opens new task modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        openNewTaskModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Handlers ---

  function openNewTaskModal() {
    setEditingTaskId(null);
    setEditingTask(null);
    setModalOpen(true);
  }

  async function openEditModal(taskId: string) {
    setEditingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const body = (await res.json()) as { data: TaskWithSubtasks | null; error: string | null };
      if (body.data) {
        setEditingTask(body.data);
        setDetailOpen(false);
        setModalOpen(true);
      }
    } catch {
      toast({ title: "Something went wrong, please try again", variant: "destructive" });
    }
  }

  function openDetail(taskId: string) {
    setDetailTaskId(taskId);
    setDetailOpen(true);
  }

  // Optimistic toggle done
  const handleToggleDone = useCallback(
    async (taskId: string, currentStatus: Task["status"]) => {
      const newStatus = currentStatus === "done" ? "todo" : "done";

      // Optimistic: we refetch after the API call rather than manually mutating
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error();
        refetch();
      } catch {
        toast({ title: "Something went wrong, please try again", variant: "destructive" });
        refetch();
      }
    },
    [refetch, toast]
  );

  async function handleDuplicate(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}?action=duplicate`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Task duplicated" });
      refetch();
      refetchTags();
    } catch {
      toast({ title: "Something went wrong, please try again", variant: "destructive" });
    }
  }

  async function handleDelete(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Task deleted" });
      setModalOpen(false);
      setDetailOpen(false);
      refetch();
      refetchTags();
    } catch {
      toast({ title: "Something went wrong, please try again", variant: "destructive" });
    }
  }

  async function handleSave(data: TaskFormData) {
    try {
      if (editingTaskId) {
        // Update existing task
        const res = await fetch(`/api/tasks/${editingTaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            tags: data.tags.length > 0 ? data.tags : null,
            deadline: data.deadline,
            estimated_minutes: data.estimated_minutes,
            is_recurring: data.is_recurring,
            recurrence_rule: data.recurrence_rule,
          }),
        });
        if (!res.ok) throw new Error();

        // Handle subtask changes
        if (editingTask) {
          await syncSubtasks(editingTaskId, editingTask.subtasks, data.subtasks);
        }

        toast({ title: "Task saved" });
      } else {
        // Create new task
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            tags: data.tags.length > 0 ? data.tags : null,
            deadline: data.deadline,
            estimated_minutes: data.estimated_minutes,
            is_recurring: data.is_recurring,
            recurrence_rule: data.recurrence_rule,
          }),
        });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { data: Task | null };

        // Create subtasks for new task
        if (body.data && data.subtasks.length > 0) {
          for (const sub of data.subtasks) {
            await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: sub.title,
                status: sub.status,
                parent_task_id: body.data.id,
              }),
            });
          }
        }

        toast({ title: "Task created" });
      }

      setModalOpen(false);
      refetch();
      refetchTags();
    } catch {
      toast({ title: "Something went wrong, please try again", variant: "destructive" });
    }
  }

  async function syncSubtasks(
    parentId: string,
    existing: Task[],
    formItems: Array<{ id?: string; title: string; status: string; isNew?: boolean }>
  ) {
    const existingIds = new Set(existing.map((s) => s.id));
    const formIds = new Set(formItems.filter((s) => s.id).map((s) => s.id));

    // Delete subtasks removed from form
    for (const sub of existing) {
      if (!formIds.has(sub.id)) {
        await fetch(`/api/tasks/${sub.id}`, { method: "DELETE" });
      }
    }

    // Update existing / create new
    for (const item of formItems) {
      if (item.id && existingIds.has(item.id)) {
        const orig = existing.find((s) => s.id === item.id);
        if (orig && (orig.title !== item.title || orig.status !== item.status)) {
          await fetch(`/api/tasks/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: item.title, status: item.status }),
          });
        }
      } else if (item.isNew || !item.id) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            status: item.status,
            parent_task_id: parentId,
          }),
        });
      }
    }
  }

  async function handleToggleSubtask(subtaskId: string, currentStatus: "todo" | "in_progress" | "done") {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    try {
      await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      // Re-fetch detail panel data
      if (detailTaskId) {
        const res = await fetch(`/api/tasks/${detailTaskId}`);
        const body = (await res.json()) as { data: TaskWithSubtasks | null };
        if (body.data) {
          // Force re-render by toggling the panel
          setDetailTaskId(null);
          setTimeout(() => {
            setDetailTaskId(detailTaskId);
          }, 0);
        }
      }
      refetch();
    } catch {
      toast({ title: "Something went wrong, please try again", variant: "destructive" });
    }
  }

  // --- Render helpers ---

  function renderGroup(title: string, groupTasks: Task[], collapsible = false) {
    if (collapsible && groupTasks.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">({groupTasks.length})</span>
          {collapsible && groupTasks.length > 0 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setShowDone(!showDone)}
            >
              {showDone ? "Hide completed" : `Show ${groupTasks.length} completed`}
            </button>
          )}
        </div>
        {(!collapsible || showDone) &&
          groupTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              subtaskCount={subtaskCounts[task.id]?.total ?? 0}
              subtaskDoneCount={subtaskCounts[task.id]?.done ?? 0}
              onToggleDone={handleToggleDone}
              onClick={openDetail}
              onEdit={openEditModal}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
      </div>
    );
  }

  const noTasks = tasks.length === 0 && !loading;

  return (
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <aside className="w-[220px] shrink-0 border-r bg-card">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-1">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
              Tags
            </h2>
            <button
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                activeTag === null
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
              onClick={() => setActiveTag(null)}
            >
              <span>All Tasks</span>
              <span className="text-xs opacity-70">
                {tasks.filter((t) => t.status !== "done").length}
              </span>
            </button>

            {allTags.map((tag) => (
              <button
                key={tag}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                  activeTag === tag
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
                onClick={() => setActiveTag(tag)}
              >
                <span className="truncate">{tag}</span>
                <span className="text-xs opacity-70">{tagCounts[tag] ?? 0}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold shrink-0">Tasks</h1>
            <div className="flex items-center gap-3 flex-1 justify-end">
              {/* Search */}
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="pl-9 h-9"
                />
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Created Date</SelectItem>
                  <SelectItem value="deadline">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="title">Alphabetical</SelectItem>
                </SelectContent>
              </Select>

              {/* New Task */}
              <Button size="sm" onClick={openNewTaskModal}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Task
              </Button>
            </div>
          </div>

          {/* Status filter toggles */}
          <div className="flex gap-1 mt-3">
            {(["all", "todo", "in_progress", "done"] as const).map((s) => (
              <button
                key={s}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s === "todo" ? "Todo" : s === "in_progress" ? "In Progress" : "Done"}
              </button>
            ))}
          </div>
        </header>

        {/* Task List */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading tasks...</p>
            )}

            {noTasks && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground mb-2">
                  No tasks yet — press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">N</kbd> or click New Task to get started
                </p>
              </div>
            )}

            {!loading && tasks.length > 0 && (
              <>
                {statusFilter === "all" ? (
                  <>
                    {renderGroup("In Progress", grouped.inProgress)}
                    {renderGroup("Todo", grouped.todo)}
                    {renderGroup("Done", grouped.done, true)}
                  </>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        subtaskCount={subtaskCounts[task.id]?.total ?? 0}
                        subtaskDoneCount={subtaskCounts[task.id]?.done ?? 0}
                        onToggleDone={handleToggleDone}
                        onClick={openDetail}
                        onEdit={openEditModal}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        allTags={allTags}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Task Detail Panel */}
      <TaskDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        taskId={detailTaskId}
        onEdit={openEditModal}
        onToggleSubtask={handleToggleSubtask}
      />
    </div>
  );
}

