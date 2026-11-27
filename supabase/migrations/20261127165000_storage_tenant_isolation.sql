-- Organization-scoped attachment access.
--
-- Object paths are prefixed with the organization id by the client
-- (`uploadToBucket`), e.g. `org_2abc/0.8262106278726917.pdf`. The policies
-- compare that first segment with the caller's active Clerk organization, so
-- list, download, signed-URL creation, upload, overwrite/move (update), copy
-- (insert) and delete are all scoped.
--
-- The bucket is still PUBLIC (see supabase/pending-migrations for the cutover):
-- public object URLs bypass RLS, so this migration does not close that path on
-- its own. See docs/organization-isolation.md for the impact and the plan.

drop policy if exists "Attachments 1mt4rzk_0" on storage.objects;
drop policy if exists "Attachments 1mt4rzk_1" on storage.objects;
drop policy if exists "Attachments 1mt4rzk_3" on storage.objects;

create policy "Attachments select" on storage.objects for select to authenticated
    using (
        bucket_id = 'attachments'
        and starts_with(name, public.current_organization_id() || '/')
    );

create policy "Attachments insert" on storage.objects for insert to authenticated
    with check (
        bucket_id = 'attachments'
        and starts_with(name, public.current_organization_id() || '/')
    );

create policy "Attachments update" on storage.objects for update to authenticated
    using (
        bucket_id = 'attachments'
        and starts_with(name, public.current_organization_id() || '/')
    )
    with check (
        bucket_id = 'attachments'
        and starts_with(name, public.current_organization_id() || '/')
    );

create policy "Attachments delete" on storage.objects for delete to authenticated
    using (
        bucket_id = 'attachments'
        and starts_with(name, public.current_organization_id() || '/')
    );
