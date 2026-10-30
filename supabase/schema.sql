-- =====================================================================
-- MONGLE schema (계좌이체 비회원 주문 + 관리자 입금확인/배송관리)
--
-- 보안 원칙
--   * 손님(anon)은 orders / order_items 테이블에 직접 접근할 수 없습니다.
--     주문 생성은 create_order(), 주문조회는 lookup_order() RPC로만 가능합니다.
--   * 주문 금액은 서버(DB)에서 products 가격으로 다시 계산합니다.
--   * 재고(inventory)는 주문 시 자동 차감되며 부족하면 주문이 거부됩니다.
--     inventory 행이 없는 상품은 재고를 관리하지 않는(무제한) 상품으로 취급합니다.
--     취소되지 않은 주문(입금 대기 포함)은 재고를 계속 잡고 있고, 주문이 취소되면 재고를 되돌립니다.
--   * 재고 변경은 모두 inventory_logs 에 남습니다. (관리자 수정은 사유 필수, 주문 차감/취소 복구는 자동 기록)
--   * 주문 상태: 입금 대기 → 입금 확인 → 배송 준비 → 배송 중 → 배송 완료, 또는 주문 취소
--     입금 대기로 24시간이 지나면 자동 취소됩니다. (pg_cron, 파일 맨 아래 참고)
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 주문 상태와 관리자 처리 기록. 예전 DB에도 붙도록 add column if not exists 로 둡니다.
--   status: awaiting_deposit(입금 대기) / deposit_confirmed(입금 확인) / preparing(배송 준비)
--           / shipping(배송 중) / delivered(배송 완료) / cancelled(주문 취소)
alter table public.orders add column if not exists status text not null default 'awaiting_deposit';
alter table public.orders add column if not exists status_updated_at timestamptz;
alter table public.orders add column if not exists handled_by text;            -- 마지막으로 상태를 바꾼 담당자 이름
alter table public.orders add column if not exists handled_user_id uuid;       -- 감사용: 실제 로그인한 관리자 계정
alter table public.orders add column if not exists admin_memo text;            -- 관리자 메모
alter table public.orders add column if not exists deposit_confirmed_by text;  -- 처음 입금 확인한 담당자 이름
alter table public.orders add column if not exists deposit_confirmed_user_id uuid;
alter table public.orders add column if not exists deposit_confirmed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;   -- 수령 일시: 배송 완료로 바꾼 순간
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancel_reason text;         -- unpaid_timeout(미입금 자동) / admin(관리자)

-- 예전 구조(payment_status + shipping_status)에서 옮기기. 한 번 옮기면 다시 실행되지 않습니다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_status'
  ) then
    update public.orders set
      status = case
        when payment_status <> 'confirmed' then 'awaiting_deposit'
        when shipping_status = 'shipping' then 'shipping'
        when shipping_status = 'delivered' then 'delivered'
        else 'deposit_confirmed'
      end,
      status_updated_at = coalesce(shipping_updated_at, deposit_confirmed_at),
      handled_by = deposit_confirmed_by,
      handled_user_id = deposit_confirmed_user_id,
      delivered_at = case when shipping_status = 'delivered' then coalesce(shipping_updated_at, updated_at) end;

    alter table public.orders drop constraint if exists deposit_fields_consistent;
    alter table public.orders drop constraint if exists no_shipping_before_deposit;
    alter table public.orders
      drop column payment_status,
      drop column shipping_status,
      drop column shipping_updated_at;
  end if;
end $$;

alter table public.orders drop constraint if exists orders_status_valid;
alter table public.orders add constraint orders_status_valid check (
  status in ('awaiting_deposit', 'deposit_confirmed', 'preparing', 'shipping', 'delivered', 'cancelled')
);
alter table public.orders drop constraint if exists orders_deposit_consistent;
alter table public.orders add constraint orders_deposit_consistent check (
  status = 'cancelled'
  or (status = 'awaiting_deposit' and deposit_confirmed_at is null)
  or (status <> 'awaiting_deposit' and deposit_confirmed_at is not null and deposit_confirmed_by is not null)
);
alter table public.orders drop constraint if exists orders_delivered_consistent;
alter table public.orders add constraint orders_delivered_consistent check (
  (status = 'delivered') = (delivered_at is not null)
);
alter table public.orders drop constraint if exists orders_cancel_consistent;
alter table public.orders add constraint orders_cancel_consistent check (
  (status = 'cancelled') = coalesce(cancelled_at is not null and cancel_reason in ('unpaid_timeout', 'admin'), false)
);
alter table public.orders drop constraint if exists orders_admin_text_length;
alter table public.orders add constraint orders_admin_text_length check (
  (handled_by is null or char_length(handled_by) <= 30)
  and (admin_memo is null or char_length(admin_memo) <= 200)
);

