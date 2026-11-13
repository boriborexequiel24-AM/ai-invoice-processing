-- Phase 3: an invoice has been read by AI but not yet checked.
-- Validation (phase 4) moves it on to ready_for_approval, needs_review or flagged.
alter type invoice_status add value if not exists 'extracted' after 'extracting';
