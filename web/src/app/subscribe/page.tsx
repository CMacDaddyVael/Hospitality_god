import Link from 'next/link'
import ResubscribePrompt from '@/components/subscription/ResubscribePrompt'

export const metadata = {
  title: 'Subscribe — VAEL Host',
  description: 'Unlock your AI CMO dashboard with a Pro subscription.',
}

export default function SubscribePage({
  searchParams,
}: {
  searchParams: { reason?: string }
}) {
  const isLapsed = searchParams.reason === 'subscription_required'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <ResubscribePrompt isLapsed={isLapsed} />
      </div>
    </div>
  )
}
