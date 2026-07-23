import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronRight, CreditCard, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { EmptyState, OrderStatusBadge, Spinner } from '@/components/ui/LoadingScreen'

export default function OrdersPage() {
  const { user } = useAuthStore()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['customer-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(id, quantity, unit_price, products(name, image_url))')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.id,
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">My Orders</h1>
        <span className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Your order history will appear here after your first purchase."
          action={<Link to="/shop" className="btn-primary">Start Shopping</Link>}
        />
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const firstItem = order.order_items?.[0]
            const extraItems = (order.order_items?.length ?? 1) - 1
            const paymentPaid = order.payment_status === 'paid'

            return (
              <Link key={order.id} to={`/account/orders/${order.id}`} className="card p-4 flex items-center gap-4 hover:shadow-card-hover transition-shadow">
                <img
                  src={firstItem?.products?.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=100'}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover bg-gray-50 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8).toUpperCase()}</span>
                    <OrderStatusBadge status={order.status} />
                    <span className={paymentPaid ? 'badge-green' : 'badge-yellow'}>
                      <CreditCard className="w-3 h-3" />
                      {paymentPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {firstItem?.products?.name}
                    {extraItems > 0 && <span className="text-gray-400"> +{extraItems} more</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(order.created_at), 'dd MMM yyyy')} - {order.order_items?.length} item{order.order_items?.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 text-sm">GHS {Number(order.total_amount).toFixed(2)}</p>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
