import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { User, Phone, Mail, Save, ShoppingBag, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/LoadingScreen'

export default function AccountPage() {
  const { profile, user, fetchProfile } = useAuthStore()
  const [form, setForm] = useState({ full_name: profile?.full_name || '', phone: profile?.phone || '' })
  const [saving, setSaving] = useState(false)

  const { data: orderStats } = useQuery({
    queryKey: ['order-stats', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, status, total_amount')
        .eq('customer_id', user.id)
      const total = data?.length ?? 0
      const delivered = data?.filter(o => o.status === 'delivered').length ?? 0
      const spent = data?.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0) ?? 0
      return { total, delivered, spent }
    },
    enabled: !!user?.id,
  })

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name, phone: form.phone })
      .eq('id', user.id)
    if (error) toast.error('Failed to update profile')
    else {
      await fetchProfile(user.id)
      toast.success('Profile updated')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="page-title mb-6">My Account</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Orders', value: orderStats?.total ?? '—', icon: ShoppingBag, color: 'text-brand-600 bg-brand-50' },
          { label: 'Delivered', value: orderStats?.delivered ?? '—', icon: ShoppingBag, color: 'text-green-600 bg-green-50' },
          { label: 'Total Spent', value: orderStats ? `GHS ${orderStats.spent.toFixed(0)}` : '—', icon: FileText, color: 'text-purple-600 bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Profile form */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-brand-600" /> Profile Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="input"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="label">Email Address</label>
            <div className="flex items-center gap-2 input bg-gray-50 cursor-not-allowed">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500 text-sm">{user?.email}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="label">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="input pl-10"
                placeholder="024XXXXXXX"
              />
            </div>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary mt-5">
          {saving ? <Spinner size="sm" /> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Link to="/account/orders" className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">My Orders</p>
            <p className="text-xs text-gray-400">Track & reorder</p>
          </div>
        </Link>
        <Link to="/account/prescriptions" className="card p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Prescriptions</p>
            <p className="text-xs text-gray-400">View & manage</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
