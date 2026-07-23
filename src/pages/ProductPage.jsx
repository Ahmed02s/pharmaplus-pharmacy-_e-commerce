import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Lock,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Star,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { Spinner } from '@/components/ui/LoadingScreen'

export default function ProductPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { user, profile } = useAuthStore()
  const { addItem, items } = useCartStore()
  const [quantity, setQuantity] = useState(1)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name, slug)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['product-reviews', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, rating, comment, customer_id, created_at')
        .eq('product_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const existingReview = useMemo(
    () => reviews.find(review => review.customer_id === user?.id),
    [reviews, user?.id]
  )

  const reviewStats = useMemo(() => {
    const total = reviews.length
    const average = total
      ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / total
      : 0

    return { average, total }
  }, [reviews])

  const saveReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in to leave a review')
      if (profile?.role !== 'customer') throw new Error('Only customers can review products')

      const payload = {
        product_id: id,
        customer_id: user.id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      }

      const { error } = await supabase
        .from('product_reviews')
        .upsert(payload, { onConflict: 'product_id,customer_id' })

      if (error) throw error
    },
    onSuccess: () => {
      toast.success(existingReview ? 'Review updated' : 'Review added')
      setReviewComment('')
      setReviewRating(5)
      qc.invalidateQueries({ queryKey: ['product-reviews', id] })
    },
    onError: (error) => toast.error(error.message || 'Could not save review'),
  })

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>
  if (!product) return <div className="page-container py-12 text-center text-gray-500">Product not found.</div>

  const cartItem = items.find(item => item.id === product.id)
  const price = product.sale_price ?? product.price
  const inStock = product.stock_quantity > 0

  const handleAddToCart = () => {
    addItem(product, quantity)
    toast.success(`${product.name} added to cart`)
  }

  const startEditReview = () => {
    if (!existingReview) return
    setReviewRating(existingReview.rating)
    setReviewComment(existingReview.comment || '')
    document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="page-container py-8">
      <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to shop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="aspect-square bg-gray-50 rounded-3xl overflow-hidden relative">
          <img
            src={product.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {product.sale_price && (
            <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              SALE - Save GHS {(product.price - product.sale_price).toFixed(2)}
            </div>
          )}
        </div>

        <div>
          {product.categories && (
            <Link to={`/shop?category=${product.categories.slug}`} className="text-sm text-brand-600 font-medium hover:text-brand-700">
              {product.categories.name}
            </Link>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 mb-1">{product.name}</h1>
          <RatingSummary average={reviewStats.average} total={reviewStats.total} />
          {product.generic_name && <p className="text-gray-500 text-sm mb-1">Generic: <span className="italic">{product.generic_name}</span></p>}
          {product.brand && <p className="text-gray-500 text-sm mb-4">Brand: <span className="font-medium">{product.brand}</span></p>}

          <div className="flex flex-wrap gap-2 mb-4">
            {product.dosage_form && <span className="badge badge-blue capitalize">{product.dosage_form}</span>}
            {product.strength && <span className="badge badge-gray">{product.strength}</span>}
            {product.requires_prescription
              ? <span className="badge badge-yellow"><Lock className="w-3 h-3" /> Prescription required</span>
              : <span className="badge badge-green"><CheckCircle className="w-3 h-3" /> Over the counter</span>}
          </div>

          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-3xl font-bold text-gray-900">GHS {price.toFixed(2)}</span>
            {product.sale_price && <span className="text-lg text-gray-400 line-through">GHS {product.price.toFixed(2)}</span>}
          </div>

          <div className={`flex items-center gap-2 text-sm mb-6 ${inStock ? 'text-green-600' : 'text-red-600'}`}>
            <Package className="w-4 h-4" />
            {inStock ? `In stock (${product.stock_quantity} units available)` : 'Out of stock'}
          </div>

          {product.requires_prescription && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Prescription Required</p>
                <p className="text-xs text-amber-700 mt-0.5">You'll be prompted to upload your prescription at checkout. Our pharmacist will verify it before dispensing.</p>
              </div>
            </div>
          )}

          {inStock && (
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-1">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button onClick={handleAddToCart} className="btn-primary flex-1 btn-lg">
                <ShoppingCart className="w-5 h-5" />
                {cartItem ? `Update Cart (${cartItem.quantity + quantity})` : 'Add to Cart'}
              </button>
            </div>
          )}

          {product.description && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">About this medicine</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          <div className="mt-6 space-y-2">
            {[
              ['Manufacturer', product.manufacturer],
              ['Storage', product.storage_instructions],
              ['Expiry', product.expiry_date],
              ['Side Effects', product.side_effects],
            ].filter(([, value]) => value).map(([label, value]) => (
              <div key={label} className="flex gap-3 text-sm py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
                <span className="text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="review-form" className="card p-5 h-fit">
          <h2 className="font-semibold text-gray-900 mb-2">Customer Review</h2>
          {!user ? (
            <p className="text-sm text-gray-500">Sign in as a customer to leave a review.</p>
          ) : profile?.role !== 'customer' ? (
            <p className="text-sm text-gray-500">Only customer accounts can review products.</p>
          ) : (
            <form
              onSubmit={event => {
                event.preventDefault()
                saveReview.mutate()
              }}
              className="space-y-4"
            >
              {existingReview && (
                <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
                  You already reviewed this product. Submitting again will update it.
                </p>
              )}
              <div>
                <label className="label">Rating</label>
                <StarPicker value={reviewRating} onChange={setReviewRating} />
              </div>
              <div>
                <label className="label">Comment</label>
                <textarea
                  value={reviewComment}
                  onChange={event => setReviewComment(event.target.value)}
                  rows={4}
                  maxLength={500}
                  className="input resize-none"
                  placeholder="Share what you liked about this product..."
                />
                <p className="text-xs text-gray-400 mt-1">{reviewComment.length}/500</p>
              </div>
              <button type="submit" disabled={saveReview.isPending} className="btn-primary w-full">
                {saveReview.isPending ? <><Spinner size="sm" /> Saving...</> : existingReview ? 'Update Review' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">Reviews</h2>
              <p className="text-sm text-gray-500">{reviewStats.total} review{reviewStats.total === 1 ? '' : 's'} for this product</p>
            </div>
            {existingReview && (
              <button onClick={startEditReview} className="btn-secondary btn-sm">Edit mine</button>
            )}
          </div>

          {reviewsLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-medium text-gray-700">No reviews yet</p>
              <p className="text-sm text-gray-400">Be the first customer to review this medicine.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <ReviewItem key={review.id} review={review} currentUserId={user?.id} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function RatingSummary({ average, total }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Stars value={Math.round(average)} />
      <span className="text-sm font-medium text-gray-800">{total ? average.toFixed(1) : 'No ratings yet'}</span>
      {total > 0 && <span className="text-sm text-gray-400">({total})</span>}
    </div>
  )
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(rating => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className="p-1 rounded-lg hover:bg-amber-50"
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
        >
          <Star className={`w-6 h-6 ${rating <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
      <span className="text-sm text-gray-500 ml-2">{value}/5</span>
    </div>
  )
}

function Stars({ value }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(rating => (
        <Star key={rating} className={`w-4 h-4 ${rating <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  )
}

function ReviewItem({ review, currentUserId }) {
  const name = review.profiles?.full_name || 'Customer'
  const date = new Date(review.created_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 text-sm">{name}</p>
            {review.customer_id === currentUserId && <span className="badge-blue text-xs">You</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Stars value={review.rating} />
            <span className="text-xs text-gray-400">{date}</span>
          </div>
        </div>
      </div>
      {review.comment && <p className="text-sm text-gray-600 leading-relaxed mt-3">{review.comment}</p>}
    </div>
  )
}
