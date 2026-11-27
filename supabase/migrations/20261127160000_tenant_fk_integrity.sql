-- Cross-organization foreign-key integrity.
--
-- Scalar relationships become composite foreign keys: the child's
-- organization_id is part of the reference, so a row can only point at a
-- parent in its own organization. Array relationships (deals.contact_ids,
-- contacts.tags) get read-only validation triggers because arrays cannot carry
-- a foreign key.
--
-- Existing data is known consistent (pre-checked), so the constraints are
-- added validated. Rollback: drop the constraints below and recreate the
-- single-column ones with the original definitions.

alter table public.companies add constraint companies_id_organization_id_key unique (id, organization_id);
alter table public.contacts add constraint contacts_id_organization_id_key unique (id, organization_id);
alter table public.deals add constraint deals_id_organization_id_key unique (id, organization_id);

alter table public.contacts drop constraint contacts_company_id_fkey;
alter table public.contacts add constraint contacts_company_organization_fkey
    foreign key (company_id, organization_id) references public.companies (id, organization_id)
    on update cascade on delete cascade;

alter table public.deals drop constraint deals_company_id_fkey;
alter table public.deals add constraint deals_company_organization_fkey
    foreign key (company_id, organization_id) references public.companies (id, organization_id)
    on update cascade on delete cascade;

alter table public.contact_notes drop constraint "contactNotes_contact_id_fkey";
alter table public.contact_notes add constraint contact_notes_contact_organization_fkey
    foreign key (contact_id, organization_id) references public.contacts (id, organization_id)
    on update cascade on delete cascade;

alter table public.deal_notes drop constraint "dealNotes_deal_id_fkey";
alter table public.deal_notes add constraint deal_notes_deal_organization_fkey
    foreign key (deal_id, organization_id) references public.deals (id, organization_id)
    on update cascade on delete cascade;

alter table public.tasks drop constraint tasks_contact_id_fkey;
alter table public.tasks add constraint tasks_contact_organization_fkey
    foreign key (contact_id, organization_id) references public.contacts (id, organization_id)
    on update cascade on delete cascade;

CREATE OR REPLACE FUNCTION "public"."validate_contact_tag_organizations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- SECURITY DEFINER is required to *see* tags hidden by RLS; this function
  -- only reads and rejects, it never writes. Every requested tag must exist in
  -- the contact's organization.
  if coalesce(cardinality(new.tags), 0) > 0
     and (
       select count(distinct tag_id) from unnest(new.tags) as tag_id
     ) <> (
       select count(*) from public.tags t
       where t.id = any(new.tags) and t.organization_id = new.organization_id
     )
  then
    raise exception 'Contact tags must belong to the contact organization'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."validate_deal_contact_organizations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- SECURITY DEFINER is required to *see* contacts hidden by RLS; this function
  -- only reads and rejects, it never writes. Every referenced contact must
  -- exist in the deal's organization.
  if coalesce(cardinality(new.contact_ids), 0) > 0
     and (
       select count(distinct contact_id) from unnest(new.contact_ids) as contact_id
     ) <> (
       select count(*) from public.contacts c
       where c.id = any(new.contact_ids) and c.organization_id = new.organization_id
     )
  then
    raise exception 'Deal contacts must belong to the deal organization'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create or replace trigger validate_contact_tags_organization
    before insert or update on public.contacts
    for each row execute function public.validate_contact_tag_organizations();

create or replace trigger validate_deal_contacts_organization
    before insert or update on public.deals
    for each row execute function public.validate_deal_contact_organizations();

grant all on function public.validate_contact_tag_organizations() to anon;
grant all on function public.validate_contact_tag_organizations() to authenticated;
grant all on function public.validate_contact_tag_organizations() to service_role;

grant all on function public.validate_deal_contact_organizations() to anon;
grant all on function public.validate_deal_contact_organizations() to authenticated;
grant all on function public.validate_deal_contact_organizations() to service_role;
