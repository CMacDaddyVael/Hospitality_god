import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; message?: string; error?: string }
}) {
  return (
    <LoginForm
      redirectTo={searchParams.redirectTo}
      message={searchParams.message}
      error={searchParams.error}
    />
  )
}
