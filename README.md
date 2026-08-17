# 로스트아크 길드 고정공대 일정표

길드 공대원의 원정대 캐릭터, 참여 불가 요일, 레이드 편성 및 개인 일정을 관리하는 웹 일정표입니다.

## 바로가기

- [라이브 일정표](https://loa-raid-board.derod82.chatgpt.site/)
- [Supabase 공용 DB 관리](https://supabase.com/dashboard/project/srdooyseixgxljsdmecc)
- [DB 스크립트 실행 순서](./supabase/README.md)
- [DB 마이그레이션 목록](./supabase/migrations/)
- [DB 테이블 분리 마이그레이션 SQL](./supabase/migrations/202608140001_normalize_board_storage.sql)
- [DB 분리 결과 확인 SQL](./supabase/checks/verify_normalized_storage.sql)
- [GitHub 소스 저장소](https://github.com/hwanginjae82/Loa)

## 저장 방식

- 멤버, 캐릭터, 레이드 목록: Supabase의 개별 행
- 주간 일정과 불참 정보: `week_start` 기준 주차별 행
- 내 멤버 및 내 캐릭터 선택: 각 사용자의 브라우저
- 로스트아크 API 키와 Supabase 환경값: 로컬 환경 파일과 배포 환경에서만 관리

## 주요 기능

- 멤버별 캐릭터 저장 및 등록된 캐릭터의 레벨·전투력 API 갱신
- 멤버별 골드 획득 캐릭터 최대 6개 지정
- 역할, 입장 레벨, 동일 멤버 중복 및 캐릭터당 주간 3회 제한 확인
- 멤버 불참 요일과 레이드 제외 상태 관리
- 멤버/레이드 색상 변경 및 공용 저장
- 개인 캐릭터 기준 주간 일정 확인
