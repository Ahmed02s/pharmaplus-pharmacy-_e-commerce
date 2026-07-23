import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Minus, AlertTriangle, Package } from 'lucide-react'
import { Spinner, EmptyState, Modal } from '@/components/ui/LoadingScreen'
import { toast } from 'react-hot-toast'

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const qc = useQueryClient()

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('stock_quantity', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const updateStock = useMutation({
    mutationFn: async ({ id, quantity }) => {
      const { error } = await supabase.from('products').update({ stock_quantity: quantity }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-products'] })
      qc.invalidateQueries({ queryKey: ['pharmacist-stats'] })
      toast.success('Stock updated')
      setSelected(null)
      setAdjustAmount('')
    },
    onError: () => toast.error('Failed to update stock'),
  })

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.generic_name?.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockCount = products.filter(p => p.stock_quantity <= p.reorder_threshold).length

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="page-title">Inventory</h1>
        {lowStockCount > 0 && (
          <span className="badge-red flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} low on stock
          </span>
        )}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicines..." className="input pl-10" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No products found" />
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Product</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Threshold</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Price</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const low = p.stock_quantity <= p.reorder_threshold
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${low ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.strength}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.categories?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${low ? 'text-red-600' : 'text-gray-800'}`}>{p.stock_quantity}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.reorder_threshold}</td>
                    <td className="px-4 py-3 text-gray-700">GHS {Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setSelected(p); setAdjustAmount('') }} className="text-brand-600 text-xs font-medium hover:text-brand-700">
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Adjust Stock" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={selected.image_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{selected.name}</p>
                <p className="text-xs text-gray-400">Current stock: {selected.stock_quantity}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateStock.mutate({ id: selected.id, quantity: Math.max(0, selected.stock_quantity - 10) })}
                className="btn-secondary btn-sm"
              >
                <Minus className="w-3.5 h-3.5" /> -10
              </button>
              <button
                onClick={() => updateStock.mutate({ id: selected.id, quantity: selected.stock_quantity + 10 })}
                className="btn-secondary btn-sm"
              >
                <Plus className="w-3.5 h-3.5" /> +10
              </button>
            </div>

            <div>
              <label className="label">Set exact quantity</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder={String(selected.stock_quantity)}
                  className="input"
                />
                <button
                  onClick={() => adjustAmount !== '' && updateStock.mutate({ id: selected.id, quantity: parseInt(adjustAmount) })}
                  disabled={adjustAmount === '' || updateStock.isPending}
                  className="btn-primary flex-shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
