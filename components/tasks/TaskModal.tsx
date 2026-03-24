/**
 * TaskModal component.
 *
 * Centered modal for creating and editing tasks. Contains all task fields:
 * title, description, status, priority, tags, deadline, time estimate,
 * recurring toggle, and subtasks section.
 *
 * Used for both "New Task" and "Edit Task" flows.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskWithSubtasks } from "@/types";

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, modal is in "edit" mode with pre-filled values. */
  task?: TaskWithSubtasks | null;
  /** All known tags for the combobox suggestions. */
  allTags: string[];
  onSave: (data: TaskFormData) => Promise<void>;
  onDelete?: (taskId: string) => void;
}

export interface TaskFormData {
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  tags: string[];
  deadline: string | null;
  estimated_minutes: number | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  subtasks: SubtaskFormItem[];
}

interface SubtaskFormItem {
  id?: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  isNew?: boolean;
  isDeleted?: boolean;
}

const DAYS_OF_WEEK = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseRrule(rule: string | null): { freq: string; byDay: string[]; byMonthDay: number } {
  const result = { freq: "WEEKLY", byDay: [] as string[], byMonthDay: 1 };
  if (!rule) return result;

  const freqMatch = rule.match(/FREQ=(\w+)/);
  if (freqMatch) result.freq = freqMatch[1];

  const byDayMatch = rule.match(/BYDAY=([A-Z,]+)/);
  if (byDayMatch) result.byDay = byDayMatch[1].split(",");

  const byMdMatch = rule.match(/BYMONTHDAY=(\d+)/);
  if (byMdMatch) result.byMonthDay = parseInt(byMdMatch[1], 10);

  return result;
}

function buildRrule(freq: string, byDay: string[], byMonthDay: number): string {
  let rule = `FREQ=${freq}`;
  if (freq === "WEEKLY" && byDay.length > 0) {
    rule += `;BYDAY=${byDay.join(",")}`;
  }
  if (freq === "MONTHLY") {
    rule += `;BYMONTHDAY=${byMonthDay}`;
  }
  return rule;
}

