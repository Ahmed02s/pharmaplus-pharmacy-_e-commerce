import { supabase } from '@/lib/supabase'

export async function createNotification({ user_id, type, title, message, data = {} }) {
  if (!user_id) return null

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({ user_id, type, title, message, data })
    .select()
    .single()

  if (error) throw error
  return notification
}

export async function createNotificationsForUsers({ userIds, type, title, message, data = {} }) {
  if (!userIds?.length) return []

  const rows = userIds.filter(Boolean).map((user_id) => ({ user_id, type, title, message, data }))
  const { data: notifications, error } = await supabase.from('notifications').insert(rows).select()

  if (error) throw error
  return notifications ?? []
}

export async function notifyPharmacistsAndAdmins({ title, message, data = {} }) {
  const { data: users, error } = await supabase.from('profiles').select('id').in('role', ['pharmacist', 'admin'])
  if (error) throw error

  return createNotificationsForUsers({
    userIds: users?.map((user) => user.id) ?? [],
    type: 'order_update',
    title,
    message,
    data,
  })
}

export async function getUserNotifications({ user_id, limit = 20 }) {
  if (!user_id) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function markNotificationsRead(user_id) {
  if (!user_id) return []

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user_id)
    .eq('is_read', false)
    .select()

  if (error) throw error
  return data ?? []
}

export function formatStatusLabel(status) {
  return status?.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
