import { Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderComplete from './pages/OrderComplete'
import OrderLookup from './pages/OrderLookup'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

export default function App() {
  const location = useLocation()
  const isCheckout = location.pathname === '/checkout'

  return (
    <div className="mx-auto min-h-screen w-full max-w-[520px] bg-white text-[#111] shadow-[0_0_40px_rgba(0,0,0,0.04)]">
      {!isCheckout && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-complete" element={<OrderComplete />} />
          <Route path="/order-lookup" element={<OrderLookup />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </main>
      {!isCheckout && <Footer />}
    </div>
  )
}
