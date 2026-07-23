import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Filter,
  Package,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { EmptyState, Modal, Spinner } from '@/components/ui/LoadingScreen'
import { toast } from 'react-hot-toast'

const EMPTY_PRODUCT = {
  name: '',
  generic_name: '',
  brand: '',
  category_id: '',
  description: '',
  dosage_form: 'tablet',
  strength: '',
  price: '',
  sale_price: '',
  stock_quantity: '',
  reorder_threshold: '10',
  requires_prescription: false,
  image_url: '',
  manufacturer: '',
  is_active: true,
}

const DOSAGE_FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'suppository', 'patch', 'other']

export default function AdminProductsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [formErrors, setFormErrors] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const qc = useQueryClient()

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-independent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Categories fetch error:', error)
        return []
      }

      return data ?? []
    },
  })

  const {
    data: products = [],
    error,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Products fetch error:', error)
        throw error
      }

      return data ?? []
    },
  })

  const categoryById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories]
  )

  const productsWithCategories = useMemo(
    () => products.map(product => ({
      ...product,
      categories: categoryById.get(product.category_id) || null,
    })),
    [categoryById, products]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return productsWithCategories.filter(product => {
      const matchesSearch = !query || [
        product.name,
        product.generic_name,
        product.brand,
        product.manufacturer,
        product.categories?.name,
      ].some(value => value?.toLowerCase().includes(query))

      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter
      const matchesStatus = statusFilter === 'all' || (
        statusFilter === 'active' ? product.is_active : !product.is_active
      )
      const isLowStock = Number(product.stock_quantity) <= Number(product.reorder_threshold ?? 0)
      const matchesStock = stockFilter === 'all' || (
        stockFilter === 'low' ? isLowStock : !isLowStock
      )

      return matchesSearch && matchesCategory && matchesStatus && matchesStock
    })
  }, [categoryFilter, productsWithCategories, search, statusFilter, stockFilter])

  const stats = useMemo(() => {
    const lowStock = productsWithCategories.filter(product => Number(product.stock_quantity) <= Number(product.reorder_threshold ?? 0))

    return {
      total: productsWithCategories.length,
      active: productsWithCategories.filter(product => product.is_active).length,
      lowStock: lowStock.length,
      prescription: productsWithCategories.filter(product => product.requires_prescription).length,
    }
  }, [productsWithCategories])

  const uploadImageToStorage = async (file) => {
    try {
      setUploadingImage(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `drug-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('drug_images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('drug_images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Image upload error:', error)
      toast.error('Failed to upload image')
      throw error
    } finally {
      setUploadingImage(false)
    }
  }

  const saveProduct = useMutation({
    mutationFn: async (payload) => {
      const cleaned = {
        ...payload,
        price: parseFloat(payload.price),
        sale_price: payload.sale_price ? parseFloat(payload.sale_price) : null,
        stock_quantity: parseInt(payload.stock_quantity, 10) || 0,
        reorder_threshold: parseInt(payload.reorder_threshold, 10) || 10,
        category_id: payload.category_id || null,
      }

      if (editingProduct) {
        const { error } = await supabase.from('products').update(cleaned).eq('id', editingProduct.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert(cleaned)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success(editingProduct ? 'Product updated' : 'Product created')
      closeModal()
    },
    onError: (e) => toast.error(e.message || 'Failed to save product'),
  })

  const deleteProduct = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast.success('Product deactivated')
    },
    onError: (e) => toast.error(e.message || 'Failed to deactivate product'),
  })

  const openCreate = () => {
    setEditingProduct(null)
    setForm(EMPTY_PRODUCT)
    setFormErrors({})
    setImageFile(null)
    setImagePreview(null)
    setModalOpen(true)
  }

  const openEdit = (product) => {
    setEditingProduct(product)
    setForm({
      ...product,
      category_id: product.category_id ?? '',
      sale_price: product.sale_price ?? '',
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      reorder_threshold: String(product.reorder_threshold),
    })
    setFormErrors({})
    setImageFile(null)
    setImagePreview(product.image_url || null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProduct(null)
    setForm(EMPTY_PRODUCT)
    setFormErrors({})
    setImageFile(null)
    setImagePreview(null)
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setImageFile(file)

    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const validateForm = () => {
    const errors = {}
    const price = Number(form.price)
    const salePrice = form.sale_price === '' ? null : Number(form.sale_price)
    const stock = Number(form.stock_quantity)
    const reorderThreshold = Number(form.reorder_threshold)

    if (!form.name.trim()) errors.name = 'Product name is required'
    if (!form.price || Number.isNaN(price) || price <= 0) errors.price = 'Enter a price greater than 0'
    if (salePrice !== null && (Number.isNaN(salePrice) || salePrice < 0)) errors.sale_price = 'Enter a valid sale price'
    if (salePrice !== null && price > 0 && salePrice >= price) errors.sale_price = 'Sale price must be below the regular price'
    if (form.stock_quantity === '' || Number.isNaN(stock) || stock < 0) errors.stock_quantity = 'Enter a valid stock quantity'
    if (Number.isNaN(reorderThreshold) || reorderThreshold < 0) errors.reorder_threshold = 'Enter a valid reorder threshold'

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please fix the highlighted fields')
      return
    }

    try {
      let imageUrl = form.image_url

      if (imageFile) {
        imageUrl = await uploadImageToStorage(imageFile)
      }

      saveProduct.mutate({
        ...form,
        name: form.name.trim(),
        generic_name: form.generic_name.trim(),
        brand: form.brand.trim(),
        manufacturer: form.manufacturer.trim(),
        strength: form.strength.trim(),
        description: form.description.trim(),
        image_url: imageUrl,
      })
    } catch (error) {
      console.error('Submission error:', error)
      toast.error('Failed to process product')
    }
  }

  const f = (field) => ({
    value: form[field],
    onChange: e => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }))
    },
  })

  const resetFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setStockFilter('all')
  }

  const hasFilters = Boolean(search || categoryFilter !== 'all' || statusFilter !== 'all' || stockFilter !== 'all')

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Manage catalog details, pricing, stock, and prescription status.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="Total products" value={stats.total} />
        <StatTile label="Active catalog" value={stats.active} tone="green" />
        <StatTile label="Low stock" value={stats.lowStock} tone="amber" />
        <StatTile label="Prescription items" value={stats.prescription} tone="blue" />
      </div>

      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, brand, generic..."
              className="input pl-10"
            />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input">
            <option value="all">All categories</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex gap-2">
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="input">
              <option value="all">All stock</option>
              <option value="low">Low stock</option>
              <option value="ok">Stock OK</option>
            </select>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="btn-ghost btn-icon flex-shrink-0" title="Reset filters">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <Filter className="w-3.5 h-3.5" />
          Showing {filtered.length} of {productsWithCategories.length} products
        </div>
      </div>

      {isError ? (
        <EmptyState icon={AlertTriangle} title="Unable to load products" description={error?.message || 'Refresh the page and try again.'} />
      ) : isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={hasFilters ? 'Try changing or clearing the current filters.' : undefined}
          action={hasFilters
            ? <button onClick={resetFilters} className="btn-secondary btn-sm">Clear filters</button>
            : <button onClick={openCreate} className="btn-primary btn-sm">Add your first product</button>}
        />
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Product</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(product => {
                const lowStock = Number(product.stock_quantity) <= Number(product.reorder_threshold ?? 0)

                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {product.requires_prescription && <span className="badge-yellow text-xs">Rx</span>}
                            {lowStock && <span className="badge-red text-xs">Low stock</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.categories?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-800">
                      <div className="font-medium">GHS {Number(product.price).toFixed(2)}</div>
                      {product.sale_price && <div className="text-xs text-green-700">Sale GHS {Number(product.sale_price).toFixed(2)}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="font-medium text-gray-900">{product.stock_quantity}</div>
                      <div className="text-xs text-gray-400">Reorder at {product.reorder_threshold}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={product.is_active ? 'badge-green' : 'badge-gray'}>
                        {product.is_active ? <CheckCircle2 className="w-3 h-3" /> : null}
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(product)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Edit product">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {product.is_active && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Deactivate ${product.name}? It will no longer appear as active in the catalog.`)) {
                                deleteProduct.mutate(product.id)
                              }
                            }}
                            disabled={deleteProduct.isPending}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                            title="Deactivate product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editingProduct ? 'Edit Product' : 'Add New Product'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Product Name *</label>
              <input {...f('name')} className={`input ${formErrors.name ? 'input-error' : ''}`} placeholder="e.g. Amoxicillin 500mg" required />
              {formErrors.name && <p className="field-error">{formErrors.name}</p>}
            </div>
            <Field label="Generic Name"><input {...f('generic_name')} className="input" /></Field>
            <Field label="Brand"><input {...f('brand')} className="input" /></Field>
            <Field label="Category">
              <select {...f('category_id')} className="input">
                <option value="">Select category</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Dosage Form">
              <select {...f('dosage_form')} className="input">
                {DOSAGE_FORMS.map(dosage => <option key={dosage} value={dosage}>{dosage}</option>)}
              </select>
            </Field>
            <Field label="Strength"><input {...f('strength')} placeholder="e.g. 500mg" className="input" /></Field>
            <Field label="Manufacturer"><input {...f('manufacturer')} className="input" /></Field>
            <Field label="Price (GHS) *" error={formErrors.price}>
              <input {...f('price')} type="number" step="0.01" min="0" className={`input ${formErrors.price ? 'input-error' : ''}`} required />
            </Field>
            <Field label="Sale Price (optional)" error={formErrors.sale_price}>
              <input {...f('sale_price')} type="number" step="0.01" min="0" className={`input ${formErrors.sale_price ? 'input-error' : ''}`} />
            </Field>
            <Field label="Stock Quantity *" error={formErrors.stock_quantity}>
              <input {...f('stock_quantity')} type="number" min="0" className={`input ${formErrors.stock_quantity ? 'input-error' : ''}`} required />
            </Field>
            <Field label="Reorder Threshold" error={formErrors.reorder_threshold}>
              <input {...f('reorder_threshold')} type="number" min="0" className={`input ${formErrors.reorder_threshold ? 'input-error' : ''}`} />
            </Field>

            <div className="sm:col-span-2">
              <label className="label">Product Image</label>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={uploadingImage}
                    className="hidden"
                    id="image-input"
                  />
                  <label
                    htmlFor="image-input"
                    className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {uploadingImage ? 'Uploading...' : imageFile ? imageFile.name : 'Click to upload image'}
                    </span>
                  </label>
                </div>

                {imagePreview && (
                  <div className="relative w-32 h-32">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(editingProduct?.image_url || null)
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      title="Remove selected image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea {...f('description')} rows={3} className="input resize-none" />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requires_prescription}
                  onChange={e => setForm(prev => ({ ...prev, requires_prescription: e.target.checked }))}
                  className="rounded text-brand-600"
                />
                <span className="text-sm text-gray-700">Requires prescription</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saveProduct.isPending || uploadingImage} className="btn-primary flex-1">
              {saveProduct.isPending ? 'Saving...' : uploadingImage ? 'Uploading image...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Field({ children, error, label }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

function StatTile({ label, value, tone = 'gray' }) {
  const tones = {
    amber: 'text-amber-700',
    blue: 'text-blue-700',
    gray: 'text-gray-900',
    green: 'text-green-700',
  }

  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  )
}
