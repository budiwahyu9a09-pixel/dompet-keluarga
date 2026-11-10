-- Dompet Keluarga — Supabase schema (already applied to project keuangan-keluarga)
-- Generic document store that mirrors the app's path-based data model.

create table public.members (
  email text primary key,
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.docs (
  path text primary key,          -- e.g. tx/abc, books/xyz/goals/g1, data/users/<uid>/<book>/tx/t1
  parent text not null,           -- collection path (path minus last segment)
  data jsonb not null default '{}'::jsonb,
  owner uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create index docs_parent_idx on public.docs (parent);

-- Family members (by email) may use every shared path; data/users/<uid>/... is private to that user.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email','')));
$$;
revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

create or replace function public.can_access(p text) returns boolean
language sql stable set search_path = public as $$
  select case
    when p like 'data/users/%' then auth.uid() is not null and p like 'data/users/' || auth.uid()::text || '/%'
    else public.is_member()
  end;
$$;

alter table public.docs enable row level security;
alter table public.members enable row level security;
create policy docs_select on public.docs for select to authenticated using (public.can_access(path));
create policy docs_insert on public.docs for insert to authenticated with check (public.can_access(path));
create policy docs_update on public.docs for update to authenticated using (public.can_access(path)) with check (public.can_access(path));
create policy docs_delete on public.docs for delete to authenticated using (public.can_access(path));
create policy members_select on public.members for select to authenticated using (public.is_member());
create policy members_insert on public.members for insert to authenticated with check (public.is_member());
create policy members_delete on public.members for delete to authenticated using (public.is_member());

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger docs_touch before update on public.docs for each row execute function public.touch_updated_at();

-- The first account ever created becomes the first family member.
-- Sign-ups whose email is already a member are confirmed automatically (no email link needed).
create or replace function public.auto_confirm_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members) then
    insert into public.members(email, added_by) values (lower(new.email), new.id);
  end if;
  if exists (select 1 from public.members m where lower(m.email) = lower(new.email)) then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end $$;
revoke execute on function public.auto_confirm_member() from public, anon, authenticated;
create trigger auto_confirm_member before insert on auth.users for each row execute function public.auto_confirm_member();

alter table public.docs replica identity full;
alter publication supabase_realtime add table public.docs;
