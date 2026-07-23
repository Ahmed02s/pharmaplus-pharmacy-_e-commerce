import { Pill, X } from 'lucide-react'
import { useEffect } from 'react'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
        <Pill className="w-6 h-6 text-white" />
      </div>
      <p className="text-sm text-gray-500 font-medium">Loading PharmaPlus...</p>
    </div>
  )
}

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className={`${sizes[size]} border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin ${className}`} />
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-modal w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}>
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, color = 'brand', note }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
    </div>
  )
}

export function OrderStatusBadge({ status }) {
  const map = {
    pending: ['badge-yellow', 'Pending'],
    confirmed: ['badge-blue', 'Confirmed'],
    dispensed: ['badge-purple', 'Dispensed'],
    in_transit: ['badge-orange', 'In Transit'],
    delivered: ['badge-green', 'Delivered'],
    cancelled: ['badge-red', 'Cancelled'],
  }
  const [cls, label] = map[status] ?? ['badge-gray', status]
  return <span className={cls}>{label}</span>
}

export function PrescriptionStatusBadge({ status }) {
  const map = {
    pending: ['badge-yellow', 'Pending Review'],
    approved: ['badge-green', 'Approved'],
    rejected: ['badge-red', 'Rejected'],
  }
  const [cls, label] = map[status] ?? ['badge-gray', status]
  return <span className={cls}>{label}</span>
}
