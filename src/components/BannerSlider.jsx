import { useEffect, useRef, useState } from 'react'
import { banners } from '../data/mockData'

export default function BannerSlider() {
  const [active, setActive] = useState(0)
  const scroller = useRef(null)
  const pausedUntil = useRef(0)

  // 타이머는 한 번만 등록하고, 사용자가 스와이프하면 잠시 자동 넘김을 멈춤
  useEffect(() => {
    const timer = setInterval(() => {
      const el = scroller.current
      if (!el || Date.now() < pausedUntil.current) return
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % banners.length
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  const pause = () => { pausedUntil.current = Date.now() + 6000 }

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <section className="relative overflow-hidden bg-[#f5f5f5]">
      <div ref={scroller} onScroll={onScroll} onPointerDown={pause} onTouchStart={pause} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {banners.map((banner) => (
          <article key={banner.id} className="relative min-w-full snap-center aspect-[4/4.65] overflow-hidden">
            <img src={banner.image} alt={banner.title} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-5 pb-7 pt-24 text-white">
              <p className="mb-2 text-[10px] font-semibold tracking-[0.2em]">{banner.eyebrow}</p>
              <h2 className="text-[27px] font-semibold leading-[1.12] tracking-tightest">{banner.title}</h2>
              <p className="mt-2 text-[12px] text-white/85">{banner.subtitle}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="absolute bottom-5 right-5 flex gap-1.5">
        {banners.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all ${active === i ? 'w-5 bg-white' : 'w-1 bg-white/55'}`} />)}
      </div>
    </section>
  )
}
