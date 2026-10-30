import { Menu, Search, ShoppingBag, X, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { categoriesOf, useProducts } from '../lib/products'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const navigate = useNavigate()
  const { products } = useProducts()
  const cart = useCart()
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const menuLinks = useMemo(() => [
    ['SHOP ALL', '/'],
    ...categoriesOf(products).map((c) => [c, `/?category=${encodeURIComponent(c)}`]),
    ['CART', '/cart'],
    ['ORDER LOOKUP', '/order-lookup'],
  ], [products])

  // 검색창 바깥을 누르면 결과 목록을 닫습니다. (입력한 검색어는 유지, 다시 누르면 열림)
  useEffect(() => {
    if (!searchOpen) return
    const onPointerDown = (e) => {
      if (!searchRef.current?.contains(e.target)) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [searchOpen])

  const result = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 4)
  }, [query, products])

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="relative flex h-[62px] items-center justify-between px-4">
          <div ref={searchRef} className="relative w-[112px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" strokeWidth={1.7} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              placeholder="SEARCH"
              className="h-9 w-full rounded-none border border-black/20 bg-white pl-8 pr-2 text-[10px] tracking-[0.12em] outline-none transition focus:border-black"
            />
            {query && searchOpen && (
              <div className="absolute left-0 top-10 z-50 w-[240px] border border-black/10 bg-white shadow-xl">
                {result.length ? result.map((item) => (
                  <button key={item.id} onClick={() => { setQuery(''); navigate(`/product/${item.id}`) }} className="flex w-full items-center gap-3 border-b border-black/5 p-2 text-left last:border-0">
                    <img src={item.image} className="h-12 w-10 object-cover" alt="" />
                    <span className="text-xs">{item.name}</span>
                  </button>
                )) : <p className="p-3 text-xs text-black/50">검색 결과가 없습니다.</p>}
              </div>
            )}
          </div>

          <Link to="/" className="absolute left-1/2 -translate-x-1/2 text-[19px] font-black tracking-[-0.04em]">MONGLE</Link>

          <div className="flex items-center">
            <Link to="/cart" aria-label={`장바구니 ${cartCount}개`} className="relative grid h-10 w-10 place-items-center">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.7} />
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[9px] font-bold leading-none text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <button aria-label="메뉴" onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center">
              <Menu className="h-5 w-5" strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 mx-auto max-w-[520px] bg-black/30" onClick={() => setMenuOpen(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="drawer-in ml-auto flex h-full w-[78%] max-w-[360px] flex-col bg-white p-5">
            <div className="mb-12 flex items-center justify-between">
              <span className="text-lg font-black tracking-tightest">MONGLE</span>
              <button onClick={() => setMenuOpen(false)}><X className="h-5 w-5" strokeWidth={1.7} /></button>
            </div>
            <nav className="space-y-1">
              {menuLinks.map(([label, href]) => (
                <Link key={label} to={href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between border-b border-black/10 py-4 text-[13px] font-semibold tracking-[0.04em]">
                  {label}<ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </Link>
              ))}
            </nav>
            <div className="mt-auto border-t border-black/10 pt-5 text-[11px] leading-5 text-black/50">
              <p>Small accessories, simple mood.</p>
              <p>Guest checkout only.</p>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
