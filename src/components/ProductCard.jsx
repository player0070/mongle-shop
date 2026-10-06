import { Link } from 'react-router-dom'
import { won } from '../lib/format'
import { isSoldOut } from '../lib/products'

export default function ProductCard({ product }) {
  const soldOut = isSoldOut(product)
  return (
    <Link to={`/product/${product.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#f5f5f5]">
        <img src={product.image} alt={product.name} className={`h-full w-full object-cover transition duration-300 group-active:scale-[0.99] ${soldOut ? 'opacity-40' : ''}`} />
        {soldOut && <span className="absolute inset-x-0 bottom-0 bg-black/75 py-1.5 text-center text-[10px] font-bold tracking-[0.16em] text-white">SOLD OUT</span>}
        {product.badge && !soldOut && <span className="absolute left-2 top-2 bg-black px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-white">{product.badge}</span>}
      </div>
      <div className="pt-3">
        <p className="text-[9px] tracking-[0.15em] text-black/45">{product.category}</p>
        <h3 className="mt-1 text-[13px] font-medium leading-5">{product.name}</h3>
        <p className="mt-1 text-[13px] font-semibold">{won(product.price)}</p>
      </div>
    </Link>
  )
}
