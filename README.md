# MONGLE mobile shop

모바일 우선의 초간단 액세서리 쇼핑몰 스타터입니다.

## 포함 기능
- 좌측 검색 / 중앙 MONGLE 로고 / 우측 메뉴 헤더
- 4장 자동 + 손가락 스와이프 배너
- 카테고리 필터, 2열 상품 그리드, 상품 상세
- 수량 선택 및 바로구매
- 비회원 주문: 주문자 이름 · 휴대폰 번호 · 입금자명 · 배송지(카카오 우편번호 검색)만 입력
- 계좌이체 결제: 주문 완료/주문조회 화면에 입금 계좌 안내
- 주문번호 + 휴대폰 번호 기반 비회원 주문조회 (입금 대기 → 입금 확인 → 배송 준비 → 배송 중 → 배송 완료, 또는 주문 취소)
- 주문 후 24시간 안에 입금 확인되지 않으면 자동 취소 (재고 복구)
- 주문/입금/배송 관리는 별도 관리자 앱 `~/mongle-admin` 에서 처리

## 실행
```bash
npm install
cp .env.example .env   # Supabase 키와 입금 계좌 입력
npm run dev
```

## Supabase
1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행 (예전 스타터 스키마를 실행했다면 파일 상단 안내 참고)
3. Dashboard > Database > Extensions 에서 `pg_cron` 켜기 (미입금 주문 자동 취소용. 켠 뒤 `schema.sql` 을 한 번 더 실행)
4. `.env` 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BANK_*` 입력
5. `npm run dev` 재실행

Supabase가 연결되지 않으면 상품 화면은 `src/data/mockData.js` 로 보이지만 주문은 접수되지 않습니다.

### 보안 구조
- 손님은 `orders`, `order_items` 테이블을 직접 읽거나 쓸 수 없습니다.
- 주문 생성은 `create_order` RPC: 상품 가격을 DB에서 다시 조회해 총액을 계산하고, 주문번호(`MG261006-K7Q2ZP` 형식)를 서버에서 무작위로 만듭니다.
- 주문조회는 `lookup_order` RPC: 주문번호와 휴대폰 번호가 모두 맞을 때만 필요한 필드를 반환합니다.
- 재고는 `inventory` 테이블에서 관리합니다. 주문 시 자동 차감되고 부족하면 주문이 거부됩니다. 취소되지 않은 주문(입금 대기 포함)은 재고를 잡고 있고, 주문이 취소되면 되돌립니다. 행이 없는 상품은 무제한(재고 관리 안 함)입니다. 품절 상품은 쇼핑몰에 SOLD OUT으로 표시됩니다.
- 관리자는 Supabase Auth 로그인 + `admins` 테이블 등록이 필요하며, 주문 상태 변경은 `admin_set_order_status` RPC로만 가능합니다.
- 미입금 자동 취소는 `cancel_expired_orders()` 를 pg_cron 이 10분마다 실행합니다. 관리자 앱 주문 목록을 열 때도 한 번 실행됩니다.

## 실제 운영 전에 꼭 바꿀 부분
- `public/products/*.svg`: 실제 상품 사진 또는 Supabase Storage URL로 교체
- `public/banners/*.svg`: 실제 프로모션 이미지로 교체
- Footer의 사업자 정보, 이용약관/개인정보처리방침 링크
- Supabase Dashboard > Authentication 에서 공개 회원가입(Allow new users to sign up) 끄기 권장

## 디자인 방향
화이트 배경, 블랙 타이포/보더 중심. 작은 텍스트, 넓은 여백, 사진 중심 그리드를 사용했습니다. 모바일 520px 이하를 주요 화면으로 설계했으며 데스크톱에서는 중앙에 모바일 숍이 고정됩니다.
