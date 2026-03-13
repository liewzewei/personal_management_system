-- Performance indexes for PMS.
-- Created to speed up common query patterns across tasks, calendar, and diary.

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(user_id, deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(user_id, completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);

-- Calendar events
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range ON calendar_events(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_outlook_id ON calendar_events(outlook_event_id) WHERE outlook_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_task_id ON calendar_events(task_id) WHERE task_id IS NOT NULL;

-- Diary entries
CREATE INDEX IF NOT EXISTS idx_diary_entries_user_id ON diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_updated_at ON diary_entries(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_tags ON diary_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_diary_entries_search ON diary_entries USING GIN(to_tsvector('english', content_text))
  WHERE content_text IS NOT NULL;
