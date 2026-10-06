-- =====================================================================
-- MONGLE schema (계좌이체 비회원 주문 + 관리자 입금확인/배송관리)
--
-- 보안 원칙
--   * 손님(anon)은 orders / order_items 테이블에 직접 접근할 수 없습니다.
--     주문 생성은 create_order(), 주문조회는 lookup_order() RPC로만 가능합니다.
--   * 주문 금액은 서버(DB)에서 products 가격으로 다시 계산합니다.
--   * 재고(inventory)는 주문 시 자동 차감되며 부족하면 주문이 거부됩니다.
--     inventory 행이 없는 상품은 재고를 관리하지 않는(무제한) 상품으로 취급합니다.
--   * 재고 변경은 모두 inventory_logs 에 남습니다. (관리자 수정은 사유 필수, 주문 차감은 자동 기록)
--   * 관리자는 Supabase Auth로 로그인하고 public.admins 에 등록된 계정만
--     주문을 조회/수정할 수 있습니다. 수정은 admin_* RPC로만 가능합니다.
--
-- 이 파일은 SQL Editor에서 여러 번 실행해도 안전하도록 작성했습니다.
-- 단, 예전 스타터 schema.sql 을 이미 실행했다면 orders 컬럼 구조가 다르므로
-- 아래 주석을 풀어 기존 주문 테이블을 지운 뒤 실행하세요. (주문 데이터 삭제됨)
--
--   drop table if exists public.order_items, public.orders cascade;
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id text primary key,
  name text not null,
  price integer not null check (price >= 0),
  category text not null,
  badge text default '',
  image text not null,
  description text default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  customer_name text not null check (char_length(customer_name) between 1 and 30),
  phone text not null check (phone ~ '^01[0-9]{8,9}$'),
  depositor_name text not null check (char_length(depositor_name) between 1 and 30),
  zipcode text,
  address1 text not null check (char_length(address1) between 1 and 200),
  address2 text check (address2 is null or char_length(address2) <= 200),
  total_amount integer not null default 0 check (total_amount >= 0),

  -- 입금 확인
  payment_status text not null default 'awaiting_deposit'
    check (payment_status in ('awaiting_deposit', 'confirmed')),
  deposit_confirmed_by text,             -- 확인한 관리자가 직접 입력한 이름
  deposit_confirmed_user_id uuid,        -- 감사용: 실제 로그인한 관리자 계정
  deposit_confirmed_at timestamptz,

  -- 배송 상황
  shipping_status text not null default 'preparing'
    check (shipping_status in ('preparing', 'shipping', 'delivered')),
  shipping_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deposit_fields_consistent check (
    (payment_status = 'awaiting_deposit'
      and deposit_confirmed_by is null and deposit_confirmed_at is null)
    or
    (payment_status = 'confirmed'
      and deposit_confirmed_by is not null and deposit_confirmed_at is not null)
  ),
  constraint no_shipping_before_deposit check (
    payment_status = 'confirmed' or shipping_status = 'preparing'
  )
);

