# Supabase 변경 이력 보관 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `raid_board_state`가 수정될 때마다 수정 직전 전체 상태를 비공개 이력 표에 자동 보관한다.

**Architecture:** PostgreSQL `BEFORE UPDATE` 트리거가 기존 행의 `members`, `catalog`, `schedule`, `updated_at`을 `raid_board_state_history`에 넣는다. 트리거 함수는 `SECURITY DEFINER`로 실행해 익명 사용자의 기존 수정은 유지하되 이력 표 자체에는 익명 접근 권한을 주지 않는다.

**Tech Stack:** Supabase PostgreSQL, PL/pgSQL, Row Level Security

---

### 작업 1: 현재 상태 백업

**Files:**
- Create: `audit/db-backups/raid_board_state-guild-main-<timestamp>-before-history.json`

- [ ] **1단계: 현재 `guild-main` 행을 읽어 파일로 저장**

기존 읽기 전용 백업 스크립트로 `id`, `members`, `catalog`, `schedule`, `updated_at` 전체를 저장한다.

- [ ] **2단계: 백업 파일 검증**

JSON 파싱에 성공하고 `id`가 `guild-main`인지 확인한다. `schedule.weeks`와 `members`가 들어 있어야 한다.

### 작업 2: 변경 이력 SQL 작성

**Files:**
- Create: `supabase/change-history.sql`

- [ ] **1단계: 적용 전 실패 확인**

Supabase SQL Editor에서 아래 조회를 실행한다.

```sql
select to_regclass('public.raid_board_state_history') as history_table;
```

Expected: `history_table`이 `null`이다.

- [ ] **2단계: 최소 구현 작성**

```sql
create table if not exists public.raid_board_state_history (
  history_id bigint generated always as identity primary key,
  state_id text not null,
  members jsonb not null,
  catalog jsonb not null,
  schedule jsonb not null,
  source_updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index if not exists raid_board_state_history_state_archived_idx
  on public.raid_board_state_history (state_id, archived_at desc);

alter table public.raid_board_state_history enable row level security;
revoke all on table public.raid_board_state_history from anon, authenticated;
revoke all on sequence public.raid_board_state_history_history_id_seq from anon, authenticated;

insert into public.raid_board_state_history (
  state_id,
  members,
  catalog,
  schedule,
  source_updated_at
)
select id, members, catalog, schedule, updated_at
from public.raid_board_state
where id = 'guild-main'
  and not exists (
    select 1
    from public.raid_board_state_history
    where state_id = 'guild-main'
  );

create or replace function public.archive_raid_board_state_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.raid_board_state_history (
    state_id,
    members,
    catalog,
    schedule,
    source_updated_at
  ) values (
    old.id,
    old.members,
    old.catalog,
    old.schedule,
    old.updated_at
  );
  return new;
end;
$$;

revoke all on function public.archive_raid_board_state_before_update() from public, anon, authenticated;

drop trigger if exists archive_raid_board_state_before_update
  on public.raid_board_state;

create trigger archive_raid_board_state_before_update
before update on public.raid_board_state
for each row
execute function public.archive_raid_board_state_before_update();
```

- [ ] **3단계: SQL 자체 점검**

파일에 이력 표, 최초 복구 지점, RLS, 권한 회수, `SECURITY DEFINER`, 빈 `search_path`, 트리거 재생성이 모두 포함됐는지 확인한다.

### 작업 3: Supabase 적용

**Files:**
- Execute: `supabase/change-history.sql`

- [ ] **1단계: SQL Editor에서 전체 SQL 실행**

Expected: 오류 없이 완료된다.

- [ ] **2단계: 구조 검증**

```sql
select
  to_regclass('public.raid_board_state_history') as history_table,
  c.relrowsecurity as rls_enabled,
  t.tgenabled as trigger_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_trigger t
  on t.tgrelid = 'public.raid_board_state'::regclass
 and t.tgname = 'archive_raid_board_state_before_update'
where n.nspname = 'public'
  and c.relname = 'raid_board_state_history';
```

Expected: 표 이름이 나오고 `rls_enabled = true`, `trigger_enabled = O`이다.

### 작업 4: 실제 동작 검증

**Files:**
- Verify: Supabase SQL Editor

- [ ] **1단계: 데이터 변화 없는 갱신으로 트리거 실행**

```sql
update public.raid_board_state
set updated_at = updated_at
where id = 'guild-main';
```

Expected: `1 row`이 수정되고 현재 상태 내용은 바뀌지 않는다.

- [ ] **2단계: 최신 이력이 현재 상태와 일치하는지 확인**

```sql
select
  h.history_id,
  h.state_id,
  h.members = s.members as members_match,
  h.catalog = s.catalog as catalog_match,
  h.schedule = s.schedule as schedule_match,
  h.source_updated_at = s.updated_at as updated_at_match,
  h.archived_at
from public.raid_board_state_history h
join public.raid_board_state s on s.id = h.state_id
where h.state_id = 'guild-main'
order by h.history_id desc
limit 1;
```

Expected: 네 개의 `*_match` 값이 모두 `true`이다.

- [ ] **3단계: 공개 사이트 회귀 확인**

사이트를 새로 열어 일정과 캐릭터 이름이 정상적으로 표시되고 `캐릭터 정보 없음`이 없는지 확인한다.

### 작업 5: 변경 기록

**Files:**
- Add: `supabase/change-history.sql`
- Add: `docs/superpowers/plans/2026-08-10-supabase-change-history.md`

- [ ] **1단계: 작업 파일만 점검**

Run: `git diff --check -- supabase/change-history.sql docs/superpowers/plans/2026-08-10-supabase-change-history.md`

Expected: 출력 없이 종료 코드 0이다.

- [ ] **2단계: 관련 파일만 커밋**

```text
git add -- supabase/change-history.sql docs/superpowers/plans/2026-08-10-supabase-change-history.md
git commit -m "보호: Supabase 변경 이력 자동 저장"
```
