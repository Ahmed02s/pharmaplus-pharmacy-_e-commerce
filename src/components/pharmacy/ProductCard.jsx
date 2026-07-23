import { Link } from 'react-router-dom'
import { Lock, Minus, Plus, ShoppingCart, Star } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { toast } from 'react-hot-toast'

export default function ProductCard({ product }) {
  const { addItem, items, updateQuantity, removeItem } = useCartStore()
  const cartItem = items.find(item => item.id === product.id)
  const price = product.sale_price ?? product.price
  const inStock = product.stock_quantity > 0
  const averageRating = Number(product.average_rating || 0)
  const reviewCount = Number(product.review_count || 0)

  const handleAddToCart = (event) => {
    event.preventDefault()
    if (!inStock) return
    addItem(product)
    toast.success(`${product.name} added to cart`)
  }

  return (
    <Link to={`/shop/${product.id}`} className="card-hover block overflow-hidden group">
      <div className="relative h-44 bg-gray-50 overflow-hidden">
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.requires_prescription && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
            <Lock className="w-3 h-3" /> Rx
          </div>
        )}
        {product.sale_price && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            SALE
          </div>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-500">Out of Stock</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-brand-600 font-medium mb-1">{product.brand || product.manufacturer}</p>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-0.5 line-clamp-2">{product.name}</h3>
        {product.strength && <p className="text-xs text-gray-400 mb-2">{product.strength} - {product.dosage_form}</p>}
        <div className="flex items-center gap-1.5 min-h-5">
          <Star className={`w-3.5 h-3.5 ${reviewCount ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          <span className="text-xs font-medium text-gray-700">{reviewCount ? averageRating.toFixed(1) : 'No ratings'}</span>
          {reviewCount > 0 && <span className="text-xs text-gray-400">({reviewCount})</span>}
        </div>

        <div className="flex items-center justify-between mt-3 gap-3">
          <div className="min-w-0">
            <span className="text-lg font-bold text-gray-900">GHS {price.toFixed(2)}</span>
            {product.sale_price && (
              <span className="text-xs text-gray-400 line-through ml-1.5">GHS {product.price.toFixed(2)}</span>
            )}
          </div>

          {!cartItem ? (
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Add
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0" onClick={event => event.preventDefault()}>
              <button
                onClick={() => cartItem.quantity === 1 ? removeItem(product.id) : updateQuantity(product.id, cartItem.quantity - 1)}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm font-semibold w-4 text-center">{cartItem.quantity}</span>
              <button
                onClick={() => updateQuantity(product.id, Math.min(cartItem.quantity + 1, product.stock_quantity))}
                className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
