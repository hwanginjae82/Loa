# Supabase DB scripts

## 폴더 구조

```text
supabase/
├─ migrations/  실행 순서가 있는 DB 변경 스크립트
└─ checks/      데이터를 변경하지 않는 확인용 쿼리
```

## 마이그레이션 순서

| 파일 | 역할 | 현재 기존 DB 상태 |
|---|---|---|
| `202608100001_initial_raid_board_state.sql` | 기존 `raid_board_state` 생성과 Realtime 설정 | 적용됨 |
| `202608100002_add_legacy_change_history.sql` | 기존 JSON 전체 백업 트리거 | 적용됨 |
| `202608100003_prevent_legacy_seed_overwrite.sql` | 예전 초기 일정 재저장 차단 | 적용됨 |
| `202608140001_normalize_board_storage.sql` | 멤버·캐릭터·레이드·주차 테이블 분리와 데이터 복사 | 적용 대기 |

새 DB를 처음 구성할 때는 파일명 순서대로 실행한다. 현재 Dev와 Production DB에는 앞의 세 파일이 이미 적용되어 있으므로 `202608140001_normalize_board_storage.sql`만 실행한다.

## 확인 쿼리

마이그레이션 직후 `checks/verify_normalized_storage.sql`을 실행한다. 결과의 `all_counts_match`가 `true`인지 확인한 뒤 앱 저장 테스트를 진행한다.

## 안전 규칙

- 마이그레이션은 기존 `raid_board_state`와 `raid_board_state_history`를 삭제하지 않는다.
- 새 테이블에 데이터가 이미 있으면 기존 JSON을 다시 복사해 덮어쓰지 않는다.
- Production 적용 전 Dev에서 같은 마이그레이션과 확인 쿼리를 먼저 실행한다.
- `checks` 폴더의 쿼리는 읽기 전용으로 유지한다.
