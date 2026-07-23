import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Pill, Eye, EyeOff } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Spinner } from '@/components/ui/LoadingScreen'

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { fetchProfile } = useAuthStore()
  const redirect = searchParams.get('redirect') || '/'

  const validate = () => {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (mode === 'signup' && !form.full_name) e.full_name = 'Full name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (error) throw error
        await fetchProfile(data.user.id)
        toast.success('Welcome back!')
        navigate(redirect, { replace: true })
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.full_name, phone: form.phone },
          },
        })
        if (error) throw error
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: form.full_name,
            phone: form.phone,
            role: 'customer',
          })
          await fetchProfile(data.user.id)
          toast.success('Account created! Welcome to PharmaPlus.')
          navigate(redirect, { replace: true })
        }
      }
    } catch (err) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirect}` },
    })
  }

  const f = (field) => ({
    value: form[field],
    onChange: e => { setForm(p => ({ ...p, [field]: e.target.value })); setErrors(p => ({ ...p, [field]: '' })) },
  })

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Pill className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === 'signin' ? 'Sign in to your PharmaPlus account' : 'Join thousands of healthy Ghanaians'}
          </p>
        </div>

        <div className="card p-7">
          {/* Google OAuth */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-5"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
              <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
              <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
              <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative text-center"><span className="bg-white px-3 text-xs text-gray-400">or with email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <input {...f('full_name')} placeholder="Kwame Asante" className={`input ${errors.full_name ? 'input-error' : ''}`} />
                {errors.full_name && <p className="field-error">{errors.full_name}</p>}
              </div>
            )}
            <div>
              <label className="label">Email Address</label>
              <input {...f('email')} type="email" placeholder="you@example.com" className={`input ${errors.email ? 'input-error' : ''}`} />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>
            {mode === 'signup' && (
              <div>
                <label className="label">Phone (optional)</label>
                <input {...f('phone')} type="tel" placeholder="024XXXXXXX" className="input" />
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="label mb-0">Password</label>
                {mode === 'signin' && (
                  <button type="button" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Forgot password?</button>
                )}
              </div>
              <div className="relative">
                <input
                  {...f('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg mt-2">
              {loading ? <Spinner size="sm" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setErrors({}) }} className="text-brand-600 font-medium hover:text-brand-700">
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