export function TaskModal({ open, onOpenChange, task, allTags, onSave, onDelete }: TaskModalProps) {
  const isEditing = Boolean(task);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [showTime, setShowTime] = useState(false);
  const [estimateValue, setEstimateValue] = useState("");
  const [estimateUnit, setEstimateUnit] = useState<"minutes" | "hours">("minutes");
  const [isRecurring, setIsRecurring] = useState(false);
  const [rruleFreq, setRruleFreq] = useState("WEEKLY");
  const [rruleByDay, setRruleByDay] = useState<string[]>([]);
  const [rruleByMonthDay, setRruleByMonthDay] = useState(1);
  const [subtasks, setSubtasks] = useState<SubtaskFormItem[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset form when modal opens/task changes
  const resetForm = useCallback(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setTags(task.tags ?? []);
      setTagInput("");

      if (task.deadline) {
        const d = new Date(task.deadline);
        setDeadlineDate(d.toISOString().slice(0, 10));
        const timeStr = d.toISOString().slice(11, 16);
        if (timeStr !== "00:00") {
          setDeadlineTime(timeStr);
          setShowTime(true);
        } else {
          setDeadlineTime("");
          setShowTime(false);
        }
      } else {
        setDeadlineDate("");
        setDeadlineTime("");
        setShowTime(false);
      }

      if (task.estimated_minutes != null && task.estimated_minutes > 0) {
        if (task.estimated_minutes >= 60 && task.estimated_minutes % 60 === 0) {
          setEstimateValue(String(task.estimated_minutes / 60));
          setEstimateUnit("hours");
        } else {
          setEstimateValue(String(task.estimated_minutes));
          setEstimateUnit("minutes");
        }
      } else {
        setEstimateValue("");
        setEstimateUnit("minutes");
      }

      setIsRecurring(task.is_recurring);
      const rrule = parseRrule(task.recurrence_rule);
      setRruleFreq(rrule.freq);
      setRruleByDay(rrule.byDay);
      setRruleByMonthDay(rrule.byMonthDay);

      setSubtasks(
        task.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
        }))
      );
    } else {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setTags([]);
      setTagInput("");
      setDeadlineDate("");
      setDeadlineTime("");
      setShowTime(false);
      setEstimateValue("");
      setEstimateUnit("minutes");
      setIsRecurring(false);
      setRruleFreq("WEEKLY");
      setRruleByDay([]);
      setRruleByMonthDay(1);
      setSubtasks([]);
      setNewSubtaskTitle("");
    }
    setSaving(false);
    setConfirmDelete(false);
  }, [task]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) resetForm();
  }, [open, resetForm]);

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function toggleDay(day: string) {
    setRruleByDay((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function addSubtask() {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    setSubtasks([...subtasks, { title: t, status: "todo", isNew: true }]);
    setNewSubtaskTitle("");
  }

  function toggleSubtask(index: number) {
    setSubtasks((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, status: s.status === "done" ? "todo" : "done" } : s
      )
    );
  }

  function deleteSubtask(index: number) {
    setSubtasks((prev) => {
      const item = prev[index];
      if (item.id) {
        return prev.map((s, i) => (i === index ? { ...s, isDeleted: true } : s));
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateSubtaskTitle(index: number, newTitle: string) {
    setSubtasks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, title: newTitle } : s))
    );
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    let deadline: string | null = null;
    if (deadlineDate) {
      const time = showTime && deadlineTime ? deadlineTime : "00:00";
      deadline = new Date(`${deadlineDate}T${time}:00`).toISOString();
    }

    let estimated_minutes: number | null = null;
    const numVal = parseFloat(estimateValue);
    if (!isNaN(numVal) && numVal > 0) {
      estimated_minutes = estimateUnit === "hours" ? Math.round(numVal * 60) : Math.round(numVal);
    }

    const recurrence_rule = isRecurring
      ? buildRrule(rruleFreq, rruleByDay, rruleByMonthDay)
      : null;

    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      tags,
      deadline,
      estimated_minutes,
      is_recurring: isRecurring,
      recurrence_rule,
      subtasks: subtasks.filter((s) => !s.isDeleted),
    });

    setSaving(false);
  }

  const visibleSubtasks = subtasks.filter((s) => !s.isDeleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the task details below." : "Fill in the details for your new task."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex rounded-lg border overflow-hidden">
              {(["todo", "in_progress", "done"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm transition-colors",
                    status === s
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                  onClick={() => setStatus(s)}
                >
                  {s === "todo" ? "Todo" : s === "in_progress" ? "In Progress" : "Done"}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">
                  <span className="flex items-center gap-2">🔴 High</span>
                </SelectItem>
                <SelectItem value="medium">
                  <span className="flex items-center gap-2">🟡 Medium</span>
                </SelectItem>
                <SelectItem value="low">
                  <span className="flex items-center gap-2">⚪ Low</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Type a tag and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                list="tag-suggestions"
              />
              <datalist id="tag-suggestions">
                {allTags
                  .filter((t) => !tags.includes(t))
                  .map((t) => (
                    <option key={t} value={t} />
                  ))}
              </datalist>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label>Deadline</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-auto"
              />
              {showTime && (
                <Input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="w-auto"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTime(!showTime)}
              >
                {showTime ? "Remove time" : "Add time"}
              </Button>
              {deadlineDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeadlineDate("");
                    setDeadlineTime("");
                    setShowTime(false);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Time Estimate */}
          <div className="space-y-1.5">
            <Label>Time Estimate</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="1"
                value={estimateValue}
                onChange={(e) => setEstimateValue(e.target.value)}
                placeholder="0"
                className="w-24"
              />
              <Select value={estimateUnit} onValueChange={(v) => setEstimateUnit(v as typeof estimateUnit)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recurring */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(v) => setIsRecurring(Boolean(v))}
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Recurring task
              </Label>
            </div>
            {isRecurring && (
              <div className="ml-6 space-y-2">
                <Select value={rruleFreq} onValueChange={setRruleFreq}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                {rruleFreq === "WEEKLY" && (
                  <div className="flex flex-wrap gap-1">
                    {DAYS_OF_WEEK.map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs border transition-colors",
                          rruleByDay.includes(day)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-accent"
                        )}
                        onClick={() => toggleDay(day)}
                      >
                        {DAY_LABELS[i]}
                      </button>
                    ))}
                  </div>
                )}
                {rruleFreq === "MONTHLY" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Day of month:</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={rruleByMonthDay}
                      onChange={(e) => setRruleByMonthDay(parseInt(e.target.value, 10) || 1)}
                      className="w-20"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label>
              Subtasks{" "}
              {visibleSubtasks.length > 0 && (
                <span className="text-muted-foreground">({visibleSubtasks.length})</span>
              )}
            </Label>
            <div className="space-y-1">
              {subtasks.map((sub, i) =>
                sub.isDeleted ? null : (
                  <div key={sub.id ?? `new-${i}`} className="flex items-center gap-2">
                    <Checkbox
                      checked={sub.status === "done"}
                      onCheckedChange={() => toggleSubtask(i)}
                    />
                    <Input
                      value={sub.title}
                      onChange={(e) => updateSubtaskTitle(i, e.target.value)}
                      className="h-8 text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => deleteSubtask(i)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add subtask..."
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={addSubtask}
                disabled={!newSubtaskTitle.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isEditing && task && onDelete && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive">Delete this task?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(task.id)}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
