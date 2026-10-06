import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import BankAccountCard from '../components/BankAccountCard'
import { copyText, won } from '../lib/format'
import { LAST_ORDER_KEY } from '../config/shop'

function readLastOrder() {
  try { return JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY)) } catch { return null }
}

export default function OrderComplete() {
  const { state } = useLocation()
  const [order] = useState(() => state || readLastOrder())
  const [copied, setCopied] = useState(false)

  if (!order?.orderCode) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-black/60">표시할 주문 정보가 없습니다.</p>
        <div className="mt-6 grid w-full grid-cols-2 gap-2">
          <Link to="/order-lookup" className="border border-black py-4 text-xs font-semibold">주문조회</Link>
          <Link to="/" className="bg-black py-4 text-xs font-semibold text-white">홈으로</Link>
        </div>
      </section>
    )
  }

  const copyCode = async () => {
    if (await copyText(order.orderCode)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <section className="flex flex-col items-center px-6 pb-4 pt-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-black text-xl text-white">✓</div>
      <p className="mt-7 text-[10px] font-semibold tracking-[0.18em]">ORDER RECEIVED</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tightest">주문이 접수되었습니다.</h1>
      <p className="mt-4 text-sm leading-6 text-black/55">{order.name ? `${order.name}님, ` : ''}아래 계좌로 입금해주시면<br />확인 후 배송을 준비합니다.</p>

      <div className="mt-7 w-full border-y border-black/10 py-5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-black/45">주문번호</span>
          <span className="flex items-center gap-2">
            <strong className="tracking-wide">{order.orderCode}</strong>
            <button type="button" onClick={copyCode} className="border border-black/20 px-2 py-1 text-[10px] font-semibold">{copied ? '복사됨' : '복사'}</button>
          </span>
        </div>
        <p className="mt-2 text-left text-[11px] text-black/45">주문조회 시 주문번호와 휴대폰 번호가 필요하니 꼭 저장해두세요.</p>
        <div className="mt-4 flex justify-between"><span className="text-black/45">입금하실 금액</span><strong>{won(order.total)}</strong></div>
      </div>

      <div className="mt-6 w-full">
        <BankAccountCard depositorName={order.depositorName} />
      </div>

      <div className="mt-7 grid w-full grid-cols-2 gap-2">
        <Link to="/order-lookup" className="border border-black py-4 text-xs font-semibold">주문조회</Link>
        <Link to="/" className="bg-black py-4 text-xs font-semibold text-white">쇼핑 계속하기</Link>
      </div>
    </section>
  )
}
