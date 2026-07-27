import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard, ShoppingBag, FileText, Package, Users,
  LogOut, Pill, Tag, ChevronRight, Menu, X, Bell, ArrowLeft
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
import { toast } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getUserNotifications, markNotificationsRead } from '@/lib/notifications'
import PharmacistNotificationCenter from '../PharmacistNotificationCenter'

const NAV_CONFIGS = {
  customer: [
    { to: '/account', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/account/orders', label: 'My Orders', icon: ShoppingBag },
    { to: '/account/prescriptions', label: 'Prescriptions', icon: FileText },
  ],
  pharmacist: [
    { to: '/pharmacist', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/pharmacist/prescriptions', label: 'Prescriptions', icon: FileText },
    { to: '/pharmacist/orders', label: 'Orders', icon: ShoppingBag },
    { to: '/pharmacist/inventory', label: 'Inventory', icon: Package },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/admin/products', label: 'Products', icon: Pill },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  ],
}

const ROLE_LABELS = {
  customer: 'My Account',
  pharmacist: 'Pharmacist Portal',
  admin: 'Admin Panel',
}

function NotificationBell() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getUserNotifications({ user_id: user?.id, limit: 12 }),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 15,
    refetchOnWindowFocus: false,
  })

  const unreadCount = notifications.filter(notification => !notification.is_read).length

  useEffect(() => {
    if (!user?.id) return

    const channelName = `notifications-${user.id}-${Date.now()}`
    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      (payload) => {
        toast.success(payload.new.title)
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
      }
    )

    channel.subscribe()

    return () => supabase.removeChannel(channel)
  }, [queryClient, user?.id])

  useEffect(() => {
    if (!open || !user?.id) return
    if (!notifications.some(notification => !notification.is_read)) return

    markNotificationsRead(user.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }))
      .catch(console.error)
  }, [open, notifications, queryClient, user?.id])

  const handleNotificationClick = (notification) => {
    setOpen(false)
    const orderId = notification.data?.order_id
    const baseRoute = profile?.role === 'customer' ? '/account/orders' : '/pharmacist/orders'
    if (orderId) {
      navigate(`${baseRoute}/${orderId}`)
    } else {
      navigate(baseRoute)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="relative inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[22rem] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            </div>
            <button
              type="button"
              onClick={() => {
                markNotificationsRead(user?.id)
                  .then(() => queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }))
                  .catch(console.error)
              }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No notifications yet.</div>
            ) : (
              notifications.map(notification => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 transition-colors ${notification.is_read ? 'bg-white hover:bg-gray-50' : 'bg-brand-50 hover:bg-brand-100'}`}
                >
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                  <p className="mt-2 text-xs text-gray-400">{formatDistanceToNowStrict(new Date(notification.created_at), { addSuffix: true })}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ role }) {
  const { profile, signOut } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = NAV_CONFIGS[role] || []

  const isActive = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  // 🚀 SMART LOGO NAVIGATION - Navigate based on role
  const handleLogoClick = () => {
    if (role === 'admin') {
      navigate('/admin')
    } else if (role === 'pharmacist') {
      navigate('/pharmacist')
    } else {
      navigate('/account')
    }
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Portal header */}
      <div className="p-5 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-2 mb-4 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to store
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
            {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-gray-500 capitalize">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => {
          const active = isActive(item)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full top-0">
        {/* Logo - UPDATED: Now clickable with smart navigation */}
        <button 
          onClick={handleLogoClick}
          className="p-4 border-b border-gray-100 flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95"
          title={`Go to ${ROLE_LABELS[role] || 'Dashboard'}`}
        >
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Pill className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-brand-700">PharmaPlus</span>
        </button>
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-white h-full shadow-xl">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          {/* Logo - UPDATED: Now clickable with smart navigation */}
          <button 
            onClick={handleLogoClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95"
            title={`Go to ${ROLE_LABELS[role] || 'Dashboard'}`}
          >
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
              <Pill className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-brand-700 text-sm">PharmaPlus</span>
          </button>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-end border-b border-gray-200 bg-white px-8 py-4 sticky top-0 z-30">
          <NotificationBell />
        </div>

        <div className="flex-1 p-4 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}