import { useState } from 'react'
import BankAccountCard from '../components/BankAccountCard'
import { formatDateTime, formatPhone, isValidPhone, onlyDigits, orderStatusLabel, won } from '../lib/format'
import { supabase } from '../lib/supabase'

const steps = ['입금 대기', '배송 준비', '배송 중', '배송 완료']

function stepIndex(order) {
  if (order.payment_status !== 'confirmed') return 0
  return { preparing: 1, shipping: 2, delivered: 3 }[order.shipping_status] ?? 1
}

export default function OrderLookup() {
  const [orderCode, setOrderCode] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const search = async (e) => {
    e.preventDefault()
    setMessage('')
    setOrder(null)
    if (!orderCode.trim() || !isValidPhone(phone)) return setMessage('주문번호와 휴대폰 번호를 정확히 입력해주세요.')
    if (!supabase) return setMessage('주문 서버가 연결되지 않았습니다.')

    setLoading(true)
    const { data, error } = await supabase.rpc('lookup_order', { p_order_code: orderCode.trim(), p_phone: onlyDigits(phone) })
    setLoading(false)
    if (error) return setMessage('조회 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
    if (!data) return setMessage('일치하는 주문을 찾을 수 없습니다. 주문번호와 휴대폰 번호를 확인해주세요.')
    setOrder(data)
  }

  const inputClass = 'h-12 w-full border border-black/15 px-3 text-sm outline-none focus:border-black'
  const current = order ? stepIndex(order) : 0

  return (
    <section className="px-5 pb-16 pt-10">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-black/45">GUEST ORDER</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tightest">비회원 주문조회</h1>
      <p className="mt-2 text-xs leading-5 text-black/50">주문 완료 화면에서 받은 주문번호와 주문 시 입력한 휴대폰 번호를 입력하세요.</p>

      <form onSubmit={search} noValidate className="mt-8 space-y-3">
        <input value={orderCode} onChange={(e) => setOrderCode(e.target.value.toUpperCase())} placeholder="주문번호 (예: MG261006-K7Q2ZP)" autoCapitalize="characters" className={inputClass} />
        <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="휴대폰 번호" type="tel" inputMode="numeric" className={inputClass} />
        <button type="submit" disabled={loading} className="h-12 w-full bg-black text-xs font-bold tracking-[0.1em] text-white disabled:opacity-50">{loading ? '조회 중...' : '조회하기'}</button>
      </form>

      {message && <p role="status" className="mt-5 text-xs text-black/55">{message}</p>}

      {order && (
        <div className="mt-8 space-y-5">
          <div className="border border-black/10 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold tracking-wide">{order.order_code}</p>
                <p className="mt-1 text-[11px] text-black/45">{formatDateTime(order.created_at)} 주문</p>
              </div>
              <span className="shrink-0 bg-black px-2 py-1 text-[11px] font-semibold text-white">{orderStatusLabel(order)}</span>
            </div>

            <ol className="mt-5 grid grid-cols-4 gap-1 text-center text-[10px]">
              {steps.map((label, i) => (
                <li key={label}>
                  <div className={`h-1 ${i <= current ? 'bg-black' : 'bg-black/10'}`} />
                  <p className={`mt-1.5 ${i === current ? 'font-semibold text-black' : 'text-black/40'}`}>{label}</p>
                </li>
              ))}
            </ol>

            <ul className="mt-5 space-y-2 border-t border-black/10 pt-4">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{item.product_name} <span className="text-black/45">× {item.quantity}</span></span>
                  <span>{won(item.unit_price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-black/10 pt-3 font-semibold"><span>합계</span><span>{won(order.total_amount)}</span></div>

            <dl className="mt-4 space-y-1.5 border-t border-black/10 pt-4 text-[12px]">
              <div className="flex gap-3"><dt className="w-14 shrink-0 text-black/45">입금자명</dt><dd>{order.depositor_name}</dd></div>
              <div className="flex gap-3"><dt className="w-14 shrink-0 text-black/45">배송지</dt><dd>{order.zipcode && `(${order.zipcode}) `}{order.address1} {order.address2}</dd></div>
              {order.delivery_time_start && <div className="flex gap-3"><dt className="w-14 shrink-0 text-black/45">수령 시간</dt><dd>{order.delivery_time_start} ~ {order.delivery_time_end}</dd></div>}
            </dl>
          </div>

          {order.payment_status !== 'confirmed' && <BankAccountCard amount={order.total_amount} depositorName={order.depositor_name} />}
        </div>
      )}
    </section>
  )
}
