-- 클레임일 없이 프로젝트명만으로도 베스팅 항목 추가 가능
alter table public.vesting_claims alter column claim_date drop not null;
