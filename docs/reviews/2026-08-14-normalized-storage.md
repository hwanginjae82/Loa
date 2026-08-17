# 2026-08-14 공용 DB 테이블 분리

## 목적

기존 `raid_board_state` 한 행의 `members`, `catalog`, `schedule` 전체 JSON을 수정할 때마다 통째로 읽고 저장하던 구조를 분리한다. 주차가 늘어나도 한 JSON이 계속 커지지 않게 하고, 서로 다른 멤버나 주차의 동시 편집이 덮어쓰이지 않게 한다.

## 새 구조

- `raid_members`: 멤버 별명, 색상, 활성 상태, 표시 순서
- `raid_characters`: 멤버별 캐릭터, 직업, 역할, 레벨, 전투력, 골드 여부
- `raid_catalog`: 레이드명, 난이도, 인원, 입장 레벨, 골드, 색상
- `raid_board_weeks`: 수요일 `week_start`를 기본키로 사용하는 주차별 편성 및 불참 정보
- `raid_data_history`: 위 네 테이블의 수정·삭제 전 행 자동 백업

기존 `raid_board_state`와 `raid_board_state_history`는 마이그레이션 후에도 삭제하거나 수정하지 않는다. 문제가 생기면 기존 JSON 데이터를 복구 기준으로 사용할 수 있다.

## 저장 방식

- 브라우저는 편집을 시작한 시점과 현재 상태를 비교한다.
- 실제로 바뀐 멤버·캐릭터·레이드·주차 행만 RPC에 전달한다.
- `save_raid_board_changes` 함수가 한 트랜잭션에서 변경을 적용한다.
- 저장 직후 DB를 다시 읽어 다른 사용자의 변경과 합쳐진 최종 상태를 화면에 반영한다.
- 일반 브라우저에는 테이블 조회 권한만 주고, 쓰기는 저장 RPC를 통해서만 허용한다.

## 적용 순서

1. 기존 `raid_board_state`의 `guild-main` 행과 최신 백업 존재 여부를 확인한다.
2. Dev DB SQL Editor에서 `supabase/migrations/202608140001_normalize_board_storage.sql`을 실행한다.
3. `supabase/checks/verify_normalized_storage.sql`을 실행해 `all_counts_match = true`인지 확인한다.
4. 로컬 앱으로 조회·저장·새로고침·캐릭터 갱신·다음 주 복사를 확인한다.
5. Production DB에서 사용자가 일정을 편집하지 않는 시간에 같은 SQL을 실행한다.
6. 복사된 행 수를 다시 비교한 직후 새 앱을 배포한다.
7. 라이브에서 저장 후 새로고침과 다른 브라우저 실시간 반영을 확인한다.

마이그레이션 SQL은 대상 테이블이 비어 있을 때만 기존 JSON을 복사한다. 이미 새 테이블에 데이터가 있으면 재실행해도 기존 JSON으로 덮어쓰지 않는다.

## 자동 검증 범위

- 앱 객체와 DB 행의 왕복 변환
- 변경된 행만 저장 요청에 포함되는지
- 제거된 캐릭터만 삭제 요청에 포함되는지
- 서로 다른 멤버의 동시 변경을 저장 요청에 포함하지 않는지
- 기존 초기 일정과 `raid_board_state` 쓰기 코드가 런타임에 남지 않는지
- 전체 Node 테스트와 Vite 프로덕션 빌드

## 아직 하지 않은 작업

- Dev 및 Production Supabase에 SQL 실행
- 실제 DB 행 수 비교
- 라이브 배포
