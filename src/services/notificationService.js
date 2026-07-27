import { supabase } from '@/lib/supabase'

/**
 * Get unread new orders for pharmacist
 */
export async function getNewOrdersForPharmacist() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, generic_name))')
      .eq('pharmacist_viewed', false)
      .in('status', ['pending', 'ready'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return []
    }
    return data || []
  } catch (error) {
    console.error('Error fetching new orders:', error)
    return []
  }
}

/**
 * Mark order as viewed by pharmacist
 */
export async function markOrderViewedByPharmacist(orderId) {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ pharmacist_viewed: true })
      .eq('id', orderId)

    if (error) {
      console.error('Error marking viewed:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Error marking order viewed:', error)
    return false
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId, newStatus) {
  try {
    // Validate status
    const validStatuses = ['pending', 'ready', 'dispensed', 'delivered', 'cancelled']
    if (!validStatuses.includes(newStatus)) {
      console.error('Invalid status:', newStatus)
      return false
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (error) {
      console.error('Error updating status:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Error updating order status:', error)
    return false
  }
}

/**
 * Get order with all details
 */
export async function getOrderDetails(orderId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, generic_name, price))')
      .eq('id', orderId)
      .single()

    if (error) {
      console.error('Error fetching order:', error)
      return null
    }
    return data
  } catch (error) {
    console.error('Error fetching order details:', error)
    return null
  }
}

/**
 * Get customer's orders with status for tracking
 */
export async function getCustomerOrders(customerId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name))')
      .eq('user_id', customerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customer orders:', error)
      return []
    }
    return data || []
  } catch (error) {
    console.error('Error fetching customer orders:', error)
    return []
  }
}

/**
 * Get low stock products (client-side filtering)
 */
export async function getLowStockProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, reorder_threshold')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching products:', error)
      return []
    }

    // Filter client-side: stock <= reorder threshold
    return (data || []).filter(
      product => product.stock_quantity <= product.reorder_threshold
    )
  } catch (error) {
    console.error('Error fetching low stock products:', error)
    return []
  }
}