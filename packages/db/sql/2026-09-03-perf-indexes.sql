-- Performance indexes for the dashboard and invoice list.
--
-- `invoices_workspace_updated_idx` backs the dashboard "recent invoices" list,
-- which orders a workspace's invoices by `updated_at` and takes 10. Without it
-- Postgres sorts the whole workspace partition on every dashboard view.
--
-- CONCURRENTLY so this does not take a write lock on a populated table. Run it
-- outside a transaction block (psql without -1, or a bare `\i`).

CREATE INDEX CONCURRENTLY IF NOT EXISTS invoices_workspace_updated_idx
  ON invoices (workspace_id, updated_at);
