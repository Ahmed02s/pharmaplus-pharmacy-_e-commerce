import { Link, useNavigate } from 'react-router-dom'
import { Search, Shield, Truck, Clock, ChevronRight, Pill, Leaf, Heart, Droplets, Wind, Zap } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/pharmacy/ProductCard'
import { Spinner } from '@/components/ui/LoadingScreen'

const CATEGORY_ICONS = { Antibiotics: Pill, Vitamins: Leaf, Cardiovascular: Heart, Diabetes: Droplets, Respiratory: Wind, Antimalarials: Shield }

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name')
      return data ?? []
    },
  })

  const { data: featuredProducts = [], isLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .limit(8)
      return data ?? []
    },
  })

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`)
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        <div className="page-container py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 text-white text-sm font-medium px-3 py-1.5 rounded-full mb-5">
              <Shield className="w-4 h-4" /> FDA Licensed & Verified
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Your Health,<br />Delivered to<br />Your Door
            </h1>
            <p className="text-brand-100 text-lg mb-8 max-w-xl leading-relaxed">
              Order genuine medicines online, upload prescriptions securely, and get them delivered across Ghana - fast and reliably.
            </p>
            <form onSubmit={handleSearch} className="flex gap-3 max-w-md">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search medicines, vitamins..."
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                />
              </div>
              <button type="submit" className="bg-white text-brand-700 font-semibold px-6 py-3.5 rounded-2xl hover:bg-brand-50 transition-colors text-sm flex-shrink-0">
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="bg-white border-b border-gray-100 py-4">
        <div className="page-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: 'FDA Licensed', sub: 'All medicines verified' },
              { icon: Truck, label: 'Fast Delivery', sub: 'Same-day Kumasi' },
              { icon: Clock, label: '24hr Support', sub: 'Pharmacist on call' },
              { icon: Zap, label: 'Rx Upload', sub: 'Easy prescription process' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="page-container py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">Shop by Category</h2>
          <Link to="/shop" className="text-sm text-brand-600 font-medium hover:text-brand-700 flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat.name] ?? Pill
            return (
              <Link
                key={cat.id}
                to={`/shop?category=${cat.slug}`}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-card-hover transition-all group"
              >
                <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <Icon className="w-6 h-6 text-brand-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">{cat.name}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Featured Products */}
      <section className="page-container py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">Featured Medicines</h2>
          <Link to="/shop" className="text-sm text-brand-600 font-medium hover:text-brand-700 flex items-center gap-1">
            Shop all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Prescription CTA */}
      <section className="page-container py-12">
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-3xl p-8 md:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Have a Prescription?</h3>
            <p className="text-brand-100 max-w-md">Upload your doctor's prescription during checkout. Our licensed pharmacists will verify and dispense your medicines safely.</p>
          </div>
          <Link to="/shop" className="btn-lg bg-white text-brand-700 hover:bg-brand-50 flex-shrink-0">
            Shop with Prescription
          </Link>
        </div>
      </section>
    </div>
  )
}
