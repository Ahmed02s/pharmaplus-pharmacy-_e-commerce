import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { notifyPharmacistsAndAdmins } from '@/lib/notifications'
import { toast } from 'react-hot-toast'
import { AlertCircle, Check, CreditCard, FileText, Lock, MapPin, Upload, X } from 'lucide-react'
import { Spinner } from '@/components/ui/LoadingScreen'

const STEPS = ['Delivery', 'Prescription', 'Payment']
const PAYSTACK_SCRIPT_SRC = 'https://js.paystack.co/v1/inline.js'
const MIN_VERIFICATION_MS = 1800

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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
    script.onerror = () => {
      console.error('Failed to load Paystack script')
      toast.error('Could not load payment provider. Check your internet connection and try again.')
    }
    document.body.appendChild(script)
  }, [])

  return loaded
}

export default function CheckoutPage() {
  const { items, subtotal, discount, deliveryFee, coupon, clearCart, hasRxItem } = useCartStore()
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const paystackReady = usePaystackScript()
  const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
  const paymentMode = import.meta.env.VITE_PAYMENT_MODE || (import.meta.env.VITE_PAYMENT_DEMO_MODE === 'false' ? 'paystack_live' : 'demo')
  const demoMode = paymentMode === 'demo'
  const paystackTestMode = paymentMode === 'paystack_test'
  const serverVerifiedMode = paymentMode === 'paystack_live'

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [demoReceipt, setDemoReceipt] = useState(null)
  const [prescriptionFile, setPrescriptionFile] = useState(null)
  const [prescriptionPreview, setPrescriptionPreview] = useState(null)
  const [address, setAddress] = useState({
    label: 'Home',
    street: '',
    city: '',
    region: '',
    country: 'Ghana',
  })
  const fileRef = useRef()

  const freeDelivery = subtotal() >= 150
  const deliveryCost = freeDelivery ? 0 : deliveryFee
  const finalTotal = subtotal() - discount() + deliveryCost

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB.')
      return
    }
    setPrescriptionFile(file)
    setPrescriptionPreview(URL.createObjectURL(file))
  }

  const uploadPrescription = async (orderId) => {
    if (!prescriptionFile || !hasRxItem()) return

    const ext = prescriptionFile.name.split('.').pop()
    const filePath = `prescriptions/${user.id}/${orderId}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('prescriptions')
      .upload(filePath, prescriptionFile, { upsert: true })
    if (uploadErr) throw uploadErr

    const { error: prescriptionErr } = await supabase.from('prescriptions').insert({
      customer_id: user.id,
      order_id: orderId,
      image_path: filePath,
      status: 'pending',
    })
    if (prescriptionErr) throw prescriptionErr
  }

  const createOrder = async () => {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        status: 'pending',
        payment_status: 'unpaid',
        subtotal: subtotal(),
        delivery_fee: deliveryCost,
        discount: discount(),
        total_amount: finalTotal,
        delivery_address: address,
        coupon_code: coupon?.code ?? null,
      })
      .select()
      .single()

    if (orderErr) throw orderErr

    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.sale_price ?? item.price,
    }))
    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems)
    if (itemsErr) throw itemsErr

    await uploadPrescription(order.id)
    return order
  }

  const verifyPayment = async ({ orderId, reference }) => {
    if (demoMode || paystackTestMode) {
      const receipt = {
        orderId,
        reference,
        amount: finalTotal,
        label: demoMode ? 'Paystack Demo' : 'Paystack Test Mode',
      }

      setDemoReceipt({ ...receipt, status: 'verifying' })

      const [result] = await Promise.all([
        supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            notes: `${demoMode ? 'Demo' : 'Paystack test'} payment approved. Reference: ${reference}`,
          })
          .eq('id', orderId),
        wait(MIN_VERIFICATION_MS),
      ])

      if (result.error) throw result.error

      try {
        await notifyPharmacistsAndAdmins({
          title: 'New order placed',
          message: `Order #${orderId.slice(0, 8).toUpperCase()} is ready for processing.`,
          data: { order_id: orderId },
        })
      } catch (notifyError) {
        console.error('Failed to notify pharmacists:', notifyError)
      }

      clearCart()
      setDemoReceipt({ ...receipt, status: 'success' })
      return
    }

    const { data, error } = await supabase.functions.invoke('verify-paystack-payment', {
      body: { orderId, reference },
    })

    if (error) throw error
    if (!data?.ok) throw new Error(data?.error || 'Payment verification failed')

    try {
      await notifyPharmacistsAndAdmins({
        title: 'New order placed',
        message: `Order #${orderId.slice(0, 8).toUpperCase()} is ready for processing.`,
        data: { order_id: orderId },
      })
    } catch (notifyError) {
      console.error('Failed to notify pharmacists:', notifyError)
    }

    clearCart()
    navigate('/order-success', { state: { orderId } })
  }

  const handlePlaceOrder = async () => {
    if (!address.street || !address.city || !address.region) {
      toast.error('Please fill in all address fields')
      return
    }
    if (hasRxItem() && !prescriptionFile) {
      toast.error('Please upload your prescription')
      setStep(1)
      return
    }
    if (!demoMode && !paystackKey) {
      toast.error('Paystack public key is missing. Add VITE_PAYSTACK_PUBLIC_KEY to your .env file.')
      return
    }
    if (!demoMode && !window.PaystackPop) {
      toast.error('Payment provider is still loading. Please try again in a moment.')
      return
    }

    setSubmitting(true)
    try {
      const order = await createOrder()

      if (demoMode) {
        const reference = `DEMO-PP-${order.id.slice(0, 8)}-${Date.now()}`
        await verifyPayment({ orderId: order.id, reference })
        setSubmitting(false)
        return
      }

      const onPaymentSuccess = (response) => {
        verifyPayment({ orderId: order.id, reference: response.reference })
          .catch(err => {
            console.error(err)
            toast.error(`${serverVerifiedMode ? 'Payment received, but verification failed.' : 'Payment could not be saved.'} Reference: ${response.reference}`)
            navigate(`/account/orders/${order.id}`)
          })
          .finally(() => setSubmitting(false))
      }

      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email: user.email,
        amount: Math.round(finalTotal * 100),
        currency: 'GHS',
        ref: `PP-${order.id.slice(0, 8)}-${Date.now()}`,
        metadata: {
          order_id: order.id,
          customer_id: user.id,
          customer_name: profile?.full_name,
        },
        callback: onPaymentSuccess,
        onClose: function () {
          setSubmitting(false)
          toast('Payment cancelled. Your order is saved. You can complete payment from your orders page.', { icon: 'i' })
          navigate(`/account/orders/${order.id}`)
        },
      })

      handler.openIframe()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    navigate('/cart')
    return null
  }

  return (
    <div className="page-container py-8 max-w-5xl">
      <h1 className="page-title mb-6">Checkout</h1>

      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((stepName, index) => (
          <div key={stepName} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => index < step && setStep(index)}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${index === step ? 'text-brand-700' : index < step ? 'text-brand-500 cursor-pointer' : 'text-gray-400 cursor-default'}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${index === step ? 'bg-brand-600 text-white' : index < step ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'}`}>
                {index < step ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </span>
              <span className="hidden sm:block">{stepName}</span>
            </button>
            {index < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-3 ${index < step ? 'bg-brand-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {step === 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-600" /> Delivery Address
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Address Label</label>
                  <select value={address.label} onChange={e => setAddress(prev => ({ ...prev, label: e.target.value }))} className="input">
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Street Address *</label>
                  <input value={address.street} onChange={e => setAddress(prev => ({ ...prev, street: e.target.value }))} placeholder="e.g. 45 Osei Tutu Street" className="input" />
                </div>
                <div>
                  <label className="label">City *</label>
                  <input value={address.city} onChange={e => setAddress(prev => ({ ...prev, city: e.target.value }))} placeholder="e.g. Kumasi" className="input" />
                </div>
                <div>
                  <label className="label">Region *</label>
                  <select value={address.region} onChange={e => setAddress(prev => ({ ...prev, region: e.target.value }))} className="input">
                    <option value="">Select region</option>
                    {['Ashanti', 'Greater Accra', 'Northern', 'Eastern', 'Western', 'Central', 'Volta', 'Upper East', 'Upper West', 'Bono'].map(region => (
                      <option key={region}>{region}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!address.street || !address.city || !address.region) {
                    toast.error('Fill in all required fields')
                    return
                  }
                  setStep(hasRxItem() ? 1 : 2)
                }}
                className="btn-primary mt-6"
              >
                {hasRxItem() ? 'Next: Prescription' : 'Next: Payment'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" /> Upload Prescription
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Your cart contains prescription-only medicines. Upload a valid prescription from a licensed medical practitioner.
              </p>

              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${prescriptionFile ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'}`}
              >
                {prescriptionPreview ? (
                  <div className="relative inline-block">
                    <img src={prescriptionPreview} alt="Prescription preview" className="max-h-48 rounded-xl mx-auto" />
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setPrescriptionFile(null)
                        setPrescriptionPreview(null)
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700">Click to upload prescription</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF - Max 5MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Your prescription will be reviewed by our pharmacist within 30 minutes during business hours. You'll receive a notification once approved.</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(0)} className="btn-secondary">Back</button>
                <button
                  onClick={() => {
                    if (!prescriptionFile) {
                      toast.error('Please upload your prescription')
                      return
                    }
                    setStep(2)
                  }}
                  className="btn-primary flex-1"
                >
                  Next: Payment
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-600" /> Payment
              </h2>

              <div className="bg-gray-50 rounded-2xl p-4 mb-5">
                <p className="text-sm font-medium text-gray-800 mb-3">Accepted payment methods:</p>
                <div className="grid grid-cols-2 gap-2">
                  {['MTN Mobile Money', 'Vodafone Cash', 'AirtelTigo Money', 'Visa / Mastercard'].map(method => (
                    <div key={method} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 text-sm text-gray-700 border border-gray-200">
                      <Check className="w-3.5 h-3.5 text-brand-600" /> {method}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
                <Lock className="w-3.5 h-3.5" />
                Payments secured by Paystack - 256-bit SSL encryption
              </div>

              {demoMode && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-4">
                  <Check className="w-4 h-4" /> Demo mode is enabled. No real money will be charged.
                </div>
              )}

              {paystackTestMode && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-4">
                  <Check className="w-4 h-4" /> Paystack test mode is enabled. Use Paystack test cards or mobile money prompts.
                </div>
              )}

              {!demoMode && !paystackReady && paystackKey && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
                  <Spinner size="sm" /> Loading secure payment form...
                </div>
              )}

              {!demoMode && !paystackKey && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">
                  <AlertCircle className="w-4 h-4" /> Payment is not configured. Add VITE_PAYSTACK_PUBLIC_KEY to .env.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(hasRxItem() ? 1 : 0)} className="btn-secondary">Back</button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={submitting || (!demoMode && (!paystackKey || !paystackReady))}
                  className="btn-primary flex-1 btn-lg"
                >
                  {submitting ? <><Spinner size="sm" /> Processing...</> : `${demoMode ? 'Demo Pay' : 'Pay'} GHS ${finalTotal.toFixed(2)} via Paystack`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5 h-fit sticky top-24">
          <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
          <div className="space-y-3 mb-4">
            {items.map(item => (
              <div key={item.id} className="flex gap-3">
                <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover bg-gray-50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                </div>
                <p className="text-xs font-semibold text-gray-900 flex-shrink-0">
                  GHS {((item.sale_price ?? item.price) * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>GHS {subtotal().toFixed(2)}</span>
            </div>
            {discount() > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-GHS {discount().toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>Delivery</span>
              <span>{freeDelivery ? <span className="text-green-600">Free</span> : `GHS ${deliveryCost.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span><span>GHS {finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {demoReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md p-6 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${demoReceipt.status === 'success' ? 'bg-green-100' : 'bg-brand-50'}`}>
              {demoReceipt.status === 'success'
                ? <Check className="w-8 h-8 text-green-600" />
                : <Spinner size="lg" />}
            </div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide mb-2">{demoReceipt.label}</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {demoReceipt.status === 'success' ? 'Payment Successful' : 'Verifying Payment'}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {demoReceipt.status === 'success'
                ? 'Your payment has been approved and your order is confirmed.'
                : 'Please wait while we confirm your transaction reference.'}
            </p>

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-5">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-900">GHS {demoReceipt.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-500">Reference</span>
                <span className="font-mono text-xs font-semibold text-gray-900 text-right break-all">{demoReceipt.reference}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-500">Status</span>
                <span className={demoReceipt.status === 'success' ? 'badge-green' : 'badge-yellow'}>
                  {demoReceipt.status === 'success' ? 'Successful' : 'Verifying'}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/order-success', {
                state: {
                  orderId: demoReceipt.orderId,
                  paymentReference: demoReceipt.reference,
                  demoMode: true,
                },
              })}
              disabled={demoReceipt.status !== 'success'}
              className="btn-primary w-full"
            >
              {demoReceipt.status === 'success' ? 'Continue' : 'Verifying...'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
