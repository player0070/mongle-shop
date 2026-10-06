// 입금 계좌는 .env 에서 설정합니다. (VITE_BANK_*)
export const bankAccount = {
  bank: import.meta.env.VITE_BANK_NAME || '',
  number: import.meta.env.VITE_BANK_ACCOUNT_NUMBER || '',
  holder: import.meta.env.VITE_BANK_ACCOUNT_HOLDER || '',
}

export const hasBankAccount = Boolean(bankAccount.bank && bankAccount.number)

export const MAX_QUANTITY = 99

export const LAST_ORDER_KEY = 'mongle:lastOrder'

// 희망 수령 시간 선택 범위 (정각 단위, 24시간제). 예: 10 ~ 22 → 10:00 ~ 22:00 사이에서 선택
export const DELIVERY_HOURS = { start: 10, end: 22 }

export const DELIVERY_NOTICE = '건국대 글로컬캠퍼스 교내 배송과 신촌, 모시래마을까지만 배송이 가능합니다. 시간 및 배송 위치는 배달원과 소통하여 변경 가능합니다.'
