alter table public.brands add constraint brands_id_workspace_unique unique (id, workspace_id);
alter table public.brand_guideline_versions add constraint brand_guideline_versions_id_brand_workspace_unique unique (id, brand_id, workspace_id);
alter table public.brand_rules add constraint brand_rules_id_workspace_unique unique (id, workspace_id);
alter table public.audits add constraint audits_id_workspace_unique unique (id, workspace_id);
alter table public.audit_findings add constraint audit_findings_id_audit_workspace_unique unique (id, audit_id, workspace_id);

alter table public.audit_findings add column brand_id uuid;
alter table public.audit_findings add column guideline_version_id uuid;
update public.audit_findings f
set brand_id = a.brand_id, guideline_version_id = a.guideline_version_id
from public.audits a
where a.id = f.audit_id;
alter table public.audit_findings alter column brand_id set not null;
alter table public.audit_findings alter column guideline_version_id set not null;

alter table public.audits add column rule_snapshot jsonb not null default '[]'::jsonb;
alter table public.audits add column scorer_version text not null default 'deterministic-demo-v1';
alter table public.audits add column idempotency_key text;
create unique index audits_created_by_idempotency_uidx on public.audits(created_by, idempotency_key) where idempotency_key is not null;

alter table public.brand_guideline_versions add constraint guidelines_brand_workspace_fk foreign key (brand_id, workspace_id) references public.brands(id, workspace_id);
alter table public.brand_rules add constraint rules_brand_workspace_fk foreign key (brand_id, workspace_id) references public.brands(id, workspace_id);
alter table public.brand_rules add constraint rules_guideline_parent_fk foreign key (guideline_version_id, brand_id, workspace_id) references public.brand_guideline_versions(id, brand_id, workspace_id);
alter table public.audits add constraint audits_brand_workspace_fk foreign key (brand_id, workspace_id) references public.brands(id, workspace_id);
alter table public.audits add constraint audits_guideline_parent_fk foreign key (guideline_version_id, brand_id, workspace_id) references public.brand_guideline_versions(id, brand_id, workspace_id);
alter table public.audit_findings add constraint findings_audit_workspace_fk foreign key (audit_id, workspace_id) references public.audits(id, workspace_id);
alter table public.audit_findings add constraint findings_guideline_parent_fk foreign key (guideline_version_id, brand_id, workspace_id) references public.brand_guideline_versions(id, brand_id, workspace_id);
alter table public.audit_findings add constraint findings_rule_workspace_fk foreign key (rule_id, workspace_id) references public.brand_rules(id, workspace_id);
alter table public.audit_reviews add constraint reviews_finding_parent_fk foreign key (finding_id, audit_id, workspace_id) references public.audit_findings(id, audit_id, workspace_id);

create or replace function private.guard_guideline_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'archived' then
    raise exception 'Archived guideline versions are immutable';
  end if;
  if old.status = 'approved' and (
    new.title is distinct from old.title or
    new.source_document_name is distinct from old.source_document_name or
    new.source_text is distinct from old.source_text or
    new.brand_id is distinct from old.brand_id or
    new.workspace_id is distinct from old.workspace_id or
    new.version_number is distinct from old.version_number or
    new.created_by is distinct from old.created_by
  ) then
    raise exception 'Approved guideline versions are immutable; create a new version';
  end if;
  if old.status = 'approved' and new.status not in ('approved', 'archived') then
    raise exception 'Approved guideline versions can only be archived';
  end if;
  return new;
end;
$$;

create or replace function private.guard_approved_rule_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  guideline_status public.guideline_status;
begin
  select status into guideline_status from public.brand_guideline_versions where id = old.guideline_version_id;
  if guideline_status in ('approved', 'archived') then
    raise exception 'Rules for approved guideline versions are immutable';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guideline_immutability_guard before update on public.brand_guideline_versions for each row execute function private.guard_guideline_immutability();
create trigger approved_rule_update_guard before update on public.brand_rules for each row execute function private.guard_approved_rule_mutation();
create trigger approved_rule_delete_guard before delete on public.brand_rules for each row execute function private.guard_approved_rule_mutation();
