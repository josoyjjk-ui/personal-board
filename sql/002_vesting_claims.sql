-- 베스팅·클레임 일정 (fireant-hub). 클레임 1회 = 1행. '개인'은 오너 2계정만, '회사'는 보드 멤버 전원.
create table if not exists public.vesting_claims (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('개인','회사')),
  project     text not null check (length(btrim(project)) > 0),
  token       text,
  amount      numeric,
  claim_date  date not null,
  claim_url   text,
  note        text,
  claimed     boolean not null default false,
  batch_id    uuid,                       -- 반복 생성(월별 베스팅)으로 같이 만든 행 묶음
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vesting_claims_date_idx on public.vesting_claims (claim_date, claimed);

drop trigger if exists vesting_claims_touch on public.vesting_claims;
create trigger vesting_claims_touch before update on public.vesting_claims
  for each row execute function public.personal_tasks_touch();

alter table public.vesting_claims enable row level security;
alter table public.vesting_claims force row level security;
revoke all on public.vesting_claims from anon, public;
grant select, insert, update, delete on public.vesting_claims to authenticated;

drop policy if exists vc_select on public.vesting_claims;
drop policy if exists vc_insert on public.vesting_claims;
drop policy if exists vc_update on public.vesting_claims;
drop policy if exists vc_delete on public.vesting_claims;
create policy vc_select on public.vesting_claims for select to authenticated
  using (public.is_board_member() and (scope <> '개인' or public.is_board_owner()));
create policy vc_insert on public.vesting_claims for insert to authenticated
  with check (public.is_board_member() and (scope <> '개인' or public.is_board_owner()));
create policy vc_update on public.vesting_claims for update to authenticated
  using (public.is_board_member() and (scope <> '개인' or public.is_board_owner()))
  with check (public.is_board_member() and (scope <> '개인' or public.is_board_owner()));
create policy vc_delete on public.vesting_claims for delete to authenticated
  using (public.is_board_member() and (scope <> '개인' or public.is_board_owner()));
