# 불개미 Personal Board

https://dashboard.antinfo.io — 정적 페이지(GitHub Pages).

- 로그인: fireant-hub Supabase 구글 로그인. 허용 = `@bridge34.com` 전원 + josoyjjk@gmail.com. '가족'은 오너 2계정만.
- 보안은 DB RLS(`sql/001_personal_tasks.sql`)가 담당. 이 저장소에는 비밀값·개인 데이터 없음(공개 publishable 키만).
- 데이터: 개인 할 일 = fireant-hub `personal_tasks`, 협업·딜·일정 = Bridge34 오피스보드(읽기 전용), 시황·후원 = antinfo.io 공개 JSON.
- 테스트: `?mock=1` (가짜 할 일, DB 쓰기 없음).
