import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../config/shop'

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-black/10 px-5 pb-10 pt-10 text-[11px] leading-5 text-black/55">
      <h2 className="mb-4 text-base font-black tracking-tightest text-black">MONGLE</h2>
      <div className="mb-7 flex gap-4 text-black">
        <Link to="/order-lookup">비회원 주문조회</Link>
        <Link to="/terms">이용약관</Link>
        <Link to="/privacy" className="font-semibold">개인정보처리방침</Link>
      </div>
      <p>MONGLE · MONGLE_SHOP</p>
      <p>고객센터 {CONTACT_EMAIL}</p>
      <p className="mt-6 text-[10px]">© MONGLE. ALL RIGHTS RESERVED.</p>
    </footer>
  )
}
