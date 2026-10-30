import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import BannerSlider from '../components/BannerSlider'
import ProductCard from '../components/ProductCard'
import { categoriesOf, useProducts } from '../lib/products'

// BEST → NEW → 그 외(뱃지 없음 포함) 순으로 보여주고, 같은 단계 안에서는 sort_order를 따릅니다.
const BADGE_RANK = { BEST: 0, NEW: 1 }
const badgeRank = (p) => BADGE_RANK[(p.badge || '').toUpperCase()] ?? 2

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || 'ALL'
  const { products: items, loading, error } = useProducts()
  const categories = useMemo(() => ['ALL', ...categoriesOf(items)], [items])

  const filtered = useMemo(() => {
    const list = category === 'ALL' ? items : items.filter((p) => p.category === category)
    return [...list].sort((a, b) => badgeRank(a) - badgeRank(b) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [category, items])

  const changeCategory = (next) => {
    if (next === 'ALL') setSearchParams({})
    else setSearchParams({ category: next })
  }

  return (
    <>
      <BannerSlider />

      <section className="px-4 pb-6 pt-7">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {categories.map((item) => (
            <button key={item} onClick={() => changeCategory(item)} className={`shrink-0 border px-4 py-2 text-[10px] font-semibold tracking-[0.12em] transition ${category === item ? 'border-black bg-black text-white' : 'border-black/15 bg-white text-black'}`}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-black/45">MONGLE SELECT</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tightest">Small things, good mood.</h1>
          </div>
          <span className="text-[10px] text-black/40">{filtered.length} ITEMS</span>
        </div>
        {loading ? (
          <p className="py-16 text-center text-xs text-black/45">불러오는 중...</p>
        ) : error ? (
          <p className="py-16 text-center text-xs text-black/55">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-xs text-black/45">준비 중인 상품입니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-8">
            {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>

      <section className="mt-20 border-y border-black/10 px-5 py-12 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em]">MONGLE NOTE</p>
        <p className="mx-auto mt-4 max-w-[330px] text-[20px] font-medium leading-7 tracking-tightest">취향을 크게 드러내지 않아도,<br />작은 것 하나로 충분해요.</p>
      </section>
    </>
  )
}
