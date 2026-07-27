import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, X, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  getNewOrdersForPharmacist,
  markOrderViewedByPharmacist,
  updateOrderStatus,
} from '@/services/notificationService'

export default function PharmacistNotificationCenter({ userId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const qc = useQueryClient()

  // Fetch new orders - refetch every 3 seconds
  const { data: newOrders = [] } = useQuery({
    queryKey: ['pharmacist-new-orders'],
    queryFn: getNewOrdersForPharmacist,
    refetchInterval: 3000, // Refetch every 3 seconds
    staleTime: 0, // Always consider data stale
  })

  // Mark order as viewed
  const markViewed = useMutation({
    mutationFn: markOrderViewedByPharmacist,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacist-new-orders'] })
    },
  })

  // Update order status
  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }) =>
      updateOrderStatus(orderId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacist-new-orders'] })
      toast.success('Order status updated! ✅')
      setSelectedOrder(null)
    },
    onError: () => toast.error('Failed to update order status'),
  })

  // Auto-show notification on new orders
  useEffect(() => {
    if (newOrders.length > 0 && !isOpen) {
      toast.success(`📦 New order received! (${newOrders.length})`, {
        duration: 5000,
      })
    }
  }, [newOrders.length, isOpen])

  const handleOrderClick = (order) => {
    setSelectedOrder(order)
    markViewed.mutate(order.id)
  }

  return (
    <>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
        title="New Orders"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {newOrders.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {newOrders.length > 9 ? '9+' : newOrders.length}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                📦 New Orders ({newOrders.length})
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto">
              {newOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No new orders</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {newOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => handleOrderClick(order)}
                      className="w-full text-left p-4 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            Order #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 mt-2 text-xs">
                        <p className="text-gray-700">
                          👤 {order.customer_name}
                        </p>
                        <p className="text-gray-600 mt-1">
                          📞 {order.customer_phone}
                        </p>
                        <p className="font-semibold text-gray-900 mt-1">
                          GHS {Number(order.total_amount).toFixed(2)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
                <h3 className="font-semibold text-gray-900">
                  Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                </h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Info */}
              <div className="p-5 bg-blue-50 border-b border-blue-100">
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-semibold text-gray-900">
                  {selectedOrder.customer_name}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  📞 {selectedOrder.customer_phone}
                </p>
                <p className="text-sm text-gray-600">
                  📧 {selectedOrder.customer_email}
                </p>
              </div>

              {/* Items */}
              <div className="p-5 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-600 mb-3">
                  Items
                </p>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm text-gray-700"
                    >
                      <div>
                        <p className="font-medium">
                          {item.products?.name ||
                            item.products?.generic_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">
                        GHS {Number(item.subtotal).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Address */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex justify-between font-semibold text-gray-900 mb-4">
                  <span>Total:</span>
                  <span>GHS {Number(selectedOrder.total_amount).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-600">Delivery Address</p>
                <p className="text-sm text-gray-900 font-medium mt-1">
                  {selectedOrder.delivery_address}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedOrder.city}
                </p>
              </div>

              {/* Status Update */}
              <div className="p-5 space-y-3">
                <p className="text-sm font-semibold text-gray-600">
                  Mark Order As:
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() =>
                      updateStatus.mutate({
                        orderId: selectedOrder.id,
                        status: 'ready',
                      })
                    }
                    disabled={updateStatus.isPending}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {updateStatus.isPending ? 'Updating...' : '✅ Ready for Pickup'}
                  </button>
                  <button
                    onClick={() =>
                      updateStatus.mutate({
                        orderId: selectedOrder.id,
                        status: 'dispensed',
                      })
                    }
                    disabled={updateStatus.isPending}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {updateStatus.isPending ? 'Updating...' : '💊 Dispensed'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}