-- 예전 DB에 '희망 수령 시간'(delivery_time_start / end) 컬럼이 있다면 지난 주문 기록용으로만 남습니다.
-- 지금은 손님이 시간을 고르지 않고, 배송 완료로 바꾼 순간이 delivered_at 으로 자동 기록됩니다.

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at);

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

-- 재고 변경 이력 (order_id로 주문별 차감/복구를 추적). stock 값이 null 이면 '무제한(재고 관리 안 함)' 상태를 뜻합니다.
create table if not exists public.inventory_logs (
  id bigint generated always as identity primary key,
  product_id text references public.products(id) on delete set null,
  product_name text not null,                 -- 기록 당시 상품명
  kind text not null,  -- adjust(관리자 수정) / order(주문 차감) / cancel(주문 취소 복구)
  previous_stock integer,
  new_stock integer,
  reason text not null check (char_length(reason) between 1 and 200),
  order_id uuid references public.orders(id) on delete set null,
  admin_user_id uuid,
  admin_email text,
  created_at timestamptz not null default now()
);

alter table public.inventory_logs drop constraint if exists inventory_logs_kind_check;
alter table public.inventory_logs add constraint inventory_logs_kind_check check (kind in ('adjust', 'order', 'cancel'));

create index if not exists inventory_logs_created_at_idx on public.inventory_logs (created_at desc);
create index if not exists inventory_logs_product_idx on public.inventory_logs (product_id, created_at desc);
create index if not exists inventory_logs_order_idx on public.inventory_logs (order_id) where order_id is not null;


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
-- 주문 취소 / 재고 복구 (내부용, 직접 호출 불가)
-- ---------------------------------------------------------------------

-- 입금 기한: 주문 후 이 시간 안에 입금 확인되지 않으면 자동 취소
create or replace function public.payment_deadline()
returns interval
language sql
immutable
as $$ select interval '24 hours' $$;

