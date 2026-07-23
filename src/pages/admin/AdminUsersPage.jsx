import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Search, Users, Shield } from 'lucide-react'
import { Spinner, EmptyState, Modal } from '@/components/ui/LoadingScreen'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

const ROLE_COLORS = { customer: 'badge-blue', pharmacist: 'badge-purple', admin: 'badge-green' }

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const qc = useQueryClient()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Role updated')
      setSelected(null)
    },
    onError: () => toast.error('Failed to update role'),
  })

  const filtered = users.filter(u => {
    const matchesSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div>
      <h1 className="page-title mb-5">Users</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input pl-10" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'customer', 'pharmacist', 'admin'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium capitalize transition-colors ${roleFilter === r ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {u.full_name?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                      <p className="font-medium text-gray-900">{u.full_name ?? 'Unnamed'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.phone ?? '—'}</td>
                  <td className="px-4 py-3"><span className={ROLE_COLORS[u.role]}>{u.role}</span></td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(u.created_at), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(u)} className="text-brand-600 text-xs font-medium hover:text-brand-700 flex items-center gap-1 ml-auto">
                      <Shield className="w-3.5 h-3.5" /> Change Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Change User Role" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold">
                {selected.full_name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div>
                <p className="font-medium text-gray-900">{selected.full_name}</p>
                <p className="text-xs text-gray-400">Current role: <span className="capitalize">{selected.role}</span></p>
              </div>
            </div>
            <div className="space-y-2">
              {['customer', 'pharmacist', 'admin'].map(role => (
                <button
                  key={role}
                  onClick={() => updateRole.mutate({ id: selected.id, role })}
                  disabled={updateRole.isPending || selected.role === role}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between ${selected.role === role ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="capitalize font-medium text-gray-800">{role}</span>
                  {selected.role === role && <span className="text-xs text-brand-600 font-medium">Current</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
