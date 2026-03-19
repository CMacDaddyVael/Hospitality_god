import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Create Account',
}

// Signup uses the same magic link flow as login — Supabase handles new vs existing
export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-white">Create your account</h2>
        <p className="mt-2 text-slate-400 text-sm">
          Enter your email and we&apos;ll send you a magic link to get started.
        </p>
      </div>
      <LoginForm isSignup />
    </div>
  )
}
