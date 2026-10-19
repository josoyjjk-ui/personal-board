-- 불개미 Personal Board — phase 1 (fireant-hub jcuuvazpexyinjjruplc). 신규 객체만 생성.
-- 접근: @bridge34.com 구글 계정 전원 + josoyjjk@gmail.com. '가족' 영역은 오너 2계정(fireant@bridge34.com, josoyjjk@gmail.com)만.

create table if not exists public.personal_tasks (
  id          uuid primary key default gen_random_uuid(),
  area        text not null check (area in ('가족','불개미','협업','회사')),
  title       text not null check (length(btrim(title)) > 0),
  due         date,
  done        boolean not null default false,
  note        text,
  source      text not null default '수동',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists personal_tasks_area_idx on public.personal_tasks (area, done, due);

create or replace function public.personal_tasks_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists personal_tasks_touch on public.personal_tasks;
create trigger personal_tasks_touch before update on public.personal_tasks
  for each row execute function public.personal_tasks_touch();

-- 접근 규칙 (여기만 고치면 됨)
create or replace function public.board_email() returns text
language sql stable set search_path = '' as $$ select lower(coalesce((select auth.jwt()) ->> 'email', '')) $$;

create or replace function public.is_board_owner() returns boolean
language sql stable set search_path = '' as $$
  select public.board_email() in ('fireant@bridge34.com', 'josoyjjk@gmail.com') $$;

create or replace function public.is_board_member() returns boolean
language sql stable set search_path = '' as $$
  select public.is_board_owner() or public.board_email() like '%@bridge34.com' $$;

alter table public.personal_tasks enable row level security;
alter table public.personal_tasks force row level security;
revoke all on public.personal_tasks from anon, public;
grant select, insert, update, delete on public.personal_tasks to authenticated;

drop policy if exists personal_tasks_owner_select on public.personal_tasks;
drop policy if exists personal_tasks_owner_insert on public.personal_tasks;
drop policy if exists personal_tasks_owner_update on public.personal_tasks;
drop policy if exists personal_tasks_owner_delete on public.personal_tasks;
drop policy if exists pt_select on public.personal_tasks;
drop policy if exists pt_insert on public.personal_tasks;
drop policy if exists pt_update on public.personal_tasks;
drop policy if exists pt_delete on public.personal_tasks;

create policy pt_select on public.personal_tasks for select to authenticated
  using (public.is_board_member() and (area <> '가족' or public.is_board_owner()));
create policy pt_insert on public.personal_tasks for insert to authenticated
  with check (public.is_board_member() and (area <> '가족' or public.is_board_owner()));
create policy pt_update on public.personal_tasks for update to authenticated
  using (public.is_board_member() and (area <> '가족' or public.is_board_owner()))
  with check (public.is_board_member() and (area <> '가족' or public.is_board_owner()));
create policy pt_delete on public.personal_tasks for delete to authenticated
  using (public.is_board_member() and (area <> '가족' or public.is_board_owner()));
