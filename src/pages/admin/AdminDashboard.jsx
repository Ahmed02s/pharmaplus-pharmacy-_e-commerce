import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DollarSign, ShoppingBag, Users, Package, TrendingUp } from 'lucide-react'
import { StatCard, Spinner } from '@/components/ui/LoadingScreen'
import { format, subDays, startOfDay } from 'date-fns'

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString()

      const [ordersRes, usersRes, productsRes, paymentsRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, status, created_at'),
        supabase.from('profiles').select('id, role'),
        supabase.from('products').select('id, stock_quantity, reorder_threshold'),
        supabase.from('payments').select('amount, status, created_at, provider').eq('status', 'success'),
      ])

      const orders = ordersRes.data ?? []
      const validOrders = orders.filter(o => o.status !== 'cancelled')
      const totalRevenue = paymentsRes.data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0
      const recentRevenue = paymentsRes.data?.filter(p => p.created_at >= sevenDaysAgo).reduce((s, p) => s + Number(p.amount), 0) ?? 0

      // Revenue by day for chart (last 7 days)
      const dailyRevenue = {}
      for (let i = 6; i >= 0; i--) {
        const day = format(subDays(new Date(), i), 'EEE')
        dailyRevenue[day] = 0
      }
      paymentsRes.data?.forEach(p => {
        const day = format(new Date(p.created_at), 'EEE')
        if (day in dailyRevenue) dailyRevenue[day] += Number(p.amount)
      })

      return {
        totalRevenue,
        recentRevenue,
        totalOrders: validOrders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        totalCustomers: usersRes.data?.filter(u => u.role === 'customer').length ?? 0,
        totalStaff: usersRes.data?.filter(u => u.role !== 'customer').length ?? 0,
        lowStockProducts: productsRes.data?.filter(p => p.stock_quantity <= p.reorder_threshold).length ?? 0,
        totalProducts: productsRes.data?.length ?? 0,
        dailyRevenue,
        paystackCount: paymentsRes.data?.filter(p => p.provider === 'paystack').length ?? 0,
        stripeCount: paymentsRes.data?.filter(p => p.provider === 'stripe').length ?? 0,
      }
    },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const maxRevenue = Math.max(...Object.values(stats?.dailyRevenue ?? { a: 1 }), 1)

  return (
    <div>
      <h1 className="page-title mb-6">Admin Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={`GHS ${stats.totalRevenue.toFixed(0)}`} icon={DollarSign} color="green" note={`GHS ${stats.recentRevenue.toFixed(0)} this week`} />
        <StatCard label="Total Orders" value={stats.totalOrders} icon={ShoppingBag} color="blue" note={`${stats.pendingOrders} pending`} />
        <StatCard label="Customers" value={stats.totalCustomers} icon={Users} color="purple" note={`${stats.totalStaff} staff members`} />
        <StatCard label="Products" value={stats.totalProducts} icon={Package} color="brand" note={`${stats.lowStockProducts} low stock`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-600" /> Revenue - Last 7 Days
          </h2>
          <div className="flex items-end justify-between gap-3 h-48">
            {Object.entries(stats.dailyRevenue).map(([day, amount]) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-xs font-semibold text-gray-700">{amount > 0 ? `${amount.toFixed(0)}` : ''}</span>
                <div
                  className="w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-lg transition-all duration-500"
                  style={{ height: `${Math.max((amount / maxRevenue) * 100, 3)}%` }}
                />
                <span className="text-xs text-gray-400">{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment providers */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-5">Payment Methods</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-600">Paystack</span>
                <span className="font-semibold text-gray-900">{stats.paystackCount}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full"
                  style={{ width: `${(stats.paystackCount / Math.max(stats.paystackCount + stats.stripeCount, 1)) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-600">Stripe</span>
                <span className="font-semibold text-gray-900">{stats.stripeCount}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${(stats.stripeCount / Math.max(stats.paystackCount + stats.stripeCount, 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Quick Actions</p>
            <div className="space-y-2">
              <a href="/admin/products" className="block text-sm text-brand-600 hover:text-brand-700 font-medium">Manage Products</a>
              <a href="/admin/users" className="block text-sm text-brand-600 hover:text-brand-700 font-medium">Manage Users</a>
              <a href="/admin/coupons" className="block text-sm text-brand-600 hover:text-brand-700 font-medium">Manage Coupons</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
