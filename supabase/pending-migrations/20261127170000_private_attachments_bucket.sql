-- NOT APPLIED: private attachments cutover.
--
-- Today the `attachments` bucket is public and the app stores public URLs in
-- `attachments[].src` (note attachments, contact avatars, company logos). Public
-- object URLs bypass RLS, so anyone with the URL can read an object regardless
-- of organization. Flipping the bucket private closes that path but breaks every
-- stored public URL until the client serves objects through signed URLs.
--
-- Apply only after the client cutover described in docs/organization-isolation.md
-- (signed URLs at read time + `src` backfill). This file lives outside
-- `supabase/migrations` on purpose so `supabase db push` cannot apply it by
-- accident.
--
-- Rollback:
--   update storage.buckets set public = true where id = 'attachments';

update storage.buckets set public = false where id = 'attachments';
