import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { FileText, ExternalLink } from 'lucide-react'
import { Spinner, EmptyState, PrescriptionStatusBadge } from '@/components/ui/LoadingScreen'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

export default function PrescriptionsPage() {
  const { user } = useAuthStore()

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['customer-prescriptions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`*, orders(id, total_amount, status)`)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.id,
  })

  const getPublicUrl = (path) => {
    const { data } = supabase.storage.from('prescriptions').getPublicUrl(path)
    return data?.publicUrl
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl">
      <h1 className="page-title mb-6">My Prescriptions</h1>

      {prescriptions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No prescriptions yet"
          description="Prescriptions uploaded during checkout will appear here."
          action={<Link to="/shop" className="btn-primary">Shop with Prescription</Link>}
        />
      ) : (
        <div className="space-y-3">
          {prescriptions.map(rx => (
            <div key={rx.id} className="card p-5 flex gap-4 items-start">
              {/* Image thumbnail */}
              <a
                href={getPublicUrl(rx.image_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 block"
              >
                <img
                  src={getPublicUrl(rx.image_path)}
                  alt="Prescription"
                  className="w-20 h-20 object-cover rounded-xl bg-gray-100 hover:opacity-80 transition-opacity"
                  onError={e => { e.target.src = ''; e.target.style.display = 'none' }}
                />
              </a>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Prescription - {format(new Date(rx.created_at), 'dd MMM yyyy')}
                    </p>
                    {rx.orders && (
                      <Link to={`/account/orders/${rx.orders.id}`} className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                        Order #{rx.orders.id.slice(0, 8).toUpperCase()}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <PrescriptionStatusBadge status={rx.status} />
                </div>

                {rx.notes && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-gray-600">Pharmacist note:</p>
                    <p className="text-xs text-gray-700 mt-0.5 italic">"{rx.notes}"</p>
                  </div>
                )}

                {rx.reviewed_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Reviewed: {format(new Date(rx.reviewed_at), 'dd MMM yyyy, h:mm a')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
