import { useEffect } from 'react'

// 이용약관 · 개인정보처리방침 공통 틀. sections: [{ title, body: [문단 또는 항목 배열] }]
export default function PolicyPage({ eyebrow, title, effectiveDate, intro, sections }) {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <article className="px-5 pb-8 pt-10 text-[13px] leading-6 text-black/70">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-black/45">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tightest text-black">{title}</h1>
      <p className="mt-2 text-[11px] text-black/45">시행일 {effectiveDate}</p>
      {intro && <p className="mt-6 bg-black/[0.04] px-4 py-3 text-[12px] leading-5">{intro}</p>}

      {sections.map(({ title: heading, body }, i) => (
        <section key={heading} className="mt-8">
          <h2 className="text-[14px] font-semibold text-black">제{i + 1}조 {heading}</h2>
          {body.map((item, j) => (Array.isArray(item) ? (
            <ul key={j} className="mt-2 list-disc space-y-1 pl-5">
              {item.map((li) => <li key={li}>{li}</li>)}
            </ul>
          ) : (
            <p key={j} className="mt-2">{item}</p>
          )))}
        </section>
      ))}
    </article>
  )
}
