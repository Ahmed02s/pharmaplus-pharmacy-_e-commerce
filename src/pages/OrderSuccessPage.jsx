import { useLocation, Link } from 'react-router-dom'
import { CheckCircle, ShoppingBag, ArrowRight, FileText } from 'lucide-react'

export default function OrderSuccessPage() {
  const { state } = useLocation()
  const orderId = state?.orderId
  const paymentReference = state?.paymentReference
  const demoMode = state?.demoMode

  return (
    <div className="page-container py-16 max-w-lg mx-auto text-center">
      <div className="card p-10">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-gray-500 mb-1">Thank you for your purchase.</p>
        {orderId && (
          <p className="text-xs text-gray-400 font-mono mb-6">
            Order ID: {orderId.slice(0, 8).toUpperCase()}
          </p>
        )}
        {paymentReference && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-6">
            <p className="text-xs font-semibold text-blue-800">
              {demoMode ? 'Demo payment approved' : 'Payment approved'}
            </p>
            <p className="text-xs text-blue-600 font-mono mt-1">{paymentReference}</p>
          </div>
        )}

        <div className="bg-brand-50 rounded-2xl p-4 mb-6 text-left">
          <p className="text-sm font-semibold text-brand-800 mb-2">What happens next?</p>
          <ul className="space-y-2 text-sm text-brand-700">
            <li className="flex items-start gap-2"><span className="mt-0.5">1.</span> Our pharmacist will review your order (and prescription if uploaded)</li>
            <li className="flex items-start gap-2"><span className="mt-0.5">2.</span> You'll receive a notification once confirmed</li>
            <li className="flex items-start gap-2"><span className="mt-0.5">3.</span> Your medicines will be dispatched and delivered</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          {orderId && (
            <Link to={`/account/orders/${orderId}`} className="btn-primary w-full justify-center">
              <FileText className="w-4 h-4" /> Track My Order
            </Link>
          )}
          <Link to="/account/orders" className="btn-secondary w-full justify-center">
            <ShoppingBag className="w-4 h-4" /> View All Orders
          </Link>
          <Link to="/shop" className="btn-ghost w-full justify-center">
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
