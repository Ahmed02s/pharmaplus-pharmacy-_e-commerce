import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { Minus, Plus, Trash2, ShoppingBag, Tag, ArrowRight, Lock } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { EmptyState } from '@/components/ui/LoadingScreen'

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, discount, total, deliveryFee, coupon, setCoupon, removeCoupon, hasRxItem } = useCartStore()
  const { user } = useAuthStore()
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const navigate = useNavigate()

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .single()

    if (error || !data) {
      toast.error('Invalid or expired coupon code')
    } else if (data.max_uses && data.current_uses >= data.max_uses) {
      toast.error('This coupon has reached its usage limit')
    } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error('This coupon has expired')
    } else if (subtotal() < (data.min_order_amount ?? 0)) {
      toast.error(`Minimum order of GHS ${data.min_order_amount} required for this coupon`)
    } else {
      setCoupon(data)
      toast.success(`Coupon applied! You saved GHS ${discount().toFixed(2)}`)
    }
    setCouponLoading(false)
  }

  const handleCheckout = () => {
    if (!user) { navigate('/auth?redirect=/checkout'); return }
    navigate('/checkout')
  }

  if (items.length === 0) {
    return (
      <div className="page-container py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse our pharmacy to add medicines and health products."
          action={<Link to="/shop" className="btn-primary">Browse Medicines</Link>}
        />
      </div>
    )
  }

  return (
    <div className="page-container py-8">
      <h1 className="page-title mb-6">Shopping Cart <span className="text-gray-400 font-normal text-lg">({items.length} item{items.length !== 1 ? 's' : ''})</span></h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {hasRxItem() && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>Prescription required</strong> - Your cart includes prescription medicines.
                You'll upload your prescription at checkout.
              </p>
            </div>
          )}

          {items.map(item => (
            <div key={item.id} className="card p-4 flex gap-4">
              <img
                src={item.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200'}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-xl bg-gray-50 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                    {item.strength && <p className="text-xs text-gray-400 mt-0.5">{item.strength} · {item.dosage_form}</p>}
                    {item.requires_prescription && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md mt-1">
                        <Lock className="w-2.5 h-2.5" /> Rx
                      </span>
                    )}
                  </div>
                  <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 border border-gray-200 rounded-xl p-0.5">
                    <button
                      onClick={() => item.quantity === 1 ? removeItem(item.id) : updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, Math.min(item.stock_quantity, item.quantity + 1))}
                      className="w-7 h-7 rounded-lg hover:bg-brand-50 text-brand-600 flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="font-bold text-gray-900">
                    GHS {((item.sale_price ?? item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>GHS {subtotal().toFixed(2)}</span>
              </div>
              {discount() > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon discount</span>
                  <span>-GHS {discount().toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Delivery fee</span>
                <span>GHS {deliveryFee.toFixed(2)}</span>
              </div>
              {subtotal() >= 150 && (
                <p className="text-xs text-green-600 bg-green-50 rounded-lg px-2 py-1">🎉 You qualify for free delivery!</p>
              )}
              <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900 text-base">
                <span>Total</span>
                <span>GHS {(subtotal() >= 150 ? subtotal() - discount() : total()).toFixed(2)}</span>
              </div>
            </div>

            <button onClick={handleCheckout} className="btn-primary w-full mt-5">
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </button>
            <Link to="/shop" className="btn-ghost w-full mt-2 justify-center">
              Continue Shopping
            </Link>
          </div>

          {/* Coupon */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" /> Coupon Code
            </h3>
            {coupon ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-green-800">{coupon.code}</p>
                  <p className="text-xs text-green-600">{coupon.description}</p>
                </div>
                <button onClick={removeCoupon} className="text-xs text-red-500 hover:text-red-600 font-medium">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                  placeholder="Enter code"
                  className="input text-sm flex-1"
                />
                <button onClick={applyCoupon} disabled={couponLoading || !couponCode} className="btn-secondary btn-sm">
                  {couponLoading ? '...' : 'Apply'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
