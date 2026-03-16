-- Task Performance Optimization Indexes
-- Created: 2026-03-16
-- Purpose: Add indexes to improve task query performance, especially for subtask lookups

-- Index for subtask queries (parent_task_id lookups)
-- This is critical for the new subtask count aggregation in getTasks()
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id 
ON tasks(parent_task_id) 
WHERE parent_task_id IS NOT NULL;

-- Composite index for user's tasks filtered by status
-- Optimizes queries like: WHERE user_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_tasks_user_status 
ON tasks(user_id, status) 
WHERE parent_task_id IS NULL;

-- Index for default sort (created_at descending for top-level tasks)
-- Optimizes the default task list query
CREATE INDEX IF NOT EXISTS idx_tasks_user_created 
ON tasks(user_id, created_at DESC) 
WHERE parent_task_id IS NULL;

-- Index for deadline sorting
-- Optimizes queries with sortBy=deadline
CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline 
ON tasks(user_id, deadline) 
WHERE parent_task_id IS NULL AND deadline IS NOT NULL;

-- Index for tag filtering
-- Optimizes queries filtering by tags using GIN index for array contains
CREATE INDEX IF NOT EXISTS idx_tasks_tags 
ON tasks USING GIN(tags) 
WHERE tags IS NOT NULL;

-- Composite index for subtask status queries
-- Optimizes the subtask count aggregation (counting done vs total)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_status 
ON tasks(parent_task_id, status) 
WHERE parent_task_id IS NOT NULL;

-- Add comment explaining the optimization
COMMENT ON INDEX idx_tasks_parent_task_id IS 'Optimizes subtask lookups for parent tasks';
COMMENT ON INDEX idx_tasks_user_status IS 'Optimizes filtered task list queries by status';
COMMENT ON INDEX idx_tasks_user_created IS 'Optimizes default task list sorting';
COMMENT ON INDEX idx_tasks_user_deadline IS 'Optimizes deadline-sorted queries';
COMMENT ON INDEX idx_tasks_tags IS 'Optimizes tag filtering with GIN index';
COMMENT ON INDEX idx_tasks_parent_status IS 'Optimizes subtask count aggregation by status';