-- 희망 수령 시간 (예: 13:00 ~ 15:00). 이 컬럼이 생기기 전 주문은 null입니다.
alter table public.orders add column if not exists delivery_time_start time;
alter table public.orders add column if not exists delivery_time_end time;
alter table public.orders drop constraint if exists delivery_time_range;
alter table public.orders add constraint delivery_time_range check (
  (delivery_time_start is null and delivery_time_end is null)
  or (delivery_time_start is not null and delivery_time_end is not null and delivery_time_start < delivery_time_end)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (payment_status, shipping_status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- 관리자 계정 목록 (Supabase Auth 사용자 중 여기에 등록된 사람만 관리자)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 상품별 재고. 행이 없으면 재고 관리 안 함(무제한), 행이 있으면 stock 만큼만 주문 가능.
create table if not exists public.inventory (
  product_id text primary key references public.products(id) on delete cascade,
  stock integer not null default 0 check (stock >= 0),
  updated_at timestamptz not null default now()
);

-- 재고 변경 이력. stock 값이 null 이면 '무제한(재고 관리 안 함)' 상태를 뜻합니다.
create table if not exists public.inventory_logs (
  id bigint generated always as identity primary key,
  product_id text references public.products(id) on delete set null,
  product_name text not null,                 -- 기록 당시 상품명
  kind text not null check (kind in ('adjust', 'order')),
  previous_stock integer,
  new_stock integer,
  reason text not null check (char_length(reason) between 1 and 200),
  order_id uuid references public.orders(id) on delete set null,
  admin_user_id uuid,
  admin_email text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_logs_created_at_idx on public.inventory_logs (created_at desc);
create index if not exists inventory_logs_product_idx on public.inventory_logs (product_id, created_at desc);


-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists inventory_touch_updated_at on public.inventory;
create trigger inventory_touch_updated_at
before update on public.inventory
for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 주문번호: MG + 한국시간 YYMMDD + '-' + 혼동 문자를 뺀 32진 6자리 (예: MG261006-K7Q2ZP)
create or replace function public.generate_order_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := 'MG' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
  end loop;
  return code;
end;
$$;


-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admins enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_logs enable row level security;

-- 예전 스타터 정책 제거 (전체 주문 공개 / 무제한 insert)
drop policy if exists "guest can read orders demo" on public.orders;
drop policy if exists "guest can create order" on public.orders;
drop policy if exists "guest can create order items" on public.order_items;

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products"
on public.products for select
using (is_active = true);

drop policy if exists "admins can read all products" on public.products;
create policy "admins can read all products"
on public.products for select
to authenticated
using (public.is_admin());

-- 품절 표시를 위해 재고 수량은 누구나 조회 가능 (수정은 admin_set_stock RPC로만)
drop policy if exists "public can read inventory" on public.inventory;
create policy "public can read inventory"
on public.inventory for select
using (true);

drop policy if exists "admins can read inventory logs" on public.inventory_logs;
create policy "admins can read inventory logs"
on public.inventory_logs for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read orders" on public.orders;
create policy "admins can read orders"
on public.orders for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read order items" on public.order_items;
create policy "admins can read order items"
on public.order_items for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read own admin row" on public.admins;
create policy "admins can read own admin row"
on public.admins for select
to authenticated
using (user_id = auth.uid());

-- insert / update / delete 정책은 일부러 만들지 않습니다.
-- 모든 쓰기는 아래 security definer 함수가 검증 후 수행합니다.


-- ---------------------------------------------------------------------
-- 손님용 RPC
-- ---------------------------------------------------------------------

-- p_items: [{"product_id": "p1", "quantity": 2}, ...]
-- p_delivery_start / p_delivery_end: 희망 수령 시간 ('13:00', '15:00')
-- 반환: {"order_code": "...", "total_amount": 12345}
-- 예전 버전(희망 수령 시간 없음)은 인자 개수가 달라 별도 함수로 남으므로 지웁니다.
drop function if exists public.create_order(text, text, text, text, text, text, jsonb);

create or replace function public.create_order(
  p_customer_name text,
  p_phone text,
  p_depositor_name text,
  p_zipcode text,
  p_address1 text,
  p_address2 text,
  p_items jsonb,
  p_delivery_start time,
  p_delivery_end time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_depositor text := btrim(coalesce(p_depositor_name, ''));
  v_zipcode text := nullif(btrim(coalesce(p_zipcode, '')), '');
  v_address1 text := btrim(coalesce(p_address1, ''));
  v_address2 text := nullif(btrim(coalesce(p_address2, '')), '');
  v_order_id uuid;
  v_code text;
  v_total integer := 0;
  v_item record;
  v_product public.products%rowtype;
  v_new_stock integer;
begin
  if char_length(v_name) not between 1 and 30 then
    raise exception '주문자 이름을 확인해주세요.';
  end if;
  if v_phone !~ '^01[0-9]{8,9}$' then
    raise exception '휴대폰 번호를 확인해주세요.';
  end if;
  if char_length(v_depositor) not between 1 and 30 then
    raise exception '입금자명을 확인해주세요.';
  end if;
  if char_length(v_address1) not between 1 and 200
     or char_length(coalesce(v_address2, '')) > 200 then
    raise exception '배송지 주소를 확인해주세요.';
  end if;
  if p_delivery_start is null or p_delivery_end is null or p_delivery_start >= p_delivery_end then
    raise exception '받으실 시간을 확인해주세요.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception '주문 상품을 확인해주세요.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e->'product_id') <> 'string'
       or jsonb_typeof(e->'quantity') <> 'number'
       or (e->>'quantity') !~ '^[0-9]{1,2}$'
  ) then
    raise exception '주문 상품을 확인해주세요.';
  end if;

  -- 주문번호 중복 시 재시도
  loop
    v_code := public.generate_order_code();
    begin
      insert into public.orders (
        order_code, customer_name, phone, depositor_name,
        zipcode, address1, address2,
        delivery_time_start, delivery_time_end
      ) values (
        v_code, v_name, v_phone, v_depositor,
        v_zipcode, v_address1, v_address2,
        p_delivery_start, p_delivery_end
      )
      returning id into v_order_id;
      exit;
    exception when unique_violation then
      -- 다른 코드로 다시 시도
    end;
  end loop;

  -- 같은 상품이 여러 번 들어오면 합쳐서 처리 (상품 ID 순서로 잠가 교착 방지)
  for v_item in
    select e->>'product_id' as product_id, sum((e->>'quantity')::int) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_item.quantity not between 1 and 99 then
      raise exception '상품 수량은 1~99개까지 주문할 수 있습니다.';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id and is_active = true;

    if not found then
      raise exception '판매 중이 아닌 상품이 포함되어 있습니다.';
    end if;

    -- 재고 차감: 행 잠금 후 조건부 감소라 동시 주문에도 초과 판매되지 않음
    update public.inventory
    set stock = stock - v_item.quantity
    where product_id = v_product.id and stock >= v_item.quantity
    returning stock into v_new_stock;

    if found then
      insert into public.inventory_logs (product_id, product_name, kind, previous_stock, new_stock, reason, order_id)
      values (v_product.id, v_product.name, 'order', v_new_stock + v_item.quantity, v_new_stock, '주문 ' || v_code, v_order_id);
    elsif exists (select 1 from public.inventory where product_id = v_product.id) then
      raise exception '% 상품의 재고가 부족합니다.', v_product.name;
    end if;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_item.quantity);

    v_total := v_total + v_product.price * v_item.quantity;
  end loop;

  update public.orders set total_amount = v_total where id = v_order_id;

  return jsonb_build_object('order_code', v_code, 'total_amount', v_total);
end;
$$;

-- 주문번호 + 휴대폰 번호가 모두 맞을 때만 필요한 필드를 반환. 없으면 null.
create or replace function public.lookup_order(p_order_code text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_code', o.order_code,
    'created_at', o.created_at,
    'customer_name', o.customer_name,
    'depositor_name', o.depositor_name,
    'zipcode', o.zipcode,
    'address1', o.address1,
    'address2', o.address2,
    'delivery_time_start', to_char(o.delivery_time_start, 'HH24:MI'),
    'delivery_time_end', to_char(o.delivery_time_end, 'HH24:MI'),
    'total_amount', o.total_amount,
    'payment_status', o.payment_status,
    'shipping_status', o.shipping_status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'unit_price', i.unit_price,
        'quantity', i.quantity
      ) order by i.created_at)
      from public.order_items i
      where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_code = upper(btrim(coalesce(p_order_code, '')))
    and o.phone = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
