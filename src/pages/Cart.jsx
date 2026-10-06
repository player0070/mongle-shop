import { Minus, Plus, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { won } from '../lib/format'
import { removeFromCart, setCartQuantity, useCart } from '../lib/cart'
import { isSoldOut, maxOrderQuantity, useProducts } from '../lib/products'

export default function Cart() {
  const navigate = useNavigate()
  const cart = useCart()
  const { products, loading, error } = useProducts()

  // 저장된 { id, quantity }를 최신 상품 정보와 합칩니다. 판매가 끝난 상품은 product가 null입니다.
  const lines = cart.map((item) => ({ ...item, product: products.find((p) => p.id === item.id) || null }))
  const orderable = lines.filter((l) => l.product && !isSoldOut(l.product))
  const problem = orderable.find((l) => l.quantity > maxOrderQuantity(l.product))
  const total = orderable.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0)

  if (loading) return <div className="p-8 text-center text-sm text-black/50">불러오는 중...</div>
  if (error) return <div className="p-8 text-center text-sm">{error}</div>

  if (!cart.length) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="text-sm">장바구니가 비어 있어요.</p>
        <Link to="/" className="mt-5 inline-block text-sm underline">쇼핑하러 가기</Link>
      </div>
    )
  }

  return (
    <div>
      <section className="px-5 pb-6 pt-7">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-black/45">CART</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tightest">장바구니</h1>
      </section>

      <ul className="border-t border-black/10">
        {lines.map(({ id, quantity, product }) => {
          const unavailable = !product || isSoldOut(product)
          const max = product ? maxOrderQuantity(product) : 1
          return (
            <li key={id} className="flex gap-4 border-b border-black/10 px-5 py-5">
              {product ? (
                <Link to={`/product/${id}`} className="shrink-0">
                  <img src={product.image} alt="" className={`h-28 w-24 bg-[#f5f5f5] object-cover ${unavailable ? 'opacity-40' : ''}`} />
                </Link>
              ) : <div className="h-28 w-24 shrink-0 bg-[#f5f5f5]" />}
              <div className="flex flex-1 flex-col justify-between py-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{product ? product.name : '판매가 종료된 상품'}</p>
                    {product && <p className="mt-1 text-xs text-black/45">{won(product.price)}</p>}
                    {unavailable && <p className="mt-1 text-[11px] text-[#c4302b]">{product ? '품절' : '주문할 수 없어요'}</p>}
                    {!unavailable && quantity > max && <p className="mt-1 text-[11px] text-[#c4302b]">남은 수량 {product.stock}개</p>}
                  </div>
                  <button aria-label="삭제" onClick={() => removeFromCart(id)} className="-mr-1 -mt-1 grid h-8 w-8 place-items-center text-black/50">
                    <X className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </div>
                {!unavailable && (
                  <div className="flex items-end justify-between">
                    <div className="flex h-9 items-center border border-black/15">
                      <button aria-label="수량 줄이기" disabled={quantity <= 1} onClick={() => setCartQuantity(id, quantity - 1)} className="grid h-full w-9 place-items-center disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-8 text-center text-xs">{quantity}</span>
                      <button aria-label="수량 늘리기" disabled={quantity >= max} onClick={() => setCartQuantity(id, quantity + 1)} className="grid h-full w-9 place-items-center disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className="text-sm font-semibold">{won(Number(product.price) * quantity)}</p>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <section className="px-5 py-6">
        <div className="flex justify-between text-sm"><span>상품 금액</span><span>{won(total)}</span></div>
        <div className="mt-3 flex justify-between text-sm"><span>배송비</span><span>무료</span></div>
        <div className="mt-5 flex justify-between text-base font-bold"><span>총 금액</span><span>{won(total)}</span></div>
        {orderable.length < lines.length && <p className="mt-4 text-[11px] text-black/45">품절되거나 판매가 종료된 상품은 주문에서 제외됩니다.</p>}
      </section>

      <div className="sticky bottom-0 z-30 border-t border-black/10 bg-white p-4 safe-bottom">
        {problem && <p role="alert" className="mb-3 text-center text-[12px] text-[#c4302b]">{problem.product.name}의 재고가 부족합니다. 수량을 줄여주세요.</p>}
        <button
          onClick={() => navigate('/checkout?from=cart')}
          disabled={!orderable.length || Boolean(problem)}
          className="w-full bg-black py-4 text-[12px] font-bold tracking-[0.13em] text-white disabled:bg-black/25"
        >
          {orderable.length ? `${orderable.length}개 상품 주문하기 · ${won(total)}` : '주문할 수 있는 상품이 없습니다'}
        </button>
      </div>
    </div>
  )
}
