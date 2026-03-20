'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../lib/supabase/client'

type AuthModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Called with the authenticated user after successful sign-in / sign-up */
  onAuthSuccess: (userId: string, email: string) => void
  /** Pre-fill the email field (e.g. from audit form) */
  defaultEmail?: string
  /** Context shown above the form */
  headline?: string
  subheadline?: string
}

type AuthMode = 'magic_link' | 'magic_link_sent' | 'google'

export function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultEmail = '',
  headline = 'Create your free account',
  subheadline = 'See your full audit results and unlock your personalized action plan.',
}: AuthModalProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [mode, setMode] = useState<AuthMode>('magic_link')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  // Update email if parent changes defaultEmail
  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail)
  }, [defaultEmail])

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen && mode === 'magic_link') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, mode])

  // Listen for PKCE auth state changes (magic link clicked in another tab)
  useEffect(() => {
    if (!isOpen) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        onAuthSuccess(session.user.id, session.user.email ?? '')
        onClose()
      }
    })

    return () => subscription.unsubscribe()
  }, [isOpen, supabase, onAuthSuccess, onClose])

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setIsLoading(true)
    try {
      // Build the redirect URL — go back to current page after auth
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
          : `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      setMode('magic_link_sent')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleOAuth = async () => {
    setError('')
    setIsLoading(true)
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
          : `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (authError) {
        setError(authError.message)
        setIsLoading(false)
      }
      // If no error, browser will redirect — keep loading state
    } catch (err) {
      setError('Google sign-in failed. Please try again.')
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 mb-4">
              <span className="text-2xl">🔓</span>
            </div>
            <h2 id="auth-modal-title" className="text-xl font-bold text-white">
              {headline}
            </h2>
            <p className="text-slate-400 text-sm mt-1">{subheadline}</p>
          </div>

          {mode === 'magic_link_sent' ? (
            <MagicLinkSentState email={email} onTryAgain={() => setMode('magic_link')} />
          ) : (
            <>
              {/* Google OAuth button */}
              <button
                onClick={handleGoogleOAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-800 font-medium rounded-xl transition-colors mb-4"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-slate-500 text-xs">or</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              {/* Magic link form */}
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div>
                  <label htmlFor="auth-email" className="block text-sm font-medium text-slate-300 mb-1">
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    ref={inputRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError('')
                    }}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-sm"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold rounded-xl transition-colors text-sm"
                >
                  {isLoading ? 'Sending link…' : 'Send magic link'}
                </button>
              </form>

              <p className="text-center text-slate-500 text-xs mt-4">
                No password needed. We'll email you a one-click sign-in link.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MagicLinkSentState({
  email,
  onTryAgain,
}: {
  email: string
  onTryAgain: () => void
}) {
  return (
    <div className="text-center space-y-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20">
        <span className="text-3xl">✉️</span>
      </div>
      <div>
        <p className="text-white font-semibold">Check your inbox</p>
        <p className="text-slate-400 text-sm mt-1">
          We sent a magic link to{' '}
          <span className="text-amber-400 font-medium">{email}</span>.
          Click the link in that email to sign in.
        </p>
      </div>
      <p className="text-slate-500 text-xs">
        Didn't receive it?{' '}
        <button
          onClick={onTryAgain}
          className="text-amber-400 hover:text-amber-300 underline transition-colors"
        >
          Try a different email
        </button>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
