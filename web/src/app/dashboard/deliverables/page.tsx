'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DeliverableCard } from '@/components/deliverables/DeliverableCard'
import { StatusBar } from '@/components/deliverables/StatusBar'
import { DeliverableFilter } from '@/components/deliverables/DeliverableFilter'

export type DeliverableStatus = 'pending' | 'approved' | 'posted'

export type DeliverableType =
  | 'airbnb_title'
  | 'airbnb_description'
  | 'instagram_caption'
  | 'review_response'
  | 'guest_message'
  | 'seo_content'

export interface Deliverable {
  id: string
  user_id: string
  property_id?: string
  type: DeliverableType
  status: DeliverableStatus
  title: string
  content: Record<string, string>
  metadata: Record<string, unknown>
  created_at: string
  approved_at?: string
  posted_at?: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Seed data for demo/development when no real deliverables exist
const DEMO_DELIVERABLES: Deliverable[] = [
  {
    id: 'demo-1',
    user_id: 'demo',
    type: 'airbnb_title',
    status: 'pending',
    title: 'Airbnb Listing Title',
    content: {
      title: 'Sunny Beachfront Studio · Steps to Sand & Surf',
    },
    metadata: { property_name: 'Ocean View Studio', generated_at: new Date().toISOString() },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    user_id: 'demo',
    type: 'airbnb_description',
    status: 'pending',
    title: 'Airbnb Listing Description',
    content: {
      description: `Wake up to ocean waves from your private balcony in this beautifully designed studio retreat. Just steps from the sand, this light-filled space sleeps two comfortably with a king bed, premium linens, and a fully equipped kitchen stocked with local coffee and snacks for your arrival.

Spend your days exploring the coastal trail that starts right outside the door, or simply unwind on the rooftop terrace at golden hour. Fast WiFi and a dedicated workspace mean remote workers are welcome too.

THE SPACE
• King bed with hotel-quality linens
• Private balcony with ocean views
• Full kitchen with dishwasher
• Rainfall shower with spa amenities
• Smart TV with streaming apps

THE NEIGHBORHOOD
Walking distance to three top-rated restaurants, a local farmer's market (Saturdays), and a surf rental shop. Parking included.`,
    },
    metadata: { property_name: 'Ocean View Studio', generated_at: new Date().toISOString() },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-3',
    user_id: 'demo',
    type: 'instagram_caption',
    status: 'approved',
    title: 'Instagram Post — Weekend Vibes',
    content: {
      caption: `That golden hour hits different when you're 50 feet from the water. ✨

Our guests spent the weekend unplugging, exploring, and remembering what rest actually feels like. This is exactly why we do what we do.

Whether you're planning a romantic escape or a solo reset, we'd love to host you. Link in bio to check availability for summer.`,
      hashtags: `#BeachfrontRental #CoastalLiving #VacationRental #AirbnbSuperhost #BeachHouse #OceanView #TravelGram #STRLife #VacationHome #BeachLife #GetawayGoals #ShortTermRental #VacationVibes #CoastalRetreat #SummerTravel`,
    },
    metadata: {
      property_name: 'Ocean View Studio',
      image_prompt: 'Golden hour balcony view with ocean in background, lifestyle photography',
      generated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    approved_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-4',
    user_id: 'demo',
    type: 'review_response',
    status: 'pending',
    title: 'Review Response — Sarah M.',
    content: {
      response: `Thank you so much, Sarah! We're so glad the balcony view lived up to the hype — it's our favorite spot too, especially at sunset. You were wonderful guests and we hope the coastal walks gave you exactly the reset you were looking for. We'd love to host you again anytime. Safe travels! 🌊`,
    },
    metadata: {
      reviewer_name: 'Sarah M.',
      review_rating: 5,
      review_text: 'Absolutely stunning views and the host thought of everything. The balcony was our favorite spot every morning with coffee. Highly recommend!',
      generated_at: new Date().toISOString(),
    },
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-5',
    user_id: 'demo',
    type: 'instagram_caption',
    status: 'posted',
    title: 'Instagram Post — New Season',
    content: {
      caption: `Spring is here and so is our freshly updated space. New artwork, new outdoor furniture, same incredible ocean view. 🌿

We've been getting your DMs about summer availability — it's filling fast! A few prime weekends left in July. Link in bio to snag yours before they're gone.

What's on your summer travel wishlist? Drop it below 👇`,
      hashtags: `#SpringTravel #BeachRental #VacationRental #Airbnb #CoastalHome #BeachHouse #TravelInspiration #STROwner #VacationHome #OceanView #SummerTravel #BeachLife #ShortTermRental #AirbnbHost #TravelGoals`,
    },
    metadata: {
      property_name: 'Ocean View Studio',
      generated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    approved_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    posted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-6',
    user_id: 'demo',
    type: 'guest_message',
    status: 'pending',
    title: 'Check-in Message Template',
    content: {
      message: `Hi {guest_name}! 👋

So excited to welcome you to the Ocean View Studio! Here's everything you need for a smooth arrival:

🔑 CHECK-IN
• Door code: {door_code}
• Check-in after 3pm
• Self check-in — no need to wait for me

📍 GETTING HERE
{property_address}
Free parking in the driveway (fits 2 cars)

🏠 QUICK START
• WiFi: OceanBreeze_Guest | Password: {wifi_password}
• AC/heat remote is on the nightstand
• Beach towels are in the hall closet
• Coffee + snacks on the kitchen counter for you

📞 ANY QUESTIONS?
Text me anytime — I usually reply within 20 minutes.

Can't wait for you to see that view! 🌊`,
    },
    metadata: {
      template_type: 'check_in',
      property_name: 'Ocean View Studio',
      generated_at: new Date().toISOString(),
    },
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
]

export default function DeliverablesPage() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DeliverableStatus | 'all'>('all')
  const [isDemo, setIsDemo] = useState(false)

  const fetchDeliverables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('deliverables')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        // Table might not exist yet or no auth — use demo data
        console.info('Using demo deliverables:', error.message)
        setDeliverables(DEMO_DELIVERABLES)
        setIsDemo(true)
      } else if (!data || data.length === 0) {
        setDeliverables(DEMO_DELIVERABLES)
        setIsDemo(true)
      } else {
        setDeliverables(data)
        setIsDemo(false)
      }
    } catch {
      setDeliverables(DEMO_DELIVERABLES)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeliverables()
  }, [fetchDeliverables])

