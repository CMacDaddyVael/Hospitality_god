import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If logged in, go to dashboard; otherwise show landing/login
  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
