import { useSyncExternalStore } from 'react'
import { MAX_QUANTITY } from '../config/shop'

// 장바구니는 브라우저(localStorage)에만 저장합니다. 지워져도 괜찮은 임시 데이터입니다.
// 가격·상품 정보는 저장하지 않고 { id, quantity }만 두었다가 화면에서 최신 상품 목록과 합칩니다.
const CART_KEY = 'mongle:cart'
// create_order는 한 주문에 최대 20종까지 받습니다.
export const MAX_CART_ITEMS = 20

const listeners = new Set()

const clamp = (n) => Math.min(MAX_QUANTITY, Math.max(1, n))

// 예전 버전이나 직접 수정된 값이 섞여 있을 수 있으므로 정수 1~99, 상품당 한 줄, 최대 20종으로 정리합니다.
function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY))
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    return parsed.flatMap((i) => {
      const quantity = Math.floor(Number(i?.quantity))
      if (typeof i?.id !== 'string' || !(quantity > 0) || seen.has(i.id)) return []
      seen.add(i.id)
      return [{ id: i.id, quantity: clamp(quantity) }]
    }).slice(0, MAX_CART_ITEMS)
  } catch {
    return []
  }
}

let items = read()

function write(next) {
  items = next
  try { localStorage.setItem(CART_KEY, JSON.stringify(next)) } catch { /* 저장 실패해도 현재 탭에서는 유지 */ }
  listeners.forEach((fn) => fn())
}

// 담기에 성공하면 true, 종류 수 제한에 걸리면 false
export function addToCart(id, quantity = 1) {
  const found = items.find((i) => i.id === id)
  if (found) {
    write(items.map((i) => (i.id === id ? { ...i, quantity: clamp(i.quantity + quantity) } : i)))
    return true
  }
  if (items.length >= MAX_CART_ITEMS) return false
  write([...items, { id, quantity: clamp(quantity) }])
  return true
}

export function setCartQuantity(id, quantity) {
  write(items.map((i) => (i.id === id ? { ...i, quantity: clamp(quantity) } : i)))
}

export function removeFromCart(id) {
  write(items.filter((i) => i.id !== id))
}

export function clearCart() {
  write([])
}

function subscribe(fn) {
  listeners.add(fn)
  // 다른 탭에서 바뀐 장바구니도 반영
  const onStorage = (e) => {
    if (e.key !== CART_KEY) return
    items = read()
    fn()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

export function useCart() {
  return useSyncExternalStore(subscribe, () => items)
}
