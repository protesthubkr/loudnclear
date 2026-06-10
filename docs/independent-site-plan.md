# 성명뭉 독립 사이트 구현계획

## 목표

`성명뭉`은 단체와 정당의 성명, 논평, 입장문에서 핵심 문장을 추출해 시간순 피드로 보여주는 독립 사이트다. `protesthub`의 `/statements` 수직 기능을 복사해 시작했지만, 공개 브랜드, 배포, 운영, 데이터 소유권은 별도 사이트 기준으로 정리한다.

## 현재 상태

- Next.js 앱은 `loudnclear/` 아래 독립 프로젝트로 분리되어 있다.
- 공개 피드는 `/`에서 제공된다.
- 수집/처리 API는 `/api/ingest/*` 아래에 유지되어 있다.
- 정당 성명 노출은 `status = extracted`이고 `topic_gate_status = matched` 또는 `manual_matched`인 문서만 허용한다.
- 정당 성명 자동 매칭은 confirmed telegram topic 기반으로만 수행한다.
- 현재 DB는 설정에 따라 `protesthub`와 같은 Supabase를 공유할 수 있다.

## 운영 원칙

- 공개 피드는 검증된 핵심 문장만 노출한다.
- 정당 사이트 문서는 confirmed topic에 붙은 경우에만 공개한다.
- 직접 party+telegram 단건 임베딩으로 새 topic을 만들어 공개하지 않는다.
- 수집, 추출, 토픽 매칭은 idempotent하게 반복 실행 가능해야 한다.
- 운영자가 코드 수정 없이 오노출 문서를 숨기거나 수동 매칭할 수 있는 최소 관리면을 둔다.

## 구현 단계

1. 독립 앱 정리
   - 사이트명, 메타데이터, README, env 예시를 `성명뭉` 기준으로 정리한다.
   - 빌드 산출물과 로컬 로그가 repository에 남지 않도록 한다.

2. 공개 사이트 제품화
   - 현재 채팅형 피드 UI를 기준 화면으로 고정한다.
   - 빈 상태, 메타데이터, sitemap, robots를 갖춘다.
   - 모바일/데스크톱에서 문장 줄바꿈과 로고 표시를 검증한다.

3. 운영 자동화
   - Vercel cron 설정을 추가한다.
   - cron은 `CRON_SECRET` Bearer 인증으로만 실행되게 유지한다.
   - 로컬과 배포 환경에서 dry-run 명령을 문서화한다.

4. 최소 운영 화면
   - `/ops`를 Basic Auth로 보호한다.
   - 최근 수집 결과, source 상태, failed/skipped 항목, topic gate 상태를 확인한다.
   - 이후 수동 hidden/matched 액션을 추가할 수 있는 기반을 둔다.

5. 데이터 소유권 분리
   - 단기적으로는 공유 Supabase로 공개 사이트를 안정화한다.
   - 이후 성명뭉 전용 Supabase 프로젝트로 migration, seed, backfill을 분리한다.

6. 배포와 검증
   - Vercel 프로젝트를 별도로 만들고 production env를 설정한다.
   - 배포 후 cron 로그, 공개 피드, RLS/anon 접근, 수집/토픽 매칭을 확인한다.

## 범위 밖

- 완전한 어드민 CMS
- source 추가/삭제 UI
- 장기 backfill 자동화
- OCR 기반 문서 추출
- 일반 보도자료 공개