-- 주문들이 차감했던 재고(inventory_logs 의 'order' 기록)를 되돌리고 'cancel' 기록을 남깁니다.
-- 호출하는 쪽에서 주문 행을 먼저 잠그고 상태를 확인해야 합니다. (두 번 복구 방지)
-- 상품 ID 순서로 재고 행을 잠가 create_order 와 교착되지 않게 합니다.
-- 차감 후 '재고 관리 안 함'으로 바뀐 상품은 되돌릴 재고가 없으므로 건너뜁니다.
create or replace function public.restore_order_stock(p_order_ids uuid[], p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_new_stock integer;
begin
  for v_row in
    select l.product_id, l.order_id, o.order_code,
           max(l.product_name) as product_name,
           sum(l.previous_stock - l.new_stock) as quantity
    from public.inventory_logs l
    join public.orders o on o.id = l.order_id
    where l.order_id = any(p_order_ids) and l.kind = 'order' and l.product_id is not null
    group by l.product_id, l.order_id, o.order_code
    order by l.product_id, l.order_id
  loop
    update public.inventory
    set stock = stock + v_row.quantity
    where product_id = v_row.product_id
    returning stock into v_new_stock;

    if found then
      insert into public.inventory_logs (
        product_id, product_name, kind, previous_stock, new_stock, reason, order_id, admin_user_id, admin_email
      ) values (
        v_row.product_id, v_row.product_name, 'cancel', v_new_stock - v_row.quantity, v_new_stock,
        p_reason || ' ' || v_row.order_code, v_row.order_id,
        auth.uid(), (select email from auth.users where id = auth.uid())
      );
    end if;
  end loop;
end;
$$;

-- 입금 기한이 지난 '입금 대기' 주문을 모두 취소하고 재고를 되돌립니다. 취소한 건수를 반환.
-- pg_cron 이 주기적으로 실행하고(파일 맨 아래), 관리자 앱도 주문 목록을 열 때 한 번 실행합니다.
create or replace function public.cancel_expired_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  -- 로그인한 사용자는 관리자만. (pg_cron 은 로그인 없이 실행되므로 auth.uid() 가 null)
  if auth.uid() is not null and not public.is_admin() then
    raise exception '관리자 권한이 없습니다.';
  end if;

  -- 관리자가 지금 처리 중인(잠긴) 주문은 건너뛰고 다음 실행 때 다시 확인
  select coalesce(array_agg(id), '{}') into v_ids
  from (
    select id from public.orders
    where status = 'awaiting_deposit' and created_at < now() - public.payment_deadline()
    for update skip locked
  ) expired;

  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  perform public.restore_order_stock(v_ids, '미입금 자동 취소');

  update public.orders
  set status = 'cancelled',
      status_updated_at = now(),
      cancelled_at = now(),
      cancel_reason = 'unpaid_timeout'
  where id = any(v_ids);

  return cardinality(v_ids);
end;
$$;


-- ---------------------------------------------------------------------
-- 손님용 RPC
-- ---------------------------------------------------------------------

-- p_items: [{"product_id": "p1", "quantity": 2}, ...]
-- 반환: {"order_code": "...", "total_amount": 12345}
-- 예전 버전(희망 수령 시간 인자 포함)은 인자 개수가 달라 별도 함수로 남으므로 지웁니다.
drop function if exists public.create_order(text, text, text, text, text, text, jsonb, time, time);
drop function if exists public.create_order(text, text, text, text, text, text, jsonb);

create or replace function public.create_order(
  p_customer_name text,
  p_phone text,
  p_depositor_name text,
  p_zipcode text,
  p_address1 text,
  p_address2 text,
  p_items jsonb
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
        zipcode, address1, address2
      ) values (
        v_code, v_name, v_phone, v_depositor,
        v_zipcode, v_address1, v_address2
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
    -- (주문 취소 시 이 기록을 보고 재고를 되돌립니다)
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
    'total_amount', o.total_amount,
    'status', o.status,
    'payment_deadline', o.created_at + public.payment_deadline(),
    'delivered_at', o.delivered_at,
    'cancelled_at', o.cancelled_at,
    'cancel_reason', o.cancel_reason,
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

-- 예전 입금확인/배송상태 RPC는 admin_set_order_status 하나로 합쳤습니다.
drop function if exists public.admin_confirm_deposit(uuid, text);
drop function if exists public.admin_cancel_deposit(uuid);
drop function if exists public.admin_set_shipping_status(uuid, text);

-- 주문 상태 변경 (담당자 이름 필수, 메모는 선택)
--   p_status: deposit_confirmed / preparing / shipping / delivered / cancelled
--   * '입금 대기'로는 되돌릴 수 없습니다. (자동 취소 기준이 꼬이지 않도록)
--   * 입금 확인~배송 완료 사이는 자유롭게 바꿀 수 있습니다. (잘못 누른 경우 수정)
--   * 배송 완료로 바꾸는 순간이 수령 일시(delivered_at)로 기록됩니다.
--   * 취소하면 재고를 되돌리며, 취소된 주문은 다시 바꿀 수 없습니다. 배송 완료된 주문은 취소할 수 없습니다.
--   * 상태가 같아도 메모가 바뀌었으면 메모만 저장합니다.
create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status text,
  p_admin_name text,
  p_memo text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_admin_name, ''));
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 없습니다.';
  end if;
  if char_length(v_name) not between 1 and 30 then
    raise exception '담당자 이름을 입력해주세요. (30자 이내)';
  end if;
  if char_length(coalesce(v_memo, '')) > 200 then
    raise exception '메모는 200자 이내로 입력해주세요.';
  end if;
  if p_status is null or p_status not in ('deposit_confirmed', 'preparing', 'shipping', 'delivered', 'cancelled') then
    raise exception '알 수 없는 주문 상태입니다.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;
  if v_order.status = 'cancelled' then
    raise exception '취소된 주문은 변경할 수 없습니다.';
  end if;
  if p_status = v_order.status and v_memo is not distinct from v_order.admin_memo then
    raise exception '변경된 내용이 없습니다.';
  end if;

  if p_status = 'cancelled' then
    if v_order.status = 'delivered' then
      raise exception '배송 완료된 주문은 취소할 수 없습니다.';
    end if;
    perform public.restore_order_stock(array[p_order_id], '관리자 취소');
    update public.orders
    set status = 'cancelled',
        status_updated_at = now(),
        cancelled_at = now(),
        cancel_reason = 'admin',
        handled_by = v_name,
        handled_user_id = auth.uid(),
        admin_memo = v_memo
    where id = p_order_id
    returning * into v_order;
    return v_order;
  end if;

  -- SET 안의 컬럼 참조는 모두 변경 전 값입니다.
  update public.orders
  set status = p_status,
      status_updated_at = case when p_status <> status then now() else status_updated_at end,
      deposit_confirmed_by = coalesce(deposit_confirmed_by, v_name),
      deposit_confirmed_user_id = case when deposit_confirmed_at is null then auth.uid() else deposit_confirmed_user_id end,
      deposit_confirmed_at = coalesce(deposit_confirmed_at, now()),
      delivered_at = case
        when p_status <> 'delivered' then null
        when status = 'delivered' then delivered_at
        else now()
      end,
      handled_by = v_name,
      handled_user_id = auth.uid(),
      admin_memo = v_memo
  where id = p_order_id
  returning * into v_order;

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

