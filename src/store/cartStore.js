import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      deliveryFee: 10.00,

      addItem: (product, quantity = 1) => {
        const { items } = get()
        const existing = items.find(i => i.id === product.id)
        if (existing) {
          const newQty = Math.min(existing.quantity + quantity, product.stock_quantity)
          set({ items: items.map(i => i.id === product.id ? { ...i, quantity: newQty } : i) })
        } else {
          set({ items: [...items, { ...product, quantity }] })
        }
      },

      removeItem: (productId) => set({ items: get().items.filter(i => i.id !== productId) }),

      updateQuantity: (productId, quantity) => {
        if (quantity < 1) { get().removeItem(productId); return }
        set({ items: get().items.map(i => i.id === productId ? { ...i, quantity } : i) })
      },

      clearCart: () => set({ items: [], coupon: null }),

      setCoupon: (coupon) => set({ coupon }),
      removeCoupon: () => set({ coupon: null }),

      // Computed
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + (i.sale_price ?? i.price) * i.quantity, 0),
      discount: () => {
        const { coupon, subtotal } = get()
        if (!coupon) return 0
        const sub = subtotal()
        if (sub < (coupon.min_order_amount ?? 0)) return 0
        return coupon.discount_type === 'percentage'
          ? (sub * coupon.discount_value) / 100
          : Math.min(coupon.discount_value, sub)
      },
      total: () => {
        const { subtotal, discount, deliveryFee } = get()
        return Math.max(subtotal() - discount() + deliveryFee, 0)
      },
      hasRxItem: () => get().items.some(i => i.requires_prescription),
    }),
    {
      name: 'pharmaplus-cart',
      partialize: (state) => ({ items: state.items, coupon: state.coupon }),
    }
  )
)
