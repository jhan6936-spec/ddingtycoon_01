# 거래소 · 관리자 조치 · 이모지 · 반응형 (구현 반영)

구현 시 참고용 명세. DB 스키마는 `supabase_trade_restrictions.sql`, 프로필/관리자는 `supabase_profiles.sql`과 함께 사용합니다.

## 관리자

- `profiles.role = admin`: 타인 글 수정/삭제, 제재 적용/해제 (`trade_user_restrictions` / `trade_guest_restrictions`).

## 제재

- 시간 제한: `suspended_until` 미래 시각.
- 수동: `indefinite = true`.
- 해제: 행 삭제 또는 비활성(삭제 사용).

## 클라이언트

- `trade_me_restriction_status` RPC로 본인 상태 조회 → 게시·댓글·반응 차단 UI.

## 이모지 피커

- 작성·답글·반응에서 공통 팝오버.

## 반응형

- 작성/답글 입력 영역 `clamp` 및 좁은 화면 패딩 조정.
