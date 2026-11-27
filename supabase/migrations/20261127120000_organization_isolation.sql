-- Multi-tenancy: every tenant-owned row belongs to a Clerk organization.
--
-- The active organization travels in the Clerk session token under "o"."id";
-- current_organization_id() reads it, the insert triggers stamp it on new rows,
-- and the RLS policies constrain every read and write to it.
--
-- Existing rows are backfilled with '' and therefore become invisible to every
-- organization. Reassign them before/after deploying if they matter:
--   update public.contacts set organization_id = '<org_id>' where organization_id = '';

alter table "public"."companies" add column "organization_id" text not null default '';
alter table "public"."contacts" add column "organization_id" text not null default '';
alter table "public"."contact_notes" add column "organization_id" text not null default '';
alter table "public"."deals" add column "organization_id" text not null default '';
alter table "public"."deal_notes" add column "organization_id" text not null default '';
alter table "public"."tasks" add column "organization_id" text not null default '';
alter table "public"."tags" add column "organization_id" text not null default '';

create index companies_organization_id_idx on public.companies using btree (organization_id);
create index contacts_organization_id_idx on public.contacts using btree (organization_id);
create index contact_notes_organization_id_idx on public.contact_notes using btree (organization_id);
create index deals_organization_id_idx on public.deals using btree (organization_id);
create index deal_notes_organization_id_idx on public.deal_notes using btree (organization_id);
create index tasks_organization_id_idx on public.tasks using btree (organization_id);
create index tags_organization_id_idx on public.tags using btree (organization_id);

CREATE OR REPLACE FUNCTION "public"."current_organization_id"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
begin
  -- Clerk nests the active organization under "o" in the session token.
  -- Native Supabase tokens (MCP) carry no organization, so they see no
  -- tenant-owned rows.
  return nullif(auth.jwt() -> 'o' ->> 'id', '');
end;
$$;

CREATE OR REPLACE FUNCTION "public"."set_organization_id_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Never overwrite a client-supplied value: the RLS WITH CHECK must see it and
  -- reject a mismatched organization. Fill it only when missing.
  IF coalesce(NEW.organization_id, '') = '' THEN
    NEW.organization_id = coalesce(public.current_organization_id(), '');
  END IF;
  RETURN NEW;
END;
$$;

create or replace trigger set_company_organization_id_trigger
    before insert on public.companies
    for each row execute function public.set_organization_id_default();

create or replace trigger set_contact_organization_id_trigger
    before insert on public.contacts
    for each row execute function public.set_organization_id_default();

create or replace trigger set_contact_notes_organization_id_trigger
    before insert on public.contact_notes
    for each row execute function public.set_organization_id_default();

create or replace trigger set_deal_organization_id_trigger
    before insert on public.deals
    for each row execute function public.set_organization_id_default();

create or replace trigger set_deal_notes_organization_id_trigger
    before insert on public.deal_notes
    for each row execute function public.set_organization_id_default();

create or replace trigger set_task_organization_id_trigger
    before insert on public.tasks
    for each row execute function public.set_organization_id_default();

create or replace trigger set_tag_organization_id_trigger
    before insert on public.tags
    for each row execute function public.set_organization_id_default();

-- Replace the permissive "authenticated users see everything" policies.

drop policy if exists "Enable read access for authenticated users" on public.companies;
drop policy if exists "Enable insert for authenticated users only" on public.companies;
drop policy if exists "Enable update for authenticated users only" on public.companies;
drop policy if exists "Company Delete Policy" on public.companies;

drop policy if exists "Enable read access for authenticated users" on public.contacts;
drop policy if exists "Enable insert for authenticated users only" on public.contacts;
drop policy if exists "Enable update for authenticated users only" on public.contacts;
drop policy if exists "Contact Delete Policy" on public.contacts;

drop policy if exists "Enable read access for authenticated users" on public.contact_notes;
drop policy if exists "Enable insert for authenticated users only" on public.contact_notes;
drop policy if exists "Contact Notes Update policy" on public.contact_notes;
drop policy if exists "Contact Notes Delete Policy" on public.contact_notes;

drop policy if exists "Enable read access for authenticated users" on public.deals;
drop policy if exists "Enable insert for authenticated users only" on public.deals;
drop policy if exists "Enable update for authenticated users only" on public.deals;
drop policy if exists "Deals Delete Policy" on public.deals;

drop policy if exists "Enable read access for authenticated users" on public.deal_notes;
drop policy if exists "Enable insert for authenticated users only" on public.deal_notes;
drop policy if exists "Deal Notes Update Policy" on public.deal_notes;
drop policy if exists "Deal Notes Delete Policy" on public.deal_notes;

drop policy if exists "Enable read access for authenticated users" on public.tags;
drop policy if exists "Enable insert for authenticated users only" on public.tags;
drop policy if exists "Enable update for authenticated users only" on public.tags;
drop policy if exists "Enable delete for authenticated users only" on public.tags;