$$;


-- ---------------------------------------------------------------------
-- 관리자용 RPC
-- ---------------------------------------------------------------------

-- 입금 확인: 확인한 관리자 이름을 기록
create or replace function public.admin_confirm_deposit(p_order_id uuid, p_admin_name text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_admin_name, ''));
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 없습니다.';
  end if;
  if char_length(v_name) not between 1 and 30 then
    raise exception '입금을 확인한 관리자 이름을 입력해주세요.';
  end if;

  update public.orders
  set payment_status = 'confirmed',
      deposit_confirmed_by = v_name,
      deposit_confirmed_user_id = auth.uid(),
      deposit_confirmed_at = now()
  where id = p_order_id and payment_status = 'awaiting_deposit'
  returning * into v_order;

  if not found then
    raise exception '입금 대기 상태의 주문이 아니거나 주문을 찾을 수 없습니다.';
  end if;
  return v_order;
end;
$$;

-- 입금 확인 취소 (잘못 눌렀을 때). 배송 준비 상태에서만 가능.
create or replace function public.admin_cancel_deposit(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 없습니다.';
  end if;

  update public.orders
  set payment_status = 'awaiting_deposit',
      deposit_confirmed_by = null,
      deposit_confirmed_user_id = null,
      deposit_confirmed_at = null
  where id = p_order_id
    and payment_status = 'confirmed'
    and shipping_status = 'preparing'
  returning * into v_order;

  if not found then
    raise exception '배송 준비 상태의 입금 확인 주문만 취소할 수 있습니다.';
  end if;
  return v_order;
end;
$$;

-- 배송 상황 변경: preparing(배송 준비) / shipping(배송 중) / delivered(배송 완료)
create or replace function public.admin_set_shipping_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 없습니다.';
  end if;
  if p_status not in ('preparing', 'shipping', 'delivered') then
    raise exception '알 수 없는 배송 상태입니다.';
  end if;

  update public.orders
  set shipping_status = p_status,
      shipping_updated_at = now()
  where id = p_order_id and payment_status = 'confirmed'
  returning * into v_order;

  if not found then
    raise exception '입금 확인된 주문만 배송 상태를 바꿀 수 있습니다.';
  end if;
  return v_order;
end;
$$;

-- 재고 수정 (사유 필수, 이력 기록)
--   p_stock          : 새 재고. null 이면 재고 관리를 끕니다(무제한).
--   p_expected_stock : 관리자 화면에서 보고 있던 재고(무제한이면 null).
--                      그 사이 주문 등으로 재고가 바뀌었으면 덮어쓰지 않고 거부합니다.
drop function if exists public.admin_set_stock(text, integer);

create or replace function public.admin_set_stock(
  p_product_id text,
  p_stock integer,
  p_reason text,
  p_expected_stock integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_product_name text;
  v_prev integer;
  v_log public.inventory_logs;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 없습니다.';
  end if;
  if char_length(v_reason) not between 1 and 200 then
    raise exception '수정 사유를 입력해주세요. (200자 이내)';
  end if;
  if p_stock is not null and (p_stock < 0 or p_stock > 1000000) then
    raise exception '재고는 0 ~ 1,000,000 사이로 입력해주세요.';
  end if;

  -- 같은 상품을 동시에 수정하지 못하도록 상품 행을 잠금
  select name into v_product_name from public.products where id = p_product_id for update;
  if not found then
    raise exception '상품을 찾을 수 없습니다.';
  end if;

  select stock into v_prev from public.inventory where product_id = p_product_id for update;
  if not found then
    v_prev := null;
  end if;

  if v_prev is distinct from p_expected_stock then
    raise exception '그 사이 재고가 바뀌었습니다. (현재 %) 새로고침 후 다시 시도해주세요.',
      coalesce(v_prev::text || '개', '무제한');
  end if;
  if v_prev is not distinct from p_stock then
    raise exception '변경된 재고가 없습니다.';
  end if;

  if p_stock is null then
    delete from public.inventory where product_id = p_product_id;
  else
    insert into public.inventory (product_id, stock)
    values (p_product_id, p_stock)
    on conflict (product_id) do update set stock = excluded.stock;
  end if;

  insert into public.inventory_logs (
    product_id, product_name, kind, previous_stock, new_stock, reason, admin_user_id, admin_email
  ) values (
    p_product_id, v_product_name, 'adjust', v_prev, p_stock, v_reason,
    auth.uid(), (select email from auth.users where id = auth.uid())
  )
  returning * into v_log;

  return jsonb_build_object('product_id', p_product_id, 'stock', p_stock, 'log', to_jsonb(v_log));
end;
$$;


-- ---------------------------------------------------------------------
-- 함수 실행 권한 (Supabase는 기본적으로 anon에게도 실행 권한을 주므로 명시적으로 정리)
-- ---------------------------------------------------------------------
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.generate_order_code() from public, anon, authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

revoke all on function public.create_order(text, text, text, text, text, text, jsonb, time, time) from public;
grant execute on function public.create_order(text, text, text, text, text, text, jsonb, time, time) to anon, authenticated;

revoke all on function public.lookup_order(text, text) from public;
grant execute on function public.lookup_order(text, text) to anon, authenticated;

revoke all on function public.admin_confirm_deposit(uuid, text) from public, anon;
grant execute on function public.admin_confirm_deposit(uuid, text) to authenticated;

revoke all on function public.admin_cancel_deposit(uuid) from public, anon;
grant execute on function public.admin_cancel_deposit(uuid) to authenticated;

revoke all on function public.admin_set_shipping_status(uuid, text) from public, anon;
grant execute on function public.admin_set_shipping_status(uuid, text) to authenticated;

revoke all on function public.admin_set_stock(text, integer, text, integer) from public, anon;
grant execute on function public.admin_set_stock(text, integer, text, integer) to authenticated;


-- ---------------------------------------------------------------------
-- Seed products
-- ---------------------------------------------------------------------
insert into public.products (id, name, price, category, badge, image, description, sort_order)
values
('p1', 'Cloud Jibbitz', 5900, 'JIBBITZ', 'BEST', '/products/product-1.svg', '몽글몽글한 구름 모양의 미니 지비츠. 단독으로도, 다른 참과 함께도 잘 어울려요.', 1),
('p2', 'Tiny Heart Ring', 12900, 'RING', 'NEW', '/products/product-2.svg', '작은 하트 포인트가 들어간 데일리 링. 가볍고 미니멀한 스타일입니다.', 2),
('p3', 'Black Dot Jibbitz', 4900, 'JIBBITZ', '', '/products/product-3.svg', '화이트 슈즈에 잘 어울리는 블랙 도트 참. MONGLE의 모노톤 무드를 담았어요.', 3),
('p4', 'Wave Ring', 14900, 'RING', 'BEST', '/products/product-4.svg', '부드럽게 흐르는 곡선을 살린 얇은 웨이브 링.', 4),
('p5', 'Mini Star Charm', 6900, 'CHARM', '', '/products/product-5.svg', '가볍게 달기 좋은 별 모양 미니 참.', 5),
('p6', 'Soft Pearl Ring', 15900, 'RING', 'NEW', '/products/product-6.svg', '작은 진주 포인트가 들어간 정돈된 무드의 링.', 6)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 재고 설정 예시. 평소에는 관리자 앱 '재고 관리' 화면을 사용하세요.
-- (SQL Editor에서 직접 넣으면 inventory_logs 에 이력이 남지 않습니다)
--
-- insert into public.inventory (product_id, stock) values ('p1', 30), ('p2', 10)
-- on conflict (product_id) do update set stock = excluded.stock;
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 관리자 등록 방법
--   1) Supabase Dashboard > Authentication > Users > Add user 로 이메일/비밀번호 계정 생성
--   2) 아래 쿼리의 이메일을 바꿔 실행
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'admin@example.com'
-- on conflict do nothing;
-- ---------------------------------------------------------------------
