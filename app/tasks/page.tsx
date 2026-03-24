/**
 * Tasks page — Kanban board interface.
 *
 * Layout:
 * - Left sidebar (fixed ~220px): tag filters with independent count badges
 * - Main content: three-column Kanban board (To Do | In Progress | Done)
 * - Right panel (slide-in): task detail view
 * - Archive panel (slide-in): completed tasks from previous days
 *
 * Features: search, sort, drag-and-drop (To Do → In Progress only),
 * completion checkbox, keyboard shortcut (N), optimistic updates,
 * archive with reopen, and toast notifications.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Loader2, Archive } from "lucide-react";
import { MobileHeader } from "@/components/MobileHeader";
import { SidebarToggle } from "@/components/SidebarToggle";
import { useSidebarState } from "@/lib/hooks/useSidebarState";
import {
  DndContext,
  DragOverlay,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { KanbanCard } from "@/components/tasks/KanbanCard";
import { TaskModal, type TaskFormData } from "@/components/tasks/TaskModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { useTasks, useTaskMutation } from "@/lib/hooks/useTasks";
import { useTags } from "@/lib/hooks/useTags";
import { useTaskTagCounts } from "@/lib/hooks/useTaskTagCounts";
import { useToast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Task, TaskFilters, TaskWithSubtasks } from "@/types";
import { format, parseISO } from "date-fns";

const DEFAULT_TAGS = ["Personal", "Exercise", "Academic", "Extra-Academic"];

type SortOption = "created_at" | "deadline" | "priority" | "title";

const ARCHIVE_PAGE_SIZE = 20;

// --- Droppable column wrapper ---

function DroppableColumn({
  id,
  title,
  count,
  isOver,
  children,
}: {
  id: string;
  title: string;
  count: number;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver: dropping } = useDroppable({ id });
  const highlighted = isOver || dropping;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg bg-muted/40 border",
        "w-full md:flex-1 md:min-w-0",
        "md:h-full",
        highlighted && "border-dashed border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
      </div>
      <div
        className="md:flex-1 overflow-y-auto p-3 space-y-2 min-h-[100px]"
        style={{ overscrollBehavior: 'contain' }}
      >
        {children}
      </div>
    </div>
  );
}

export default function TasksPage() {
  // Feature sidebar state (persisted to localStorage)
  const tagSidebar = useSidebarState("tasks-tags", true);

  // Filters
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created_at");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal & panel
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskWithSubtasks | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Archive panel
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLimit, setArchiveLimit] = useState(ARCHIVE_PAGE_SIZE);

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);


  const { toast } = useToast();
  const { tags: userTags } = useTags("tasks");
  const { data: tagCounts } = useTaskTagCounts();
  const { updateTask: updateTaskMutation, deleteTask: deleteTaskMutation, duplicateTask: duplicateTaskMutation } = useTaskMutation();
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // Build API filters — no status filter for Kanban (we need all statuses)
  const apiFilters: TaskFilters = useMemo(() => {
    const f: TaskFilters = { sortBy };
    if (activeTag) f.tag = activeTag;
    if (debouncedSearch) f.search = debouncedSearch;
    return f;
  }, [activeTag, debouncedSearch, sortBy]);

  const { tasks, loading, refetch, queryClient, fetchNextPage, hasNextPage, isFetchingNextPage } = useTasks(apiFilters);

  // @dnd-kit sensors with keyboard accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

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

  // Group tasks by status for Kanban columns
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const grouped = useMemo(() => {
    const todo: Task[] = [];
    const inProgress: Task[] = [];
    const doneToday: Task[] = [];
    const doneArchive: Task[] = [];

    for (const task of tasks) {
      if (task.status === "todo") {
        todo.push(task);
      } else if (task.status === "in_progress") {
        inProgress.push(task);
      } else if (task.status === "done") {
        if (task.completed_at && new Date(task.completed_at) >= todayStart) {
          doneToday.push(task);
        } else {
          doneArchive.push(task);
        }
      }
    }

    // Sort archive by completed_at descending
    doneArchive.sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    });

    return { todo, inProgress, doneToday, doneArchive };
  }, [tasks, todayStart]);

  // Infinite scroll: observe sentinel element
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);


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

  // --- DnD handlers ---

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragOver(event: { over: { id: string | number } | null }) {
    setDragOverColumn(event.over ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    setDragOverColumn(null);

    if (!over) return;

    // Only allow drop on In Progress column
    if (String(over.id) === "in-progress-column") {
      const taskId = active.id as string;

      // Optimistic update — move card to In Progress in cache
      queryClient.setQueriesData<{ pages: Task[][]; pageParams: number[] }>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((task) =>
                task.id === taskId ? { ...task, status: "in_progress" as const } : task
              )
            ),
          };
        }
      );

      // API call
      fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed");
          queryClient.invalidateQueries({ queryKey: ["task-tag-counts"] });
        })
        .catch(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          toast({ title: "Failed to update task status", variant: "destructive" });
        });
    }
    // Any other drop target: card snaps back automatically (no action)
  }

  function handleDragCancel() {
    setActiveDragId(null);
    setDragOverColumn(null);
  }

  // --- Task handlers ---

  function openNewTaskModal() {
    setEditingTaskId(null);
    setEditingTask(null);
    setModalOpen(true);
  }

  async function openEditModal(taskId: string) {
    setEditingTaskId(taskId);
    
    // Try to find task in cache first
    const cachedTask = tasks.find(t => t.id === taskId);
    
    if (cachedTask) {
      // Fetch only subtasks (lightweight query)
      try {
        const res = await fetch(`/api/tasks/${taskId}/subtasks`);
        const body = (await res.json()) as { data: Task[] | null; error: string | null };
        const taskWithSubtasks: TaskWithSubtasks = {
          ...cachedTask,
          subtasks: body.data ?? [],
        };
        setEditingTask(taskWithSubtasks);
        setDetailOpen(false);
        setModalOpen(true);
      } catch {
        toast({ title: "Failed to load subtasks", variant: "destructive" });
      }
    } else {
      // Fallback: fetch full task if not in cache (rare edge case)
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
  }

  function openDetail(taskId: string) {
    setDetailTaskId(taskId);
    setDetailOpen(true);
  }

  // Completion checkbox handler — optimistic move to Done
  const handleComplete = useCallback(
    (taskId: string) => {
      const completedAt = new Date().toISOString();

      // Optimistic update — move card to Done in cache
      queryClient.setQueriesData<{ pages: Task[][]; pageParams: number[] }>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((task) =>
                task.id === taskId
                  ? { ...task, status: "done" as const, completed_at: completedAt }
                  : task
              )
            ),
          };
        }
      );

      // API call in background
      fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed");
          queryClient.invalidateQueries({ queryKey: ["task-tag-counts"] });
        })
        .catch(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          toast({ title: "Failed to complete task. Please try again.", variant: "destructive" });
        });
    },
    [queryClient, toast]
  );

  // Archive reopen handler
  const handleReopen = useCallback(
    (taskId: string) => {
      // Optimistic update — move back to todo
      queryClient.setQueriesData<{ pages: Task[][]; pageParams: number[] }>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((task) =>
                task.id === taskId
                  ? { ...task, status: "todo" as const, completed_at: null }
                  : task
              )
            ),
          };
        }
      );

      fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "todo" }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed");
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["task-tag-counts"] });
        })
        .catch(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          toast({ title: "Failed to reopen task", variant: "destructive" });
        });
    },
    [queryClient, toast]
  );

  async function handleDuplicate(taskId: string) {
    duplicateTaskMutation.mutate(taskId, {
      onSuccess: () => toast({ title: "Task duplicated" }),
      onError: () => toast({ title: "Something went wrong, please try again", variant: "destructive" }),
    });
  }

  async function handleDelete(taskId: string) {
    deleteTaskMutation.mutate(taskId, {
      onSuccess: () => {
        toast({ title: "Task deleted" });
        setModalOpen(false);
        setDetailOpen(false);
      },
      onError: () => toast({ title: "Something went wrong, please try again", variant: "destructive" }),
    });
  }

  async function handleSave(data: TaskFormData) {
    if (editingTaskId) {
      // Optimistic update for existing task
      const optimisticTask: Task = {
        ...tasks.find(t => t.id === editingTaskId)!,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        tags: data.tags.length > 0 ? data.tags : null,
        deadline: data.deadline,
        estimated_minutes: data.estimated_minutes,
        is_recurring: data.is_recurring,
        recurrence_rule: data.recurrence_rule,
        updated_at: new Date().toISOString(),
      };

      // Update cache immediately
      queryClient.setQueriesData<{ pages: Task[][]; pageParams: number[] }>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((task) => (task.id === editingTaskId ? optimisticTask : task))
            ),
          };
        }
      );

      // Close modal immediately
      setModalOpen(false);
      toast({ title: "Saving task..." });

      // Background save
      try {
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

        // Refresh to get accurate data
        refetch();
        queryClient.invalidateQueries({ queryKey: ["task-tag-counts"] });
        queryClient.invalidateQueries({ queryKey: ["subtasks", editingTaskId] });
      } catch {
        // Revert on error
        refetch();
        toast({ title: "Failed to save task. Please try again.", variant: "destructive" });
      }
    } else {
      // Create new task (keep non-optimistic since we need the ID)
      setModalOpen(false);
      toast({ title: "Creating task..." });

      try {
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

        // Create subtasks for new task (in parallel)
        if (body.data && data.subtasks.length > 0) {
          const parentId = body.data.id;
          await Promise.all(
            data.subtasks.map((sub) =>
              fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: sub.title,
                  status: sub.status,
                  parent_task_id: parentId,
                }),
              })
            )
          );
        }

        refetch();
        queryClient.invalidateQueries({ queryKey: ["task-tag-counts"] });
        toast({ title: "Task created" });
      } catch {
        toast({ title: "Failed to create task. Please try again.", variant: "destructive" });
      }
    }
  }

  async function syncSubtasks(
    parentId: string,
    existing: Task[],
    formItems: Array<{ id?: string; title: string; status: string; isNew?: boolean }>
  ) {
    const existingIds = new Set(existing.map((s) => s.id));
    const formIds = new Set(formItems.filter((s) => s.id).map((s) => s.id));

    // Parallelize deletes
    const deletePromises = existing
      .filter((sub) => !formIds.has(sub.id))
      .map((sub) => fetch(`/api/tasks/${sub.id}`, { method: "DELETE" }));

    // Parallelize updates (flatMap to skip unchanged items without no-op promises)
    const updatePromises = formItems
      .filter((item) => item.id && existingIds.has(item.id))
      .flatMap((item) => {
        const orig = existing.find((s) => s.id === item.id);
        if (orig && (orig.title !== item.title || orig.status !== item.status)) {
          return [fetch(`/api/tasks/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: item.title, status: item.status }),
          })];
        }
        return [];
      });

    // Parallelize creates
    const createPromises = formItems
      .filter((item) => item.isNew || !item.id)
      .map((item) =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            status: item.status,
            parent_task_id: parentId,
          }),
        })
      );

    // Execute all operations in parallel
    await Promise.all([...deletePromises, ...updatePromises, ...createPromises]);
  }


  // --- Derived state ---

  const activeDragTask = activeDragId ? tasks.find((t) => t.id === activeDragId) : null;
  const noTasks = tasks.length === 0 && !loading;
  const archiveTasks = grouped.doneArchive.slice(0, archiveLimit);
  const hasMoreArchive = grouped.doneArchive.length > archiveLimit;

  const priorityConfig: Record<string, { label: string; className: string }> = {
    high: { label: "High", className: "bg-red-100 text-red-700 border-red-200" },
    medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    low: { label: "Low", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mobile header with sidebar toggle */}
      <MobileHeader
        title="Tasks"
        actions={
          <>
            <div className="hidden md:flex">
              <SidebarToggle
                isOpen={tagSidebar.isOpen}
                onToggle={tagSidebar.toggle}
                label="Toggle tag filters"
              />
            </div>
            <Button size="sm" onClick={openNewTaskModal}>
              <Plus className="h-4 w-4 mr-1" /> New Task
            </Button>
          </>
        }
      />

      {/* Top Bar — search + sort */}
      <header className="border-b bg-card px-4 md:px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-9 h-9 text-base sm:text-sm"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[130px] md:w-[150px] h-9">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Created Date</SelectItem>
              <SelectItem value="deadline">Due Date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="title">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Tag filter sidebar — hidden on mobile, collapsible on desktop */}
        {tagSidebar.isOpen && (
          <aside className="hidden md:flex flex-col border-r bg-card w-[220px] shrink-0">
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
                    {tagCounts?.["All Tasks"] ?? 0}
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
                    <span className="text-xs opacity-70">{tagCounts?.[tag] ?? 0}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>
        )}

        {/* Mobile: tag filters as a horizontal scrollable chip row */}
        <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-2 border-b shrink-0 scrollbar-none absolute left-0 right-0 bg-card z-5" style={{ top: "auto" }}>
          <button
            onClick={() => setActiveTag(null)}
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-sm border",
              !activeTag && "bg-primary text-primary-foreground border-primary"
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-sm border",
                activeTag === tag && "bg-primary text-primary-foreground border-primary"
              )}
            >
              {tag}
            </button>
          ))}
        </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-10" /> {/* Spacer for mobile chip row */}

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden md:overflow-hidden overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {noTasks && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground mb-2">
                No tasks yet — press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">N</kbd> or click New Task to get started
              </p>
            </div>
          )}

          {!loading && tasks.length > 0 && (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="flex flex-col md:flex-row gap-4 h-full md:h-full overflow-y-auto md:overflow-y-hidden overflow-x-hidden md:overflow-x-auto p-4">
                {/* To Do Column */}
                <DroppableColumn
                  id="todo-column"
                  title="To Do"
                  count={grouped.todo.length}
                  isOver={false}
                >
                  {grouped.todo.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      column="todo"
                      subtaskCount={task.subtask_count ?? 0}
                      subtaskDoneCount={task.subtask_done_count ?? 0}
                      onClick={openDetail}
                      onEdit={openEditModal}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                    />
                  ))}
                  {grouped.todo.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                  )}
                </DroppableColumn>

                {/* In Progress Column */}
                <DroppableColumn
                  id="in-progress-column"
                  title="In Progress"
                  count={grouped.inProgress.length}
                  isOver={dragOverColumn === "in-progress-column"}
                >
                  {grouped.inProgress.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      column="in_progress"
                      subtaskCount={task.subtask_count ?? 0}
                      subtaskDoneCount={task.subtask_done_count ?? 0}
                      onComplete={handleComplete}
                      onClick={openDetail}
                      onEdit={openEditModal}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                    />
                  ))}
                  {grouped.inProgress.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      {activeDragId ? "Drop here to start" : "No tasks"}
                    </p>
                  )}
                </DroppableColumn>

                {/* Done Column */}
                <DroppableColumn
                  id="done-column"
                  title="Done Today"
                  count={grouped.doneToday.length}
                  isOver={false}
                >
                  {grouped.doneToday.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      column="done"
                      subtaskCount={task.subtask_count ?? 0}
                      subtaskDoneCount={task.subtask_done_count ?? 0}
                      onClick={openDetail}
                    />
                  ))}
                  {grouped.doneToday.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No tasks completed today</p>
                  )}

                  {/* View Archive button */}
                  {grouped.doneArchive.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-muted-foreground"
                      onClick={() => setArchiveOpen(true)}
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      View Archive ({grouped.doneArchive.length})
                    </Button>
                  )}
                </DroppableColumn>
              </div>

              {/* Drag overlay — shows a ghost of the card being dragged */}
              <DragOverlay>
                {activeDragTask ? (
                  <div className="opacity-80 rotate-2">
                    <KanbanCard
                      task={activeDragTask}
                      column="todo"
                      subtaskCount={activeDragTask.subtask_count ?? 0}
                      subtaskDoneCount={activeDragTask.subtask_done_count ?? 0}
                      onClick={() => {}}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* Infinite scroll sentinel (hidden, loads more tasks in background) */}
          <div ref={scrollSentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </main>
      </div> {/* end flex row: sidebar + main */}

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
        task={detailTaskId ? tasks.find(t => t.id === detailTaskId) ?? null : null}
        onEdit={openEditModal}
      />

      {/* Archive Panel */}
      <Sheet open={archiveOpen} onOpenChange={setArchiveOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Completed Tasks</SheetTitle>
            <SheetDescription>
              Tasks completed before today
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            {archiveTasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No archived tasks</p>
            )}

            {archiveTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => {
                  setArchiveOpen(false);
                  openDetail(task.id);
                }}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm line-through text-muted-foreground truncate">
                      {task.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0", priorityConfig[task.priority]?.className)}
                    >
                      {priorityConfig[task.priority]?.label}
                    </Badge>
                  </div>
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {task.completed_at && (
                    <p className="text-xs text-muted-foreground">
                      Completed {format(parseISO(task.completed_at), "d MMM yyyy, HH:mm")}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReopen(task.id);
                  }}
                >
                  Reopen
                </Button>
              </div>
            ))}

            {hasMoreArchive && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setArchiveLimit((prev) => prev + ARCHIVE_PAGE_SIZE)}
              >
                Load more
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