revoke all on function public.payment_deadline() from public, anon, authenticated;
revoke all on function public.restore_order_stock(uuid[], text) from public, anon, authenticated;

revoke all on function public.cancel_expired_orders() from public, anon;
grant execute on function public.cancel_expired_orders() to authenticated;

revoke all on function public.create_order(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, text, jsonb) to anon, authenticated;

revoke all on function public.lookup_order(text, text) from public;
grant execute on function public.lookup_order(text, text) to anon, authenticated;

revoke all on function public.admin_set_order_status(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text, text) to authenticated;

revoke all on function public.admin_set_stock(text, integer, text, integer) from public, anon;
grant execute on function public.admin_set_stock(text, integer, text, integer) to authenticated;


-- ---------------------------------------------------------------------
-- 미입금 주문 자동 취소 (pg_cron, 10분마다)
--   Supabase에서는 Dashboard > Database > Extensions 에서 pg_cron 을 켜면 됩니다.
--   (아래 블록이 직접 켜보고, 실패하면 안내 메시지만 남기고 넘어갑니다)
--   pg_cron 이 없어도 관리자 앱에서 주문 목록을 열 때마다 기한 지난 주문이 취소됩니다.
--   등록 확인: select * from cron.job;
-- ---------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule(
    'mongle-cancel-unpaid-orders',
    '*/10 * * * *',
    'select public.cancel_expired_orders()'
  );
exception when others then
  raise notice 'pg_cron 등록 실패: %. Dashboard > Database > Extensions 에서 pg_cron 을 켠 뒤 다시 실행하세요.', sqlerrm;
end $$;


-- ---------------------------------------------------------------------
-- Seed products
-- ---------------------------------------------------------------------
-- 가격은 임시 값입니다. 실제 판매가로 바꿔 실행하세요. (기존 DB의 상품 교체·재고 설정은 update_products.sql)
insert into public.products (id, name, price, category, badge, image, description, sort_order)
values
('jb-black-puppy', '블랙 퍼피 지비츠', 5900, 'JIBBITZ', '', '/products/jb-black-puppy.webp', '귀여운 강아지와 하트, 발바닥 모양의 신발 장식, 크록스 및 샌들용 DIY 신발 액세서리', 1),
('jb-brown-bear', '브라운 베어 지비츠', 5900, 'JIBBITZ', '', '/products/jb-brown-bear.webp', '귀여운 브라운 곰돌이와 리본, 꽃 장식이 어우러진 DIY 신발 액세서리 세트', 2),
('jb-bakery-bear', '베이커리 베어 지비츠', 5900, 'JIBBITZ', '', '/products/jb-bakery-bear.webp', '테디베어와 도넛, 빵 모양의 DIY 신발 장식 세트, 크록스 및 슬리퍼용 액세서리', 3),
('jb-check-bunny', '체크 버니 지비츠', 5900, 'JIBBITZ', '', '/products/jb-check-bunny.webp', '토끼와 체크 패턴, 꽃 모양이 어우러진 DIY 신발 장식 세트, 크록스 및 샌들용 액세서리', 4),
('kr-cloud-whitestar', '다다랜드 몽실구름 복슬 인형 데일리 키링, 화이트스타', 8900, 'KEYRING', '', '/products/kr-cloud-whitestar.webp', '말랑하고 사랑스러운 다다랜드 몽실구름 복슬 인형 데일리 키링, 화이트스타 7cm', 5),
('kr-kkamnyang-cat', '다다랜드 깜냥 고양이 인형 키링', 8900, 'KEYRING', '', '/products/kr-kkamnyang-cat.webp', '귀여운 다다랜드 깜냥 고양이 인형 키링, 9cm, 블랙', 6),
('kr-hip-cat', '다다랜드 힙 고양이 키링', 8900, 'KEYRING', '', '/products/kr-hip-cat.webp', '힙함에 귀여움 더한 다다랜드 힙 고양이 키링, 7.5cm, 헤드셋 고양이', 7),
('bag-mini-eco-navy', '무지 캔버스 미니 에코백', 9900, 'BAG', '', '/products/bag-mini-eco-navy.webp', '깔끔함이 매력적인 무지 캔버스 미니 에코백, 네이비 색, 26×21×10cm', 8)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 재고 설정 예시. 평소에는 관리자 앱 '재고 관리' 화면을 사용하세요.
-- (SQL Editor에서 직접 넣으면 inventory_logs 에 이력이 남지 않습니다)
--
-- insert into public.inventory (product_id, stock) values ('jb-black-puppy', 12), ('jb-brown-bear', 10)
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
