import { ArrowLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DELIVERY_HOURS, DELIVERY_NOTICE, LAST_ORDER_KEY, MAX_QUANTITY } from '../config/shop'
import { formatPhone, isValidPhone, onlyDigits, won } from '../lib/format'
import { searchAddress } from '../lib/postcode'
import { clearCart, useCart } from '../lib/cart'
import { isSoldOut, maxOrderQuantity, useProducts } from '../lib/products'
import { supabase } from '../lib/supabase'


const blank = { name: '', phone: '', depositor: '', zipcode: '', address1: '', address2: '', timeStart: '', timeEnd: '' }

const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`
const DELIVERY_TIMES = Array.from({ length: DELIVERY_HOURS.end - DELIVERY_HOURS.start + 1 }, (_, i) => hourLabel(DELIVERY_HOURS.start + i))

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = '주문자 이름을 입력해주세요.'
  if (!isValidPhone(form.phone)) errors.phone = '휴대폰 번호를 정확히 입력해주세요.'
  if (!form.depositor.trim()) errors.depositor = '입금하실 분의 이름을 입력해주세요.'
  if (!form.address1.trim()) errors.address1 = '배송받을 주소를 입력해주세요.'
  if (!form.timeStart || !form.timeEnd) errors.time = '받으실 시간을 선택해주세요.'
  else if (form.timeStart >= form.timeEnd) errors.time = '끝 시간은 시작 시간보다 늦어야 합니다.'
  return errors
}

function Field({ id, label, required, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold">
        {label}{required && <span className="ml-0.5 text-black/40">*</span>}
      </label>
      {children}
      {error ? <span className="mt-1.5 block text-[11px] text-[#c4302b]">{error}</span>
        : hint ? <span className="mt-1.5 block text-[11px] text-black/45">{hint}</span> : null}
    </div>
  )
}

export default function Checkout() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { products, loading: productLoading } = useProducts()
  const cart = useCart()
  // ?from=cart 이면 장바구니 전체, 아니면 상세페이지의 '바로 구매하기' 한 상품
  const fromCart = params.get('from') === 'cart'
  const items = fromCart
    ? cart
      .map((i) => ({ product: products.find((p) => p.id === i.id), quantity: i.quantity }))
      .filter((i) => i.product && !isSoldOut(i.product))
    : [{
      product: products.find((p) => p.id === params.get('product')),
      quantity: Math.min(MAX_QUANTITY, Math.max(1, parseInt(params.get('qty'), 10) || 1)),
    }].filter((i) => i.product)

  const [form, setForm] = useState(blank)
  const [touched, setTouched] = useState(false)
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const address2Ref = useRef(null)

  const errors = touched ? validate(form) : {}
  const total = items.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0)
  const stockProblem = items.reduce((msg, { product, quantity }) => msg
    || (isSoldOut(product) ? `${product.name}: 품절된 상품입니다.`
      : quantity > maxOrderQuantity(product) ? `${product.name}: 재고가 부족합니다. (남은 수량 ${product.stock}개)` : ''), '')
  const fieldClass = (key) => `h-12 w-full border px-3 text-[14px] outline-none transition focus:border-black ${errors[key] ? 'border-[#c4302b]' : 'border-black/15'}`

  const update = (key, transform = (v) => v) => (e) => setForm((prev) => ({ ...prev, [key]: transform(e.target.value) }))

  const openAddressSearch = async () => {
    try {
      const result = await searchAddress()
      if (!result) return
      setForm((prev) => ({ ...prev, zipcode: result.zipcode, address1: result.address }))
      address2Ref.current?.focus()
    } catch (err) {
      setSubmitError(`${err.message} 주소를 직접 입력해주세요.`)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setTouched(true)
    setSubmitError('')
    if (Object.keys(validate(form)).length) return
    if (stockProblem) return setSubmitError(stockProblem)
    if (!agree) return setSubmitError('개인정보 수집·이용에 동의해주세요.')
    if (!supabase) return setSubmitError('주문 서버가 연결되지 않았습니다. (.env의 Supabase 설정 확인)')

    setSubmitting(true)
    const { data, error } = await supabase.rpc('create_order', {
      p_customer_name: form.name.trim(),
      p_phone: onlyDigits(form.phone),
      p_depositor_name: form.depositor.trim(),
      p_zipcode: form.zipcode,
      p_address1: form.address1.trim(),
      p_address2: form.address2.trim(),
      p_items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      p_delivery_start: form.timeStart,
      p_delivery_end: form.timeEnd,
    })
    setSubmitting(false)

    if (error) return setSubmitError(error.message || '주문 접수에 실패했습니다. 잠시 후 다시 시도해주세요.')

    const order = {
      orderCode: data.order_code,
      total: data.total_amount,
      name: form.name.trim(),
      depositorName: form.depositor.trim(),
    }
    try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)) } catch { /* 저장 실패해도 state로 전달 */ }
    navigate('/order-complete', { replace: true, state: order })
    if (fromCart) clearCart()
  }

  const header = (
    <header className="sticky top-0 z-30 flex h-[62px] items-center border-b border-black/10 bg-white px-4">
      <button type="button" aria-label="뒤로" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" strokeWidth={1.6} /></button>
      <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold">주문하기</h1>
    </header>
  )

  if (productLoading) return <div className="min-h-screen">{header}<p className="p-8 text-center text-sm text-black/50">불러오는 중...</p></div>

  if (!items.length) {
    return (
      <div className="min-h-screen">
        {header}
        <div className="p-8 text-center">
          <p className="text-sm">주문할 상품 정보가 없습니다.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-5 text-sm underline">홈으로</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {header}

      <form onSubmit={submit} noValidate className="px-5 pb-36 pt-7">
        <section>
          <p className="mb-4 text-[11px] font-bold tracking-[0.12em]">ORDER ITEM</p>
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="flex gap-4 border-b border-black/10 py-4 first:pt-0">
              <img src={product.image} alt="" className="h-28 w-24 bg-[#f5f5f5] object-cover" />
              <div className="flex flex-1 flex-col justify-between py-1">
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="mt-1 text-xs text-black/45">{won(product.price)} · 수량 {quantity}</p>
                </div>
                <p className="text-sm font-semibold">{won(Number(product.price) * quantity)}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-4">
          <p className="text-[11px] font-bold tracking-[0.12em]">ORDERER</p>
          <Field id="name" label="주문자 이름" required error={errors.name}>
            <input id="name" className={fieldClass('name')} autoComplete="name" maxLength={30} value={form.name} onChange={update('name')} />
          </Field>
          <Field id="phone" label="휴대폰 번호" required error={errors.phone} hint="주문조회와 배송 연락에 사용됩니다.">
            <input id="phone" className={fieldClass('phone')} type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" value={form.phone} onChange={update('phone', formatPhone)} />
          </Field>
          <Field id="depositor" label="입금자명" required error={errors.depositor} hint="계좌이체 시 통장에 찍히는 이름을 입력해주세요.">
            <div className="flex gap-2">
              <input id="depositor" className={fieldClass('depositor')} maxLength={30} value={form.depositor} onChange={update('depositor')} />
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, depositor: prev.name.trim() }))} className="w-28 shrink-0 border border-black/20 text-[11px] font-semibold">주문자와 같음</button>
            </div>
          </Field>
        </section>

        <section className="mt-10 space-y-4">
          <p className="text-[11px] font-bold tracking-[0.12em]">DELIVERY</p>
          <p className="bg-black/[0.04] px-4 py-3 text-[12px] leading-5 text-black/65">{DELIVERY_NOTICE}</p>
          <Field id="address1" label="배송지 주소" required error={errors.address1}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className={fieldClass('zipcode')} placeholder="우편번호" readOnly value={form.zipcode} onClick={openAddressSearch} />
                <button type="button" onClick={openAddressSearch} className="w-28 shrink-0 border border-black bg-white text-[11px] font-semibold">주소검색</button>
              </div>
              <input id="address1" className={fieldClass('address1')} placeholder="주소" autoComplete="street-address" maxLength={200} value={form.address1} onChange={update('address1')} />
              <input ref={address2Ref} className={fieldClass('address2')} placeholder="상세주소 (동/호수 등)" maxLength={200} value={form.address2} onChange={update('address2')} />
            </div>
          </Field>
          <Field id="timeStart" label="받으실 시간" required error={errors.time} hint="이 시간 사이에 받으실 수 있도록 배달원이 연락드려요.">
            <div className="flex items-center gap-2">
              <select id="timeStart" aria-label="시작 시간" className={fieldClass('time')} value={form.timeStart} onChange={update('timeStart')}>
                <option value="">시작</option>
                {DELIVERY_TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="shrink-0 text-sm text-black/45">~</span>
              <select aria-label="끝 시간" className={fieldClass('time')} value={form.timeEnd} onChange={update('timeEnd')}>
                <option value="">끝</option>
                {DELIVERY_TIMES.slice(1).map((t) => <option key={t} value={t} disabled={Boolean(form.timeStart) && t <= form.timeStart}>{t}</option>)}
              </select>
            </div>
          </Field>
        </section>

        <section className="mt-10 border-y border-black/10 py-6">
          <div className="flex justify-between text-sm"><span>상품 금액</span><span>{won(total)}</span></div>
          <div className="mt-3 flex justify-between text-sm"><span>배송비</span><span>무료</span></div>
          <div className="mt-5 flex justify-between text-base font-bold"><span>입금하실 금액</span><span>{won(total)}</span></div>
        </section>

        <section className="mt-6 border border-black/10 p-4">
          <p className="text-xs font-semibold">결제 방법 · 계좌이체</p>
          <p className="mt-2 text-[12px] leading-5 text-black/55">주문 후 안내되는 계좌로 입금해주세요. 입금이 확인되면 배송을 준비합니다. 최종 금액은 주문 시점의 판매가로 다시 계산됩니다.</p>
        </section>

        <label className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-black/60">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-black" />
          <span>주문 처리 및 배송을 위해 이름, 휴대폰 번호, 입금자명, 배송지 주소를 수집·이용하는 데 동의합니다. (필수)</span>
        </label>

        <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-[520px] -translate-x-1/2 border-t border-black/10 bg-white p-4 safe-bottom">
          {!submitError && stockProblem && <p role="alert" className="mb-3 text-center text-[12px] text-[#c4302b]">{stockProblem}</p>}
          {submitError && <p role="alert" className="mb-3 text-center text-[12px] text-[#c4302b]">{submitError}</p>}
          <button type="submit" disabled={submitting || Boolean(stockProblem)} className="w-full bg-black py-4 text-[12px] font-bold tracking-[0.13em] text-white disabled:opacity-50">
            {submitting ? '주문 접수 중...' : `${won(total)} 주문하기`}
          </button>
        </div>
      </form>
    </div>
  )
}
