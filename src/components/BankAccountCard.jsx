import { useState } from 'react'
import { bankAccount, hasBankAccount } from '../config/shop'
import { copyText, won } from '../lib/format'

export default function BankAccountCard({ amount, depositorName }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyText(bankAccount.number.replace(/\D/g, ''))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="border border-black p-4 text-left text-[13px]">
      <p className="text-[10px] font-bold tracking-[0.14em]">BANK TRANSFER</p>
      {hasBankAccount ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-black/55">{bankAccount.bank} · 예금주 {bankAccount.holder}</p>
            <p className="mt-1 text-[16px] font-semibold tracking-tight">{bankAccount.number}</p>
          </div>
          <button type="button" onClick={copy} className="shrink-0 border border-black/20 px-3 py-2 text-[11px] font-semibold">
            {copied ? '복사됨' : '계좌 복사'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-black/55">입금 계좌 정보가 아직 설정되지 않았습니다.</p>
      )}
      <dl className="mt-4 space-y-2 border-t border-black/10 pt-4">
        {amount != null && <div className="flex justify-between"><dt className="text-black/50">입금하실 금액</dt><dd className="font-semibold">{won(amount)}</dd></div>}
        {depositorName && <div className="flex justify-between"><dt className="text-black/50">입금자명</dt><dd className="font-semibold">{depositorName}</dd></div>}
      </dl>
      <p className="mt-4 text-[11px] leading-5 text-black/50">입금자명과 금액이 주문 정보와 같아야 빠르게 확인됩니다. 입금이 확인되면 배송을 준비합니다.</p>
    </div>
  )
}
