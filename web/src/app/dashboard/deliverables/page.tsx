import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Redirect to main dashboard — deliverables are now part of the shell
export default async function DeliverablesPage() {
  redirect('/dashboard')
}
