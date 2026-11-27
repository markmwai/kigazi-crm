--
-- Storage
-- This file declares storage bucket policies.
--
-- Paths are organization-scoped: the first segment is the active Clerk
-- organization id (see docs/organization-isolation.md).
--

create policy "Attachments select" on storage.objects for select to authenticated using (bucket_id = 'attachments' and starts_with(name, public.current_organization_id() || '/'));
create policy "Attachments insert" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and starts_with(name, public.current_organization_id() || '/'));
create policy "Attachments update" on storage.objects for update to authenticated using (bucket_id = 'attachments' and starts_with(name, public.current_organization_id() || '/')) with check (bucket_id = 'attachments' and starts_with(name, public.current_organization_id() || '/'));
create policy "Attachments delete" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and starts_with(name, public.current_organization_id() || '/'));
