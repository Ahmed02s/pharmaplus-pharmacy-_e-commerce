import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Search, ChevronDown, Package, MapPin, Phone } from 'lucide-react'
import { Spinner, EmptyState, OrderStatusBadge, Modal } from '@/components/ui/LoadingScreen'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['dispensed', 'cancelled'],
  dispensed: ['in_transit'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
}

const STATUS_TABS = ['all', 'pending', 'confirmed', 'dispensed', 'in_transit', 'delivered', 'cancelled']

export default function PharmacistOrdersPage() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const qc = useQueryClient()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['all-orders', tab],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select(`*, profiles!orders_customer_id_fkey(full_name, phone), order_items(id, quantity, products(name, image_url)), prescriptions(id, status)`)
        .order('created_at', { ascending: false })
      if (tab !== 'all') q = q.eq('status', tab)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 20000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id)
      if (error) throw error

      // notify customer
      const order = orders.find(o => o.id === id)
      if (order) {
        await supabase.from('notifications').insert({
          user_id: order.customer_id,
          type: 'order_update',
          title: `Order ${status.replace('_', ' ')}`,
          message: `Your order #${id.slice(0, 8).toUpperCase()} is now ${status.replace('_', ' ')}.`,
          data: { order_id: id },
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-orders'] })
      qc.invalidateQueries({ queryKey: ['pharmacist-stats'] })
      toast.success('Order status updated')
      setSelected(null)
    },
    onError: () => toast.error('Failed to update status'),
  })

  const filtered = orders.filter(o =>
    !search ||
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    o.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1 className="page-title mb-5">Order Management</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order ID or customer..." className="input pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No orders found" description="Try a different filter or search term." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Order</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Items</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Rx</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-700">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{format(new Date(order.created_at), 'dd MMM, HH:mm')}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{order.profiles?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{order.order_items?.length ?? 0}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">GHS {Number(order.total_amount).toFixed(2)}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3">
                    {order.prescriptions?.[0] ? (
                      <span className={`badge ${order.prescriptions[0].status === 'approved' ? 'badge-green' : order.prescriptions[0].status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {order.prescriptions[0].status}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(order)} className="text-brand-600 text-xs font-medium hover:text-brand-700">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order management modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Order #${selected.id.slice(0, 8).toUpperCase()}` : ''} size="md">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <OrderStatusBadge status={selected.status} />
              <span className="text-sm text-gray-400">{format(new Date(selected.created_at), 'dd MMM yyyy, HH:mm')}</span>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Customer</p>
              <p className="font-medium text-gray-900">{selected.profiles?.full_name}</p>
              {selected.profiles?.phone && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5"><Phone className="w-3.5 h-3.5" /> {selected.profiles.phone}</p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Delivery Address</p>
              <p className="text-sm text-gray-700">
                {selected.delivery_address?.street}, {selected.delivery_address?.city}, {selected.delivery_address?.region}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Items</p>
              <div className="space-y-2">
                {selected.order_items?.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                    <img src={item.products?.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-white flex-shrink-0" />
                    <p className="text-sm text-gray-800 flex-1">{item.products?.name}</p>
                    <span className="text-xs text-gray-500">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-3">
              <span>Total</span><span>GHS {Number(selected.total_amount).toFixed(2)}</span>
            </div>

            {/* Status transition buttons */}
            {STATUS_FLOW[selected.status]?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Update status to:</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FLOW[selected.status].map(nextStatus => (
                    <button
                      key={nextStatus}
                      onClick={() => updateStatus.mutate({ id: selected.id, status: nextStatus })}
                      disabled={updateStatus.isPending}
                      className={`btn-sm capitalize ${nextStatus === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                    >
                      {nextStatus.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}