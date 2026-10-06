import { ArrowLeft, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { won } from '../lib/format'
import ProductCard from '../components/ProductCard'
import { addToCart, MAX_CART_ITEMS } from '../lib/cart'
import { isSoldOut, maxOrderQuantity, useProducts } from '../lib/products'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1)
  const [cartNotice, setCartNotice] = useState('')
  const { products, loading, error } = useProducts()
  const product = products.find((p) => p.id === id) || null
  const similar = useMemo(
    () => (product ? products.filter((p) => p.category === product.category && p.id !== product.id) : []),
    [products, product],
  )

  // 추천 상품을 눌러 다른 상품으로 이동하면 같은 컴포넌트가 재사용되므로 수량과 스크롤을 초기화합니다.
  useEffect(() => {
    setQuantity(1)
    setCartNotice('')
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    if (!cartNotice) return
    const timer = setTimeout(() => setCartNotice(''), 2500)
    return () => clearTimeout(timer)
  }, [cartNotice])

  if (loading) return <div className="p-8 text-center text-sm text-black/50">불러오는 중...</div>
  if (error) return <div className="p-8 text-center text-sm">{error}</div>
  if (!product) return <div className="p-8 text-center text-sm">상품을 찾을 수 없습니다.</div>

  const soldOut = isSoldOut(product)
  const maxQuantity = maxOrderQuantity(product)
  const lowStock = product.stock != null && product.stock > 0 && product.stock <= 5

  const buyNow = () => {
    if (soldOut) return
    navigate(`/checkout?product=${encodeURIComponent(product.id)}&qty=${quantity}`)
  }

  const putInCart = () => {
    if (soldOut) return
    setCartNotice(addToCart(product.id, quantity) ? 'added' : 'full')
  }

  return (
    <div>
      <div className="relative aspect-[4/4.9] bg-[#f5f5f5]">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        <button aria-label="뒤로" onClick={() => navigate(-1)} className="absolute left-4 top-4 grid h-10 w-10 place-items-center bg-white/90 backdrop-blur">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.6} />
        </button>
      </div>

      <section className="px-5 pb-6 pt-6">
        <p className="text-[10px] tracking-[0.17em] text-black/45">{product.category}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-[24px] font-semibold tracking-tightest">{product.name}</h1>
          <p className="whitespace-nowrap pt-1 text-[16px] font-semibold">{won(product.price)}</p>
        </div>
        <p className="mt-5 text-[13px] leading-6 text-black/60">{product.description}</p>
      </section>

      <section className="border-y border-black/10 px-5 py-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">
            수량
            {soldOut ? <span className="ml-2 font-normal text-[#c4302b]">품절</span>
              : lowStock ? <span className="ml-2 font-normal text-black/50">{product.stock}개 남음</span> : null}
          </span>
          <div className={`flex h-10 items-center border border-black/15 ${soldOut ? 'pointer-events-none opacity-30' : ''}`}>
            <button aria-label="수량 줄이기" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="grid h-full w-10 place-items-center disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-8 text-center text-xs">{quantity}</span>
            <button aria-label="수량 늘리기" disabled={quantity >= maxQuantity} onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} className="grid h-full w-10 place-items-center disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="px-4 pb-12 pt-10">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-black/45">YOU MAY ALSO LIKE</p>
          <h2 className="mb-5 mt-1 text-[18px] font-semibold tracking-tightest">비슷한 상품 추천</h2>
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-8">
            {similar.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 z-30 border-t border-black/10 bg-white p-4 safe-bottom">
        {cartNotice && (
          <div role="status" className="mb-3 flex items-center justify-between bg-black/[0.04] px-4 py-3 text-[12px]">
            {cartNotice === 'added'
              ? <><span>장바구니에 담았어요.</span><Link to="/cart" className="font-semibold underline">장바구니 보기</Link></>
              : <span>장바구니에는 최대 {MAX_CART_ITEMS}종까지 담을 수 있어요.</span>}
          </div>
        )}
        {soldOut ? (
          <button disabled className="w-full bg-black/25 py-4 text-[12px] font-bold tracking-[0.13em] text-white">품절된 상품입니다</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={putInCart} className="flex w-[38%] items-center justify-center gap-1.5 border border-black py-4 text-[12px] font-bold tracking-[0.08em]">
              <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />장바구니
            </button>
            <button onClick={buyNow} className="flex-1 bg-black py-4 text-[12px] font-bold tracking-[0.13em] text-white">
              바로 구매하기 · {won(Number(product.price) * quantity)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
