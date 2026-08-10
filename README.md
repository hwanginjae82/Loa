# 로스트아크 길드 고정공대 일정표

길드 공대원의 원정대 캐릭터, 참여 불가 요일, 레이드 편성 및 개인 일정을 관리하는 웹 일정표입니다.

## 바로가기

- [Supabase 공용 DB 관리](https://supabase.com/dashboard/project/srdooyseixgxljsdmecc)
- [DB 초기 설정 SQL](./supabase/setup.sql)
- [GitHub 소스 저장소](https://github.com/hwanginjae82/Loa)

> 공대 일정 사이트의 인터넷 배포 주소는 아직 준비 중입니다. 현재는 로컬 개발 주소에서 실행합니다.

## 저장 방식

- 멤버, 레이드 목록, 주간 일정: Supabase 공용 DB
- 내 멤버 및 내 캐릭터 선택: 각 사용자의 브라우저
- 로스트아크 API 키와 Supabase 환경값: `.env.local`에만 저장하며 GitHub에는 올리지 않음

## 주요 기능

- 멤버별 최대 6개 캐릭터 저장 및 수동 API 갱신
- 역할, 입장 레벨, 동일 멤버 중복 및 캐릭터당 주간 3회 제한 확인
- 멤버 불참 요일과 레이드 제외 상태 관리
- 멤버/레이드 색상 변경 및 공용 저장
- 개인 캐릭터 기준 주간 일정 확인
