-- Migration: 20260315000002_db_maintenance.sql
-- Purpose: Performance indexes for common query patterns identified in audit.
-- Rollback strategy (DOWN):
--   DROP INDEX IF EXISTS idx_tasks_user_status;
--   DROP INDEX IF EXISTS idx_tasks_user_deadline;
--   DROP INDEX IF EXISTS idx_saved_foods_user_usecount;

-- Tasks: filter by user_id + status (Kanban columns, tag-counts endpoint)
CREATE INDEX IF NOT EXISTS idx_tasks_user_status
  ON tasks(user_id, status);

-- Tasks: filter by user_id + deadline for overdue queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline
  ON tasks(user_id, deadline) WHERE deadline IS NOT NULL;

-- Saved foods: sort by use_count DESC for food library quick-access
CREATE INDEX IF NOT EXISTS idx_saved_foods_user_usecount
  ON saved_foods(user_id, use_count DESC);
