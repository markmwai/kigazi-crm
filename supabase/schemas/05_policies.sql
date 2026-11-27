--
-- Row Level Security
-- This file declares RLS policies for all tables.
--
-- Tenant tables are scoped to the active Clerk organization, read from the JWT
-- by current_organization_id(). Sales, configuration and favicons stay global:
-- they are identity or app-wide settings, not tenant data.
--

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.deals enable row level security;
alter table public.deal_notes enable row level security;
alter table public.sales enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;
alter table public.user_invitations enable row level security;

-- Companies
create policy "Companies select" on public.companies for select to authenticated using (organization_id = public.current_organization_id());
create policy "Companies insert" on public.companies for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Companies update" on public.companies for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Companies delete" on public.companies for delete to authenticated using (organization_id = public.current_organization_id());

-- Contacts
create policy "Contacts select" on public.contacts for select to authenticated using (organization_id = public.current_organization_id());
create policy "Contacts insert" on public.contacts for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Contacts update" on public.contacts for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Contacts delete" on public.contacts for delete to authenticated using (organization_id = public.current_organization_id());

-- Contact Notes
create policy "Contact Notes select" on public.contact_notes for select to authenticated using (organization_id = public.current_organization_id());
create policy "Contact Notes insert" on public.contact_notes for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Contact Notes update" on public.contact_notes for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Contact Notes delete" on public.contact_notes for delete to authenticated using (organization_id = public.current_organization_id());

-- Deals
create policy "Deals select" on public.deals for select to authenticated using (organization_id = public.current_organization_id());
create policy "Deals insert" on public.deals for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Deals update" on public.deals for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Deals delete" on public.deals for delete to authenticated using (organization_id = public.current_organization_id());

-- Deal Notes
create policy "Deal Notes select" on public.deal_notes for select to authenticated using (organization_id = public.current_organization_id());
create policy "Deal Notes insert" on public.deal_notes for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Deal Notes update" on public.deal_notes for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Deal Notes delete" on public.deal_notes for delete to authenticated using (organization_id = public.current_organization_id());

-- Tags
create policy "Tags select" on public.tags for select to authenticated using (organization_id = public.current_organization_id());
create policy "Tags insert" on public.tags for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Tags update" on public.tags for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Tags delete" on public.tags for delete to authenticated using (organization_id = public.current_organization_id());

-- Tasks
create policy "Tasks select" on public.tasks for select to authenticated using (organization_id = public.current_organization_id());
create policy "Tasks insert" on public.tasks for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Tasks update" on public.tasks for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Tasks delete" on public.tasks for delete to authenticated using (organization_id = public.current_organization_id());

-- Sales (global identity: a user may belong to several organizations)
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (true);

-- Configuration (app-wide branding; admin-only writes)
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains (global lookup used by a trigger)
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);
