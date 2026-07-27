import { supabase } from '@/lib/supabase'

/**
 * Get unread new orders for pharmacist
 * Checks for orders that haven't been marked as read by pharmacist
 */
export async function getNewOrdersForPharmacist() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, generic_name))')
      .eq('pharmacist_viewed', false)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
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

    if (error) throw error
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
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (error) throw error
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

    if (error) throw error
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

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching customer orders:', error)
    return []
  }
}