drop policy if exists "Enable read access for authenticated users" on public.tasks;
drop policy if exists "Enable insert for authenticated users only" on public.tasks;
drop policy if exists "Task Update Policy" on public.tasks;
drop policy if exists "Task Delete Policy" on public.tasks;

create policy "Companies select" on public.companies for select to authenticated using (organization_id = public.current_organization_id());
create policy "Companies insert" on public.companies for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Companies update" on public.companies for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Companies delete" on public.companies for delete to authenticated using (organization_id = public.current_organization_id());

create policy "Contacts select" on public.contacts for select to authenticated using (organization_id = public.current_organization_id());
create policy "Contacts insert" on public.contacts for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Contacts update" on public.contacts for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Contacts delete" on public.contacts for delete to authenticated using (organization_id = public.current_organization_id());

create policy "Contact Notes select" on public.contact_notes for select to authenticated using (organization_id = public.current_organization_id());
create policy "Contact Notes insert" on public.contact_notes for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Contact Notes update" on public.contact_notes for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Contact Notes delete" on public.contact_notes for delete to authenticated using (organization_id = public.current_organization_id());

create policy "Deals select" on public.deals for select to authenticated using (organization_id = public.current_organization_id());
create policy "Deals insert" on public.deals for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Deals update" on public.deals for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Deals delete" on public.deals for delete to authenticated using (organization_id = public.current_organization_id());

create policy "Deal Notes select" on public.deal_notes for select to authenticated using (organization_id = public.current_organization_id());
create policy "Deal Notes insert" on public.deal_notes for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Deal Notes update" on public.deal_notes for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Deal Notes delete" on public.deal_notes for delete to authenticated using (organization_id = public.current_organization_id());

create policy "Tags select" on public.tags for select to authenticated using (organization_id = public.current_organization_id());
create policy "Tags insert" on public.tags for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Tags update" on public.tags for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Tags delete" on public.tags for delete to authenticated using (organization_id = public.current_organization_id());

create policy "Tasks select" on public.tasks for select to authenticated using (organization_id = public.current_organization_id());
create policy "Tasks insert" on public.tasks for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Tasks update" on public.tasks for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy "Tasks delete" on public.tasks for delete to authenticated using (organization_id = public.current_organization_id());

-- Views are security_invoker, so they inherit the policies above. They expose
-- organization_id so the client can filter on it too.

create or replace view public.activity_log with (security_invoker = on) as
select
    ('company.' || c.id || '.created') as id,
    'company.created' as type,
    c.created_at as date,
    c.id as company_id,
    c.sales_id,
    (to_jsonb(c.*) - 'fts')::json as company,
    null::json as contact,
    null::json as deal,
    null::json as contact_note,
    null::json as deal_note,
    c.organization_id
from public.companies c
union all
select
    ('contact.' || co.id || '.created') as id,
    'contact.created' as type,
    co.first_seen as date,
    co.company_id,
    co.sales_id,
    null::json as company,
    (to_jsonb(co.*) - 'fts')::json as contact,
    null::json as deal,
    null::json as contact_note,
    null::json as deal_note,
    co.organization_id
from public.contacts co
union all
select
    ('contactNote.' || cn.id || '.created') as id,
    'contactNote.created' as type,
    cn.date,
    co.company_id,
    cn.sales_id,
    null::json as company,
    null::json as contact,
    null::json as deal,
    (to_jsonb(cn.*) - 'fts')::json as contact_note,
    null::json as deal_note,
    cn.organization_id
from public.contact_notes cn
    left join public.contacts co on co.id = cn.contact_id
union all
select
    ('deal.' || d.id || '.created') as id,
    'deal.created' as type,
    d.created_at as date,
    d.company_id,
    d.sales_id,
    null::json as company,
    null::json as contact,
    (to_jsonb(d.*) - 'fts')::json as deal,
    null::json as contact_note,
    null::json as deal_note,
    d.organization_id
from public.deals d
union all
select
    ('dealNote.' || dn.id || '.created') as id,
    'dealNote.created' as type,
    dn.date,
    d.company_id,
    dn.sales_id,
    null::json as company,
    null::json as contact,
    null::json as deal,
    null::json as contact_note,
    (to_jsonb(dn.*) - 'fts')::json as deal_note,
    dn.organization_id
from public.deal_notes dn
    left join public.deals d on d.id = dn.deal_id;

create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts,
    c.organization_id
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;

create or replace view public.contacts_summary with (security_invoker = on) as
select
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks,
    co.organization_id
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
group by co.id, c.name;

grant all on function public.current_organization_id() to anon;
grant all on function public.current_organization_id() to authenticated;
grant all on function public.current_organization_id() to service_role;
