import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-black/10 px-5 pb-10 pt-10 text-[11px] leading-5 text-black/55">
      <h2 className="mb-4 text-base font-black tracking-tightest text-black">MONGLE</h2>
      <div className="mb-7 flex gap-4 text-black">
        <Link to="/order-lookup">비회원 주문조회</Link>
        <a href="#">이용약관</a>
        <a href="#">개인정보처리방침</a>
      </div>
      <p>상호 MONGLE · 대표자 홍길동</p>
      <p>사업자등록번호 000-00-00000 · 통신판매업 0000-0000</p>
      <p>고객센터 hello@mongle.shop</p>
      <p className="mt-6 text-[10px]">© MONGLE. ALL RIGHTS RESERVED.</p>
    </footer>
  )
}
