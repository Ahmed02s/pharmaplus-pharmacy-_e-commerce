import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Check, CreditCard, MapPin, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Spinner, OrderStatusBadge, PrescriptionStatusBadge } from '@/components/ui/LoadingScreen'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

const STATUS_STEPS = ['pending', 'confirmed', 'dispensed', 'in_transit', 'delivered']
const STATUS_LABELS = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  dispensed: 'Dispensed',
  in_transit: 'In Transit',
  delivered: 'Delivered',
}
const PAYSTACK_SCRIPT_SRC = 'https://js.paystack.co/v1/inline.js'

function usePaystackScript() {
  const [loaded, setLoaded] = useState(() => Boolean(window.PaystackPop))

  useEffect(() => {
    if (window.PaystackPop) {
      setLoaded(true)
      return
    }

    const existing = document.querySelector(`script[src="${PAYSTACK_SCRIPT_SRC}"]`)
    if (existing) {
      const onLoad = () => setLoaded(true)
      existing.addEventListener('load', onLoad)
      return () => existing.removeEventListener('load', onLoad)
    }

    const script = document.createElement('script')
    script.src = PAYSTACK_SCRIPT_SRC
    script.async = true
    script.onload = () => setLoaded(true)
    document.body.appendChild(script)
  }, [])

  return loaded
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const paystackReady = usePaystackScript()
  const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
  const paymentMode = import.meta.env.VITE_PAYMENT_MODE || (import.meta.env.VITE_PAYMENT_DEMO_MODE === 'false' ? 'paystack_live' : 'demo')
  const demoMode = paymentMode === 'demo'
  const paystackTestMode = paymentMode === 'paystack_test'

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*, products(name, image_url, strength, dosage_form)),
          prescriptions(id, status, notes, reviewed_at),
          payments(provider, amount, status, paid_at, provider_ref)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const completePayment = useMutation({
    mutationFn: async (reference) => {
      if (!demoMode && !paystackTestMode) {
        const { data, error } = await supabase.functions.invoke('verify-paystack-payment', {
          body: { orderId: order.id, reference },
        })
        if (error) throw error
        if (!data?.ok) throw new Error(data?.error || 'Payment verification failed')
        return
      }

      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          notes: `${demoMode ? 'Demo' : 'Paystack test'} payment approved. Reference: ${reference}`,
        })
        .eq('id', order.id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Payment completed')
      qc.invalidateQueries({ queryKey: ['order', id] })
      qc.invalidateQueries({ queryKey: ['customer-orders'] })
    },
    onError: (error) => toast.error(error.message || 'Could not complete payment'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!order) return <div className="text-center py-12 text-gray-500">Order not found.</div>

  const currentStepIndex = order.status === 'cancelled' ? -1 : STATUS_STEPS.indexOf(order.status)
  const addr = order.delivery_address
  const prescription = order.prescriptions?.[0]
  const payment = order.payments?.[0]
  const canCompletePayment = order.status === 'pending' && order.payment_status !== 'paid'

  const handleCompletePayment = () => {
    if (demoMode) {
      completePayment.mutate(`DEMO-PP-${order.id.slice(0, 8)}-${Date.now()}`)
      return
    }

    if (!paystackKey) {
      toast.error('Paystack public key is missing.')
      return
    }

    if (!window.PaystackPop) {
      toast.error('Payment provider is still loading. Please try again in a moment.')
      return
    }

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: user?.email || 'customer@pharmaplus.test',
      amount: Math.round(Number(order.total_amount) * 100),
      currency: 'GHS',
      ref: `PP-${order.id.slice(0, 8)}-${Date.now()}`,
      metadata: { order_id: order.id },
      callback: response => completePayment.mutate(response.reference),
      onClose: () => toast('Payment window closed. Your order is still saved.', { icon: 'i' }),
    })

    handler.openIframe()
  }

  return (
    <div className="max-w-3xl">
      <Link to="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Placed {format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <OrderStatusBadge status={order.status} />
          <span className={order.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}>
            <CreditCard className="w-3 h-3" /> {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      </div>

      {canCompletePayment && (
        <div className="card p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-amber-200 bg-amber-50">
          <div>
            <p className="text-sm font-semibold text-amber-900">Payment incomplete</p>
            <p className="text-xs text-amber-700 mt-0.5">Complete payment to confirm this order and reserve stock.</p>
          </div>
          <button
            onClick={handleCompletePayment}
            disabled={completePayment.isPending || (!demoMode && !paystackReady)}
            className="btn-primary flex-shrink-0"
          >
            {completePayment.isPending ? <><Spinner size="sm" /> Processing...</> : 'Complete Payment'}
          </button>
        </div>
      )}

      {order.status !== 'cancelled' && (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-gray-800 mb-5 text-sm">Order Tracking</h2>
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 mx-8" />
            <div
              className="absolute top-4 left-0 h-0.5 bg-brand-500 mx-8 transition-all duration-700"
              style={{ width: currentStepIndex <= 0 ? '0%' : `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
            />
            {STATUS_STEPS.map((status, index) => {
              const done = index <= currentStepIndex
              const active = index === currentStepIndex
              return (
                <div key={status} className="flex flex-col items-center gap-2 relative z-10">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${done ? 'bg-brand-600 border-brand-600' : 'bg-white border-gray-300'}`}>
                    {done ? <Check className="w-4 h-4 text-white" /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                  </div>
                  <span className={`text-xs font-medium text-center leading-tight max-w-[60px] ${active ? 'text-brand-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {order.status === 'cancelled' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="text-red-800 text-sm font-medium">This order has been cancelled.</p>
        </div>
      )}

      {prescription && (
        <div className="card p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Prescription Review</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {prescription.reviewed_at ? `Reviewed ${format(new Date(prescription.reviewed_at), 'dd MMM, h:mm a')}` : 'Awaiting pharmacist review'}
            </p>
            {prescription.notes && <p className="text-xs text-gray-600 mt-1 italic">"{prescription.notes}"</p>}
          </div>
          <PrescriptionStatusBadge status={prescription.status} />
        </div>
      )}

      <div className="card p-5 mb-4">
        <h2 className="font-semibold text-gray-800 mb-4 text-sm flex items-center gap-2">
          <Package className="w-4 h-4" /> Items Ordered
        </h2>
        <div className="space-y-3">
          {order.order_items?.map(item => (
            <div key={item.id} className="flex items-center gap-4">
              <img
                src={item.products?.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100'}
                alt={item.products?.name}
                className="w-14 h-14 rounded-xl object-cover bg-gray-50 flex-shrink-0"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{item.products?.name}</p>
                <p className="text-xs text-gray-400">{item.products?.strength} - {item.products?.dosage_form}</p>
                <p className="text-xs text-gray-500 mt-0.5">Qty: {item.quantity}</p>
              </div>
              <p className="font-semibold text-gray-900 text-sm">GHS {Number(item.subtotal).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 mt-4 pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span><span>GHS {Number(order.subtotal).toFixed(2)}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount {order.coupon_code && `(${order.coupon_code})`}</span>
              <span>-GHS {Number(order.discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>Delivery</span><span>GHS {Number(order.delivery_fee).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2">
            <span>Total</span><span>GHS {Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-600" /> Delivery Address
          </h3>
          <p className="text-sm text-gray-700">{addr?.label}</p>
          <p className="text-sm text-gray-600">{addr?.street}</p>
          <p className="text-sm text-gray-600">{addr?.city}, {addr?.region}</p>
          <p className="text-sm text-gray-600">{addr?.country}</p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-600" /> Payment
          </h3>
          {payment ? (
            <>
              <p className="text-sm text-gray-700 capitalize">via {payment.provider}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{payment.provider_ref}</p>
              <span className={`badge mt-2 ${payment.status === 'success' ? 'badge-green' : 'badge-yellow'}`}>
                {payment.status === 'success' ? 'Paid' : 'Pending'}
              </span>
              {payment.paid_at && (
                <p className="text-xs text-gray-400 mt-1">{format(new Date(payment.paid_at), 'dd MMM yyyy, h:mm a')}</p>
              )}
            </>
          ) : order.payment_status === 'paid' ? (
            <>
              <p className="text-sm text-gray-700">Paid with {demoMode ? 'demo checkout' : 'Paystack test checkout'}</p>
              <span className="badge-green mt-2">Paid</span>
            </>
          ) : (
            <p className="text-sm text-gray-500">Payment pending</p>
          )}
        </div>
      </div>
    </div>
  )
}
