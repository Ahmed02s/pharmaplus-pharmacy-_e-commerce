import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'
import { FileText, ShoppingBag, AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react'
import { StatCard, OrderStatusBadge } from '@/components/ui/LoadingScreen'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'

export default function PharmacistDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['pharmacist-stats'],
    queryFn: async () => {
      const [rxRes, ordersRes, lowStockRes] = await Promise.all([
        supabase.from('prescriptions').select('id, status').eq('status', 'pending'),
        supabase.from('orders').select('id, status').in('status', ['pending', 'confirmed']),
        supabase.from('products').select('id, name, stock_quantity, reorder_threshold').filter('stock_quantity', 'lte', 'reorder_threshold').eq('is_active', true),
      ])
      return {
        pendingRx: rxRes.data?.length ?? 0,
        activeOrders: ordersRes.data?.length ?? 0,
        lowStock: lowStockRes.data ?? [],
      }
    },
    refetchInterval: 30000,
  })

  const { data: recentOrders = [] } = useQuery({
    queryKey: ['recent-orders-pharmacist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, profiles!orders_customer_id_fkey(full_name), order_items(id)`)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) console.error('Recent orders query error:', error)
      return data ?? []
    },
    refetchInterval: 30000,
  })

  // Realtime subscription for new prescriptions
  useEffect(() => {
    const channel = supabase
      .channel('new-prescriptions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prescriptions' }, () => {
        toast('New prescription uploaded - awaiting review')
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <div>
      <h1 className="page-title mb-6">Pharmacist Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pending Prescriptions" value={stats?.pendingRx ?? '—'} icon={FileText} color="yellow" />
        <StatCard label="Active Orders" value={stats?.activeOrders ?? '—'} icon={ShoppingBag} color="blue" />
        <StatCard label="Low Stock Items" value={stats?.lowStock?.length ?? '—'} icon={AlertTriangle} color="red" />
        <StatCard label="Today" value={format(new Date(), 'EEE, dd MMM')} icon={Clock} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Orders</h2>
            <Link to="/pharmacist/orders" className="text-xs text-brand-600 hover:text-brand-700 font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <Link key={order.id} to="/pharmacist/orders" className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.profiles?.full_name ?? 'Customer'}</p>
                  <p className="text-xs text-gray-400 font-mono">#{order.id.slice(0, 8).toUpperCase()} · {order.order_items?.length} item(s)</p>
                </div>
                <div className="text-right">
                  <OrderStatusBadge status={order.status} />
                  <p className="text-xs text-gray-400 mt-1">{format(new Date(order.created_at), 'HH:mm')}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Low Stock Alerts
            </h2>
            <Link to="/pharmacist/inventory" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Manage</Link>
          </div>
          {stats?.lowStock?.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">All stock levels are healthy!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats?.lowStock?.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-2 rounded-xl bg-red-50">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-gray-800">{p.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge badge-red">{p.stock_quantity} left</span>
                    <p className="text-xs text-gray-400 mt-0.5">Threshold: {p.reorder_threshold}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
