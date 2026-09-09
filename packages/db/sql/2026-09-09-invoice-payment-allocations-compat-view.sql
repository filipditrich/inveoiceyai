-- Keep the pre-36b table name readable so a live deploy that still queries
-- invoice_payment_allocations does not crash after the rename.
-- New code reads payment_allocations. The view is a compatibility alias.

CREATE OR REPLACE VIEW invoice_payment_allocations AS
  SELECT * FROM payment_allocations;
