import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

// Layouts
import StorefrontLayout from '@/components/layout/StorefrontLayout'
import DashboardLayout from '@/components/layout/DashboardLayout'

// Public pages
import HomePage from '@/pages/HomePage'
import ShopPage from '@/pages/ShopPage'
import ProductPage from '@/pages/ProductPage'
import CartPage from '@/pages/CartPage'
import CheckoutPage from '@/pages/CheckoutPage'
import AuthPage from '@/pages/AuthPage'
import OrderSuccessPage from '@/pages/OrderSuccessPage'

// Customer pages
import AccountPage from '@/pages/customer/AccountPage'
import OrdersPage from '@/pages/customer/OrdersPage'
import OrderDetailPage from '@/pages/customer/OrderDetailPage'
import PrescriptionsPage from '@/pages/customer/PrescriptionsPage'

// Pharmacist pages
import PharmacistDashboard from '@/pages/pharmacist/PharmacistDashboard'
import PrescriptionReviewPage from '@/pages/pharmacist/PrescriptionReviewPage'
import PharmacistOrdersPage from '@/pages/pharmacist/PharmacistOrdersPage'
import InventoryPage from '@/pages/pharmacist/InventoryPage'

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminProductsPage from '@/pages/admin/AdminProductsPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminCouponsPage from '@/pages/admin/AdminCouponsPage'

import LoadingScreen from '@/components/ui/LoadingScreen'

function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuthStore()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  if (roles && !roles.includes(profile?.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { initialize, setSession, fetchProfile, loading } = useAuthStore()

  useEffect(() => {
    initialize()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <LoadingScreen />

  return (
    <Routes>
      {/* Public storefront */}
      <Route element={<StorefrontLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/order-success" element={<ProtectedRoute><OrderSuccessPage /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
      </Route>

      {/* Customer portal */}
      <Route path="/account" element={<ProtectedRoute roles={['customer']}><DashboardLayout role="customer" /></ProtectedRoute>}>
        <Route index element={<AccountPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
      </Route>

      {/* Pharmacist portal */}
      <Route path="/pharmacist" element={<ProtectedRoute roles={['pharmacist','admin']}><DashboardLayout role="pharmacist" /></ProtectedRoute>}>
        <Route index element={<PharmacistDashboard />} />
        <Route path="prescriptions" element={<PrescriptionReviewPage />} />
        <Route path="orders" element={<PharmacistOrdersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
      </Route>

      {/* Admin portal */}
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout role="admin" /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="coupons" element={<AdminCouponsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
