import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Pill, Search, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/pharmacy/ProductCard'
import { EmptyState, Spinner } from '@/components/ui/LoadingScreen'

const DOSAGE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler']
const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [selectedForm, setSelectedForm] = useState('')
  const [rxOnly, setRxOnly] = useState(false)
  const [sort, setSort] = useState('name_asc')
  const [priceRange, setPriceRange] = useState([0, 500])

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, selectedCategory, selectedForm, rxOnly, sort, priceRange],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, categories(name, slug)')
        .eq('is_active', true)
        .gte('price', priceRange[0])
        .lte('price', priceRange[1])

      if (search) {
        query = query.or(`name.ilike.%${search}%,generic_name.ilike.%${search}%,brand.ilike.%${search}%`)
      }
      if (selectedCategory) {
        const category = categories.find(item => item.slug === selectedCategory)
        if (category) query = query.eq('category_id', category.id)
      }
      if (selectedForm) query = query.eq('dosage_form', selectedForm)
      if (rxOnly) query = query.eq('requires_prescription', true)

      const [field, dir] = sort.split('_')
      query = query.order(field === 'name' ? 'name' : 'price', { ascending: dir === 'asc' })

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    enabled: categories.length > 0 || !selectedCategory,
  })

  const { data: reviewRows = [] } = useQuery({
    queryKey: ['shop-product-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('product_id, rating')
      if (error) throw error
      return data ?? []
    },
  })

  const productsWithRatings = useMemo(() => {
    const ratingMap = new Map()

    reviewRows.forEach(review => {
      const current = ratingMap.get(review.product_id) || { count: 0, total: 0 }
      current.count += 1
      current.total += Number(review.rating)
      ratingMap.set(review.product_id, current)
    })

    return products.map(product => {
      const rating = ratingMap.get(product.id)
      return {
        ...product,
        average_rating: rating ? rating.total / rating.count : 0,
        review_count: rating?.count || 0,
      }
    })
  }, [products, reviewRows])

  useEffect(() => {
    setSearch(searchParams.get('search') || '')
    setSelectedCategory(searchParams.get('category') || '')
  }, [searchParams])

  const clearFilters = () => {
    setSearch('')
    setSelectedCategory('')
    setSelectedForm('')
    setRxOnly(false)
    setSort('name_asc')
    setPriceRange([0, 500])
    setSearchParams({})
  }

  const hasFilters = search || selectedCategory || selectedForm || rxOnly || priceRange[0] > 0 || priceRange[1] < 500

  return (
    <div className="page-container py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="hidden md:block w-64 flex-shrink-0">
          <FilterPanel {...{ categories, selectedCategory, setSelectedCategory, selectedForm, setSelectedForm, rxOnly, setRxOnly, priceRange, setPriceRange, clearFilters, hasFilters }} />
        </aside>

        <div className="md:hidden">
          <button onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 btn-secondary w-full justify-center">
            <SlidersHorizontal className="w-4 h-4" /> Filters {hasFilters && <span className="w-2 h-2 bg-brand-600 rounded-full" />}
          </button>
          {filtersOpen && (
            <div className="fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
              <div className="relative ml-auto w-72 bg-white h-full overflow-y-auto shadow-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Filters</h3>
                  <button onClick={() => setFiltersOpen(false)}><X className="w-5 h-5" /></button>
                </div>
                <FilterPanel {...{ categories, selectedCategory, setSelectedCategory, selectedForm, setSelectedForm, rxOnly, setRxOnly, priceRange, setPriceRange, clearFilters, hasFilters }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={event => {
                  setSearch(event.target.value)
                  setSearchParams(event.target.value ? { search: event.target.value } : {})
                }}
                placeholder="Search medicines, vitamins, brands..."
                className="input pl-10"
              />
              {search && (
                <button onClick={() => { setSearch(''); setSearchParams({}) }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={sort}
                onChange={event => setSort(event.target.value)}
                className="input pr-8 appearance-none w-full sm:w-48"
              >
                {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedCategory && (
                <Chip label={categories.find(category => category.slug === selectedCategory)?.name} onRemove={() => setSelectedCategory('')} />
              )}
              {selectedForm && <Chip label={selectedForm} onRemove={() => setSelectedForm('')} />}
              {rxOnly && <Chip label="Prescription only" onRemove={() => setRxOnly(false)} />}
              {(priceRange[0] > 0 || priceRange[1] < 500) && (
                <Chip label={`GHS ${priceRange[0]}-${priceRange[1]}`} onRemove={() => setPriceRange([0, 500])} />
              )}
              <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            {isLoading ? 'Loading...' : `${productsWithRatings.length} product${productsWithRatings.length !== 1 ? 's' : ''} found`}
          </p>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : productsWithRatings.length === 0 ? (
            <EmptyState
              icon={Pill}
              title="No medicines found"
              description="Try adjusting your search or filters"
              action={<button onClick={clearFilters} className="btn-primary btn-sm">Clear filters</button>}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {productsWithRatings.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove}><X className="w-3 h-3" /></button>
    </span>
  )
}

function FilterPanel({ categories, selectedCategory, setSelectedCategory, selectedForm, setSelectedForm, rxOnly, setRxOnly, priceRange, setPriceRange, clearFilters, hasFilters }) {
  return (
    <div className="space-y-6">
      {hasFilters && (
        <button onClick={clearFilters} className="text-xs text-red-600 font-medium flex items-center gap-1">
          <X className="w-3 h-3" /> Clear all filters
        </button>
      )}

      <div>
        <h4 className="font-semibold text-sm text-gray-800 mb-3">Category</h4>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="cat" checked={!selectedCategory} onChange={() => setSelectedCategory('')} className="text-brand-600" />
            <span className="text-sm text-gray-700">All Categories</span>
          </label>
          {categories.map(category => (
            <label key={category.id} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="cat" checked={selectedCategory === category.slug} onChange={() => setSelectedCategory(category.slug)} className="text-brand-600" />
              <span className="text-sm text-gray-700">{category.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm text-gray-800 mb-3">Dosage Form</h4>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="form" checked={!selectedForm} onChange={() => setSelectedForm('')} className="text-brand-600" />
            <span className="text-sm text-gray-700">All Forms</span>
          </label>
          {DOSAGE_FORMS.map(form => (
            <label key={form} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="form" checked={selectedForm === form} onChange={() => setSelectedForm(form)} className="text-brand-600" />
              <span className="text-sm text-gray-700 capitalize">{form}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm text-gray-800 mb-3">Price Range (GHS)</h4>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={0}
            max={priceRange[1]}
            value={priceRange[0]}
            onChange={event => setPriceRange([+event.target.value, priceRange[1]])}
            className="input text-sm py-1.5 px-2 w-20"
          />
          <span className="text-gray-400 text-sm">-</span>
          <input
            type="number"
            min={priceRange[0]}
            max={500}
            value={priceRange[1]}
            onChange={event => setPriceRange([priceRange[0], +event.target.value])}
            className="input text-sm py-1.5 px-2 w-20"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setRxOnly(!rxOnly)}
            className={`w-10 h-6 rounded-full transition-colors relative ${rxOnly ? 'bg-brand-600' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rxOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-700">Prescription items only</span>
        </label>
      </div>
    </div>
  )
}
