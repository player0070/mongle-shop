import { useEffect, useState } from 'react'
import { MAX_QUANTITY } from '../config/shop'
import { products as mockProducts } from '../data/mockData'
import { supabase } from './supabase'

// Supabase가 연결되어 있으면 DB 상품만 사용합니다. (목업 가격으로 주문되는 일 방지)
// 연결 전에는 화면 확인용으로 mockData를 보여줍니다.
let request = null

// stock: null = 재고 관리 안 함(무제한), 숫자 = 남은 수량
const withStock = (product) => {
  const { inventory, ...rest } = product
  return { ...rest, stock: inventory ? inventory.stock : null }
}

export const isSoldOut = (product) => product.stock === 0
export const maxOrderQuantity = (product) => (product.stock == null ? MAX_QUANTITY : Math.min(MAX_QUANTITY, product.stock))

async function fetchProducts() {
  const query = (columns) => supabase.from('products').select(columns).eq('is_active', true).order('sort_order')
  let { data, error } = await query('*, inventory(stock)')
  // inventory 테이블이 아직 없는 DB(schema.sql 재실행 전)에서도 상품은 보이도록
  if (error?.code === 'PGRST200') ({ data, error } = await query('*'))
  if (error) throw error
  return data.map(withStock)
}

export function loadProducts() {
  if (!supabase) return Promise.resolve(mockProducts.map((p) => ({ ...p, stock: null })))
  if (!request) {
    request = fetchProducts()
      .catch((error) => {
        request = null
        throw error
      })
  }
  return request
}

export function useProducts() {
  const [state, setState] = useState(() => ({
    products: supabase ? [] : mockProducts.map((p) => ({ ...p, stock: null })),
    loading: Boolean(supabase),
    error: '',
  }))

  useEffect(() => {
    if (!supabase) return
    let alive = true
    loadProducts()
      .then((products) => alive && setState({ products, loading: false, error: '' }))
      .catch(() => alive && setState({ products: [], loading: false, error: '상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' }))
    return () => { alive = false }
  }, [])

  return state
}

export function useProduct(id) {
  const { products, loading, error } = useProducts()
  return { product: products.find((p) => p.id === id) || null, loading, error }
}
