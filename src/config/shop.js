// 입금 계좌는 .env 에서 설정합니다. (VITE_BANK_*)
export const bankAccount = {
  bank: import.meta.env.VITE_BANK_NAME || '',
  number: import.meta.env.VITE_BANK_ACCOUNT_NUMBER || '',
  holder: import.meta.env.VITE_BANK_ACCOUNT_HOLDER || '',
}

export const hasBankAccount = Boolean(bankAccount.bank && bankAccount.number)

// 하단 고객센터 · 이용약관 · 개인정보처리방침에 쓰이는 문의 이메일
export const CONTACT_EMAIL = 'hello@mongle.shop'

export const MAX_QUANTITY = 99

export const LAST_ORDER_KEY = 'mongle:lastOrder'

// 주문 후 이 시간 안에 입금이 확인되지 않으면 자동 취소됩니다. (실제 기준은 DB의 payment_deadline())
export const PAYMENT_DEADLINE_HOURS = 24

export const DELIVERY_NOTICE = '건국대 글로컬캠퍼스 교내 배송과 신촌, 모시래마을까지만 배송이 가능합니다. 시간 및 배송 위치는 배달원과 소통하여 변경 가능합니다.'
