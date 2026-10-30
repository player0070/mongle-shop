-- =====================================================================
-- 상품 교체: item/ 폴더의 8개 상품 등록 + 재고 설정 (item/items.txt 기준)
--
-- 실행 전 꼭 확인
--   * 가격(price)은 임시 값입니다. 아래 values 의 가격을 실제 판매가로 바꾼 뒤 실행하세요.
--   * 예시 상품(p1~p6)은 지우지 않고 판매 중지(is_active = false)만 합니다. (지난 주문 기록 보존)
--   * 재고를 아래 수량으로 덮어씁니다. 이미 주문이 들어온 뒤 다시 실행하면 차감된 재고가 되돌려지니,
--     그 이후 재고 수정은 관리자 앱 '재고 관리' 화면을 사용하세요.
--   * 재고 변경은 inventory_logs 에 '초기 재고 등록' 으로 기록됩니다.
--   * supabase/schema.sql 을 먼저 실행해야 합니다. (inventory / inventory_logs 테이블 필요)
-- =====================================================================

-- 0) 필요한 테이블이 없으면 아무것도 바꾸지 않고 멈춥니다.
do $$
begin
  if to_regclass('public.inventory') is null or to_regclass('public.inventory_logs') is null then
    raise exception 'inventory / inventory_logs 테이블이 없습니다. supabase/schema.sql 을 먼저 실행한 뒤 이 파일을 다시 실행하세요.';
  end if;
end $$;

begin;

-- 1) 예시 상품 판매 중지
update public.products
set is_active = false
where id in ('p1', 'p2', 'p3', 'p4', 'p5', 'p6');

-- 2) 새 상품 등록 (이미 있으면 내용 갱신)
insert into public.products (id, name, price, category, badge, image, description, sort_order, is_active)
values
('jb-black-puppy',     '블랙 퍼피 지비츠',                                   5900, 'JIBBITZ', '', '/products/jb-black-puppy.webp',     '귀여운 강아지와 하트, 발바닥 모양의 신발 장식, 크록스 및 샌들용 DIY 신발 액세서리', 1, true),
('jb-brown-bear',      '브라운 베어 지비츠',                                 5900, 'JIBBITZ', '', '/products/jb-brown-bear.webp',      '귀여운 브라운 곰돌이와 리본, 꽃 장식이 어우러진 DIY 신발 액세서리 세트', 2, true),
('jb-bakery-bear',     '베이커리 베어 지비츠',                               5900, 'JIBBITZ', '', '/products/jb-bakery-bear.webp',     '테디베어와 도넛, 빵 모양의 DIY 신발 장식 세트, 크록스 및 슬리퍼용 액세서리', 3, true),
('jb-check-bunny',     '체크 버니 지비츠',                                   5900, 'JIBBITZ', '', '/products/jb-check-bunny.webp',     '토끼와 체크 패턴, 꽃 모양이 어우러진 DIY 신발 장식 세트, 크록스 및 샌들용 액세서리', 4, true),
('kr-cloud-whitestar', '다다랜드 몽실구름 복슬 인형 데일리 키링, 화이트스타', 8900, 'KEYRING', '', '/products/kr-cloud-whitestar.webp', '말랑하고 사랑스러운 다다랜드 몽실구름 복슬 인형 데일리 키링, 화이트스타 7cm', 5, true),
('kr-kkamnyang-cat',   '다다랜드 깜냥 고양이 인형 키링',                     8900, 'KEYRING', '', '/products/kr-kkamnyang-cat.webp',   '귀여운 다다랜드 깜냥 고양이 인형 키링, 9cm, 블랙', 6, true),
('kr-hip-cat',         '다다랜드 힙 고양이 키링',                            8900, 'KEYRING', '', '/products/kr-hip-cat.webp',         '힙함에 귀여움 더한 다다랜드 힙 고양이 키링, 7.5cm, 헤드셋 고양이', 7, true),
('bag-mini-eco-navy',  '무지 캔버스 미니 에코백',                            9900, 'BAG',     '', '/products/bag-mini-eco-navy.webp',  '깔끔함이 매력적인 무지 캔버스 미니 에코백, 네이비 색, 26×21×10cm', 8, true)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  badge = excluded.badge,
  image = excluded.image,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- 3) 재고 설정 + 이력 기록 (item/items.txt 수량)
--    prev 는 변경 전 재고를 읽고, upserted 가 재고를 바꾼 뒤, 바뀐 상품만 이력을 남깁니다.
with stock(product_id, stock) as (
  values
  ('jb-black-puppy', 12),
  ('jb-brown-bear', 10),
  ('jb-bakery-bear', 12),
  ('jb-check-bunny', 16),
  ('kr-cloud-whitestar', 2),
  ('kr-kkamnyang-cat', 2),
  ('kr-hip-cat', 1),
  ('bag-mini-eco-navy', 2)
),
prev as (
  select s.product_id, s.stock, i.stock as previous_stock
  from stock s
  left join public.inventory i on i.product_id = s.product_id
),
upserted as (
  insert into public.inventory (product_id, stock)
  select product_id, stock from stock
  on conflict (product_id) do update set stock = excluded.stock
  returning product_id
)
insert into public.inventory_logs (product_id, product_name, kind, previous_stock, new_stock, reason)
select p.product_id, pr.name, 'adjust', p.previous_stock, p.stock, '초기 재고 등록'
from prev p
join public.products pr on pr.id = p.product_id
where p.previous_stock is distinct from p.stock;

commit;

-- 확인용
-- select p.id, p.name, p.price, p.category, i.stock
-- from public.products p left join public.inventory i on i.product_id = p.id
-- where p.is_active order by p.sort_order;
