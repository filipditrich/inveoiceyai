-- Plan 36a — watch sessions.
-- While `watch_until` is in the future someone is waiting on a payment, so the
-- connection is polled at the provider's floor and the sweep leaves it alone.
ALTER TABLE bank_connections
  ADD COLUMN IF NOT EXISTS watch_until timestamptz;
