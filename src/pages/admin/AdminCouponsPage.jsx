import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Plus, Tag, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Spinner, EmptyState, Modal } from '@/components/ui/LoadingScreen'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

const EMPTY_COUPON = { code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_amount: '0', max_uses: '', expires_at: '' }

export default function AdminCouponsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_COUPON)
  const qc = useQueryClient()

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const createCoupon = useMutation({
    mutationFn: async (payload) => {
      const cleaned = {
        ...payload,
        code: payload.code.toUpperCase(),
        discount_value: parseFloat(payload.discount_value),
        min_order_amount: parseFloat(payload.min_order_amount) || 0,
        max_uses: payload.max_uses ? parseInt(payload.max_uses) : null,
        expires_at: payload.expires_at || null,
      }
      const { error } = await supabase.from('coupons').insert(cleaned)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast.success('Coupon created')
      setModalOpen(false)
      setForm(EMPTY_COUPON)
    },
    onError: (e) => toast.error(e.message?.includes('duplicate') ? 'Coupon code already exists' : 'Failed to create coupon'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('coupons').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast.success('Coupon updated')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.code || !form.discount_value) { toast.error('Code and discount value are required'); return }
    createCoupon.mutate(form)
  }

  const f = (field) => ({ value: form[field], onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) })

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="page-title">Coupons</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Coupon</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : coupons.length === 0 ? (
        <EmptyState icon={Tag} title="No coupons yet" action={<button onClick={() => setModalOpen(true)} className="btn-primary btn-sm">Create your first coupon</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map(c => (
            <div key={c.id} className={`card p-5 ${!c.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono font-bold text-brand-700 text-lg">{c.code}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                </div>
                <button onClick={() => toggleActive.mutate({ id: c.id, is_active: !c.is_active })}>
                  {c.is_active ? <ToggleRight className="w-7 h-7 text-brand-600" /> : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="text-2xl font-bold text-gray-900">
                  {c.discount_type === 'percentage' ? `${c.discount_value}%` : `GHS ${c.discount_value}`}
                  <span className="text-sm font-normal text-gray-500 ml-1">off</span>
                </p>
                {c.min_order_amount > 0 && <p className="text-xs text-gray-400 mt-1">Min order: GHS {c.min_order_amount}</p>}
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>{c.current_uses}/{c.max_uses ?? '∞'} used</span>
                <span>{c.expires_at ? `Expires ${format(new Date(c.expires_at), 'dd MMM yyyy')}` : 'No expiry'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(EMPTY_COUPON) }} title="Create Coupon" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Coupon Code *</label>
            <input {...f('code')} placeholder="e.g. SAVE20" className="input uppercase" required />
          </div>
          <div>
            <label className="label">Description</label>
            <input {...f('description')} placeholder="e.g. 20% off orders above GHS 100" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Discount Type</label>
              <select {...f('discount_type')} className="input">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount (GHS)</option>
              </select>
            </div>
            <div>
              <label className="label">Discount Value *</label>
              <input {...f('discount_value')} type="number" step="0.01" min="0" className="input" required />
            </div>
            <div>
              <label className="label">Min Order Amount</label>
              <input {...f('min_order_amount')} type="number" step="0.01" min="0" className="input" />
            </div>
            <div>
              <label className="label">Max Uses (optional)</label>
              <input {...f('max_uses')} type="number" min="1" placeholder="Unlimited" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Expiry Date (optional)</label>
              <input {...f('expires_at')} type="date" className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createCoupon.isPending} className="btn-primary flex-1">
              {createCoupon.isPending ? 'Creating...' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
