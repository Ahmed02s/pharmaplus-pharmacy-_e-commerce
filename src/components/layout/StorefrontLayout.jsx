import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, Pill, Search, User, LogOut, Menu, X, Bell } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { FaCar, FaPhone, FaEnvelope,FaMapMarker, FaClock } from 'react-icons/fa'


export default function StorefrontLayout() {
  const { user, profile, signOut } = useAuthStore()
  const itemCount = useCartStore(s => s.itemCount())
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
    setUserMenuOpen(false)
  }

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/shop?category=antimalarials', label: 'Antimalarials' },
    { to: '/shop?category=vitamins', label: 'Vitamins' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-brand-700 text-white text-xs py-1.5 text-center">
        <FaCar className="inline-block mr-2" /> Free delivery on orders above GHS 150 · <FaPhone className="inline-block mr-2" /> Helpline: 0592346676 · <FaEnvelope className="inline-block mr-2" /> Email: support@pharmaplus.com
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="page-container py-3">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
                <Pill className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-brand-700">PharmaPlus</span>
            </Link>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden sm:flex">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search medicines, vitamins..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400 bg-gray-50"
                />
              </div>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-auto">
              {/* Cart */}
              <Link to="/cart" className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </Link>

              {/* User menu */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                      {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                      {profile?.full_name ?? 'Account'}
                    </span>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-modal py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800 truncate">{profile?.full_name}</p>
                        <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                      </div>
                      {profile?.role === 'customer' && (
                        <>
                          <Link to="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <User className="w-4 h-4" /> My Account
                          </Link>
                          <Link to="/account/orders" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Bell className="w-4 h-4" /> My Orders
                          </Link>
                        </>
                      )}
                      {profile?.role === 'pharmacist' && (
                        <Link to="/pharmacist" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pill className="w-4 h-4" /> Pharmacist Portal
                        </Link>
                      )}
                      {profile?.role === 'admin' && (
                        <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <User className="w-4 h-4" /> Admin Portal
                        </Link>
                      )}
                      <button onClick={handleSignOut} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/auth" className="btn-primary btn-sm hidden sm:flex">Sign In</Link>
              )}

              {/* Mobile menu toggle */}
              <button className="sm:hidden p-2 rounded-xl hover:bg-gray-100" onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1 mt-2">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search medicines..." className="input pl-10" />
              </div>
            </form>
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-gray-700">{link.label}</Link>
            ))}
            {!user && <Link to="/auth" className="btn-primary w-full" onClick={() => setMobileOpen(false)}>Sign In</Link>}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">
        {userMenuOpen && <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />}
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-16">
        <div className="page-container py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                  <Pill className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">PharmaPlus</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">Ghana's trusted online pharmacy. Licensed, verified, and committed to your health.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Shop</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                {['Antibiotics', 'Vitamins', 'Pain Relief', 'Diabetes'].map(c => (
                  <li key={c}><Link to={`/shop?category=${c.toLowerCase()}`} className="hover:text-white transition-colors">{c}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Help</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                {['Prescription Guide', 'Delivery Info', 'Returns', 'Contact Us'].map(h => (
                  <li key={h}><a href="#" className="hover:text-white transition-colors">{h}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Contact</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <p><FaMapMarker className="inline-block mr-2" /> sunyani,fiapre, ghana</p>
                <p><FaPhone className="inline-block mr-2" /> 0592346676</p>
                <p><FaEnvelope className="inline-block mr-2" /> hello@pharmaplus.com.gh</p>
                <p><FaClock className="inline-block mr-2" /> Mon-Sat, 8am-8pm</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} PharmaPlus. All rights reserved. FDA Licensed: PHM-GH-2024.</p>
            <p>We accept: Mobile Money · Visa · Mastercard</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
