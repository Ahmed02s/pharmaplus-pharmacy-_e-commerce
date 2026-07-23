import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { CheckCircle, XCircle, Eye, FileText, Filter } from 'lucide-react'
import { Spinner, EmptyState, PrescriptionStatusBadge } from '@/components/ui/LoadingScreen'
import { Modal } from '@/components/ui/LoadingScreen'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

export default function PrescriptionReviewPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('pending')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['prescriptions-pharmacist', filter],
    queryFn: async () => {
      let q = supabase
        .from('prescriptions')
        .select(`*, profiles!prescriptions_customer_id_fkey(full_name, phone), orders(id, total_amount, status)`)
        .order('created_at', { ascending: false })
      if (filter !== 'all') q = q.eq('status', filter)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    refetchInterval: filter === 'pending' ? 15000 : false,
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const { error } = await supabase
        .from('prescriptions')
        .update({
          status,
          notes,
          pharmacist_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error

      // If approved and has associated order, confirm the order
      if (status === 'approved' && selected?.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'confirmed' })
          .eq('id', selected.order_id)
          .eq('status', 'pending')
      }

      // Create notification for customer
      await supabase.from('notifications').insert({
        user_id: selected.customer_id,
        type: 'prescription_review',
        title: status === 'approved' ? 'Prescription Approved ✅' : 'Prescription Rejected ❌',
        message: status === 'approved'
          ? 'Your prescription has been approved. Your order is now being processed.'
          : `Your prescription was rejected. Reason: ${notes || 'Please contact us for more information.'}`,
        data: { prescription_id: id },
      })
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['prescriptions-pharmacist'] })
      qc.invalidateQueries({ queryKey: ['pharmacist-stats'] })
      toast.success(`Prescription ${status}`)
      setSelected(null)
      setNotes('')
    },
    onError: () => toast.error('Failed to update prescription'),
  })

  const getImageUrl = (path) => {
    const { data } = supabase.storage.from('prescriptions').createSignedUrl(path, 3600)
    return data?.signedUrl
  }

  const getPublicUrl = (path) => {
    const { data } = supabase.storage.from('prescriptions').getPublicUrl(path)
    return data?.publicUrl
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="page-title">Prescription Review</h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : prescriptions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${filter} prescriptions`}
          description="Prescriptions uploaded by customers will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prescriptions.map(rx => (
            <div key={rx.id} className="card p-4">
              <div className="flex gap-4">
                {/* Prescription image */}
                <a href={getPublicUrl(rx.image_path)} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <img
                    src={getPublicUrl(rx.image_path)}
                    alt="Prescription"
                    className="w-24 h-24 rounded-xl object-cover bg-gray-100 hover:opacity-80 transition-opacity"
                    onError={e => { e.target.style.background = '#f3f4f6' }}
                  />
                </a>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{rx.profiles?.full_name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{format(new Date(rx.created_at), 'dd MMM yyyy, HH:mm')}</p>
                    </div>
                    <PrescriptionStatusBadge status={rx.status} />
                  </div>

                  {rx.orders && (
                    <p className="text-xs text-gray-500 mt-1">
                      Order #{rx.orders.id?.slice(0, 8).toUpperCase()} · GHS {Number(rx.orders.total_amount).toFixed(2)}
                    </p>
                  )}
                  {rx.notes && (
                    <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">"{rx.notes}"</p>
                  )}
                </div>
              </div>

              {rx.status === 'pending' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => { setSelected(rx); setNotes('') }}
                    className="btn-secondary btn-sm flex-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Review
                  </button>
                  <button
                    onClick={() => reviewMutation.mutate({ id: rx.id, status: 'approved', notes: '' })}
                    disabled={reviewMutation.isPending}
                    className="btn-sm bg-green-600 text-white hover:bg-green-700 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setNotes('') }} title="Review Prescription" size="lg">
        {selected && (
          <div className="space-y-5">
            {/* Full size image */}
            <div className="bg-gray-50 rounded-2xl p-4 flex justify-center">
              <img
                src={getPublicUrl(selected.image_path)}
                alt="Prescription"
                className="max-h-72 rounded-xl object-contain"
              />
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Customer</p>
                <p className="font-medium text-gray-900">{selected.profiles?.full_name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-0.5">Submitted</p>
                <p className="font-medium text-gray-900">{format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm')}</p>
              </div>
              {selected.orders && (
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs mb-0.5">Associated Order</p>
                  <p className="font-medium text-gray-900">#{selected.orders.id?.slice(0, 8).toUpperCase()} · GHS {Number(selected.orders.total_amount).toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="label">Pharmacist Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes for the customer (required for rejection)..."
                className="input resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => reviewMutation.mutate({ id: selected.id, status: 'rejected', notes })}
                disabled={reviewMutation.isPending || !notes.trim()}
                className="btn-danger flex-1"
              >
                <XCircle className="w-4 h-4" />
                {reviewMutation.isPending ? 'Saving...' : 'Reject (note required)'}
              </button>
              <button
                onClick={() => reviewMutation.mutate({ id: selected.id, status: 'approved', notes })}
                disabled={reviewMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {reviewMutation.isPending ? 'Saving...' : 'Approve'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}