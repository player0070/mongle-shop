import { useEffect, useSyncExternalStore } from 'react'
import { MAX_QUANTITY } from '../config/shop'
import { products as mockProducts } from '../data/mockData'
import { supabase } from './supabase'

// Supabase가 연결되어 있으면 DB 상품만 사용합니다. (목업 가격으로 주문되는 일 방지)
// 연결 전에는 화면 확인용으로 mockData를 보여줍니다.
// 상품 목록은 모든 화면이 함께 쓰는 하나의 저장소에 두고, 장바구니·주문 화면은 들어올 때마다 새로 불러옵니다.

// stock: null = 재고 관리 안 함(무제한), 숫자 = 남은 수량
const withStock = (product) => {
  const { inventory, ...rest } = product
  return { ...rest, stock: inventory ? inventory.stock : null }
}

// 카테고리는 판매 중인 상품에서 뽑습니다. (DB에 새 카테고리를 추가하면 필터·메뉴에 자동으로 나타남)
export const categoriesOf = (products) => [...new Set(products.map((p) => p.category).filter(Boolean))]

export const isSoldOut = (product) => product.stock === 0
export const maxOrderQuantity = (product) => (product.stock == null ? MAX_QUANTITY : Math.min(MAX_QUANTITY, product.stock))

let state = supabase
  ? { products: [], loading: true, error: '' }
  : { products: mockProducts.map((p) => ({ ...p, stock: p.stock ?? null })), loading: false, error: '' }
let loaded = false
let request = null
const listeners = new Set()

function setState(next) {
  state = next
  listeners.forEach((fn) => fn())
}

async function fetchProducts() {
  const query = (columns) => supabase.from('products').select(columns).eq('is_active', true).order('sort_order')
  let { data, error } = await query('*, inventory(stock)')
  // inventory 테이블이 아직 없는 DB(schema.sql 재실행 전)에서도 상품은 보이도록
  if (error?.code === 'PGRST200') ({ data, error } = await query('*'))
  if (error) throw error
  return data.map(withStock)
}

// refresh = true 이면 이미 불러왔어도 최신 재고·가격으로 다시 불러옵니다.
function loadProducts(refresh) {
  if (!supabase || request || (loaded && !refresh)) return
  // 새로 받는 동안에는 예전 재고로 주문 버튼이 눌리지 않도록 로딩 상태로 둡니다.
  if (!state.loading) setState({ ...state, loading: true })
  request = fetchProducts()
    .then((products) => {
      loaded = true
      setState({ products, loading: false, error: '' })
    })
    .catch(() => {
      // 다시 불러오기에 실패하면 갖고 있던 목록을 그대로 씁니다. (최종 가격·재고는 주문 시 서버가 다시 확인)
      setState(loaded
        ? { ...state, loading: false }
        : { products: [], loading: false, error: '상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' })
    })
    .finally(() => { request = null })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useProducts({ refresh = false } = {}) {
  useEffect(() => { loadProducts(refresh) }, [refresh])
  return useSyncExternalStore(subscribe, () => state)
}
