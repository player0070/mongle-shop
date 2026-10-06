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

const shippingLabels = { preparing: '배송 준비', shipping: '배송 중', delivered: '배송 완료' }

// 손님에게 보여줄 주문 상태 한 줄
export function orderStatusLabel(order) {
  if (order.payment_status !== 'confirmed') return '입금 대기'
  if (order.shipping_status === 'preparing') return '입금 확인 · 배송 준비'
  return shippingLabels[order.shipping_status] || order.shipping_status
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
