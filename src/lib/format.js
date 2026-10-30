export const won = (value) => `${Number(value || 0).toLocaleString('ko-KR')}원`

export const onlyDigits = (value) => String(value || '').replace(/\D/g, '')

export const isValidPhone = (value) => /^01\d{8,9}$/.test(onlyDigits(value))

export function formatPhone(value) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length < 11) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}

export function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// 진행 순서대로. 주문 취소(cancelled)는 이 흐름 밖의 상태입니다.
export const ORDER_STEPS = [
  { value: 'awaiting_deposit', label: '입금 대기' },
  { value: 'deposit_confirmed', label: '입금 확인' },
  { value: 'preparing', label: '배송 준비' },
  { value: 'shipping', label: '배송 중' },
  { value: 'delivered', label: '배송 완료' },
]

// 손님에게 보여줄 주문 상태 한 줄
export function orderStatusLabel(status) {
  if (status === 'cancelled') return '주문 취소'
  return ORDER_STEPS.find((s) => s.value === status)?.label || status
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