  const handleStatusUpdate = useCallback(
    async (id: string, newStatus: DeliverableStatus) => {
      // Optimistic update
      setDeliverables((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: newStatus,
                approved_at:
                  newStatus === 'approved' && !d.approved_at
                    ? new Date().toISOString()
                    : d.approved_at,
                posted_at:
                  newStatus === 'posted' ? new Date().toISOString() : d.posted_at,
              }
            : d
        )
      )

      if (isDemo) return // Don't hit Supabase in demo mode

      const updates: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'approved') updates.approved_at = new Date().toISOString()
      if (newStatus === 'posted') updates.posted_at = new Date().toISOString()

      const { error } = await supabase
        .from('deliverables')
        .update(updates)
        .eq('id', id)

      if (error) {
        console.error('Failed to update status:', error)
        // Revert on failure
        fetchDeliverables()
      }
    },
    [isDemo, fetchDeliverables]
  )

  const counts = {
    pending: deliverables.filter((d) => d.status === 'pending').length,
    approved: deliverables.filter((d) => d.status === 'approved').length,
    posted: deliverables.filter((d) => d.status === 'posted').length,
  }

  const filtered =
    filter === 'all' ? deliverables : deliverables.filter((d) => d.status === filter)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading your deliverables…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">Deliverables</h1>
            {isDemo && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-medium">
                Demo
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">
            Ready-to-post content from your AI marketing team. Copy and paste directly into each platform.
          </p>
        </div>

        {/* Status bar */}
        <StatusBar counts={counts} />

        {/* Filter tabs */}
        <DeliverableFilter filter={filter} onChange={setFilter} counts={counts} total={deliverables.length} />

        {/* Deliverable cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-white font-medium mb-1">
              {filter === 'posted'
                ? "Nothing posted yet"
                : filter === 'approved'
                ? "Nothing approved yet"
                : "All caught up!"}
            </p>
            <p className="text-slate-500 text-sm">
              {filter === 'all'
                ? "Your AI team is working on new content."
                : `Switch to "All" to see other deliverables.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((deliverable) => (
              <DeliverableCard
                key={deliverable.id}
                deliverable={deliverable}
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
