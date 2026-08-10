# Character Name Identity And Schedule Recovery Design

## Goal

Restore every legacy weekly schedule slot that currently renders as `캐릭터 정보 없음`, then prevent manual roster refreshes from breaking assignments again.

## Confirmed Current State

- Supabase row `guild-main` was backed up before any mutation.
- The current roster contains 16 members and 88 characters.
- The active week is stored under `schedule.weeks["2026-08-12"]`.
- Its slots contain 24 distinct legacy IDs such as `s1`, `j3`, and `m2`.
- Current character IDs use generated values such as `guild-5-1` or name-based values such as `카마인:뎀쿠`, so no legacy schedule ID resolves.

## Canonical Character Identity

Use a normalized `serverName:characterName` key as the canonical identity for API-backed characters. Schedule slots store this key. A roster refresh matches incoming characters by this key and preserves existing role, gold-eligibility, and schedule references.

For older stored characters that lack a server name, preserve their existing ID until the next successful API refresh can produce the canonical key. The refresh migration updates member data and every schedule reference atomically in the same state change.

## One-Time Recovery

Recover the existing schedule by interpreting each legacy ID as a member prefix plus a one-based roster position:

- `s` -> 스카치
- `j` -> 자쿠
- `a` -> 아쀼님
- `k` -> 김밥
- `m` -> 모카
- `h` -> 헤헤
- `n` -> 범이
- `b` -> 반야

For example, `s2` becomes the canonical key of the second current 스카치 character. Reject the recovery before writing if a prefix is unknown, the requested position is missing, the target key is duplicated, or any non-empty slot remains unresolved.

## Safety And Rollback

1. Keep the timestamped JSON backup under `audit/db-backups/`.
2. Produce a dry-run report listing every old-to-new mapping and all affected slots.
3. Require zero unresolved IDs before the database write.
4. Update only the `schedule` field of `guild-main`; do not replace members or the raid catalog during recovery.
5. Read the row back after the write and verify that every scheduled key resolves to exactly one current character.
6. If verification fails, restore the complete row from the backup.

## Recurrence Prevention

Extract character-key and schedule-migration logic into pure functions. Before implementation, add failing tests proving that:

- a roster refresh with the same server and character names preserves schedule assignments;
- changed generated IDs are migrated to the canonical name key;
- missing or ambiguous matches do not silently discard an assignment;
- the legacy prefix-and-position recovery resolves all current scheduled IDs;
- unrelated weeks, raid metadata, member colors, and availability remain unchanged.

## Validation

Run the focused migration tests, the full test suite, `npm run build`, and `npm run test:sites`. Start the local server and inspect the weekly schedule and member roster in the available browser. After database recovery, inspect the public site and confirm that no assigned slot displays `캐릭터 정보 없음`.

## Deployment Constraint

The public deployment currently contains behavior not present in the connected GitHub repository. Do not publish the older repository over the live site until the deployed source and repository are reconciled. Database recovery can proceed independently because it changes only the shared schedule record.
