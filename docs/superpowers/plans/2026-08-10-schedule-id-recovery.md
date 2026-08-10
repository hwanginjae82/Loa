# 일정 캐릭터 연결 복구 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공용 DB의 예전 일정 ID를 현재 멤버별 캐릭터 순번에 맞는 실제 ID로 안전하게 변환해 `캐릭터 정보 없음`을 제거한다.

**Architecture:** 백업 JSON을 입력으로 받는 순수 변환 함수를 먼저 테스트한다. 변환 결과에 미해결 ID가 하나라도 있으면 DB에 쓰지 않으며, 검증이 끝난 결과의 `schedule` 필드만 Supabase에 반영하고 다시 읽어 확인한다.

**Tech Stack:** Node.js 내장 테스트 러너, JavaScript ES modules, Supabase REST API

---

### Task 1: 순번 기반 복구 함수

**Files:**
- Create: `scripts/recover-legacy-schedule.mjs`
- Test: `tests/character-id-recovery.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

테스트는 `s2`가 스카치의 두 번째 현재 캐릭터 ID로 변환되고, 알 수 없는 접두사나 없는 순번은 오류가 되며, 일정의 다른 필드는 그대로 유지되는지 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/character-id-recovery.test.mjs`
Expected: 복구 모듈이 아직 없어서 FAIL

- [ ] **Step 3: 최소 구현 작성**

`recoverLegacySchedule({ schedule, members, prefixToMemberName })`가 모든 주·요일·레이드의 `characterIds`를 변환하고 `{ schedule, mappings, unresolved }`를 반환하도록 구현한다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/character-id-recovery.test.mjs`
Expected: 모든 테스트 PASS

### Task 2: 실제 백업 데이터 드라이런

**Files:**
- Read: `audit/db-backups/raid_board_state-guild-main-20260810-173807.json`
- Create: `audit/db-backups/raid_board_state-guild-main-20260810-173807-recovered-preview.json`

- [ ] **Step 1: 백업에 복구 함수 실행**

24개의 고유 예전 ID와 모든 슬롯의 변환표를 만든다.

- [ ] **Step 2: 쓰기 전 검증**

미해결 ID 0개, 중복 대상 키 0개, 멤버 16명·캐릭터 88명 유지, 일정 외 데이터 변경 없음이어야 한다.

### Task 3: 공용 DB 복구와 재검증

**Files:**
- Read: 복구 전 백업과 복구 미리보기 JSON

- [ ] **Step 1: 일정 필드만 갱신**

Supabase `raid_board_state`의 `guild-main` 행에서 `schedule`만 복구 결과로 변경한다.

- [ ] **Step 2: DB를 다시 읽어 검증**

모든 비어 있지 않은 일정 ID가 현재 멤버 캐릭터 하나와 정확히 일치해야 한다.

- [ ] **Step 3: 공개 사이트 확인**

공개 사이트를 새로 읽어 공용 DB 연결 상태에서 `캐릭터 정보 없음`이 0개인지 확인한다.

- [ ] **Step 4: 실패 시 롤백**

검증에 실패하면 원본 백업의 전체 행을 즉시 복원한다.
