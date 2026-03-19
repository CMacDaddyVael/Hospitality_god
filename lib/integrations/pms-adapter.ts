/**
 * Unified PMS Adapter Interface
 * All PMS integrations implement this interface so the rest of the app
 * can work with any PMS without knowing which one is connected.
 */

export type PMSProvider = 'hostaway' | 'guesty' | 'hospitable'

export interface PMSListing {
  id: string
  externalId: string // ID on the platform (Airbnb listing ID, etc.)
  name: string
  description: string
  address: string
  city: string
  state: string
  country: string
  latitude?: number
  longitude?: number
  bedrooms: number
  bathrooms: number
  maxGuests: number
  amenities: string[]
  photos: { url: string; caption?: string }[]
  pricePerNight: number
  currency: string
  platform: string // 'airbnb', 'vrbo', etc.
  status: 'active' | 'inactive' | 'pending'
  raw?: Record<string, unknown> // raw API response for debugging
}

export interface PMSReview {
  id: string
  listingId: string
  guestName: string
  rating: number // 1-5
  text: string
  date: string // ISO string
  replied: boolean
  replyText?: string
  platform: string
  raw?: Record<string, unknown>
}

export interface PMSMessage {
  id: string
  reservationId: string
  listingId?: string
  guestName: string
  guestEmail?: string
  direction: 'inbound' | 'outbound'
  text: string
  sentAt: string // ISO string
  platform: string
  raw?: Record<string, unknown>
}

export interface PMSReservation {
  id: string
  listingId: string
  guestName: string
  guestEmail?: string
  guestPhone?: string
  checkIn: string // ISO date string
  checkOut: string // ISO date string
  guests: number
  totalAmount: number
  currency: string
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed'
  platform: string
  bookedAt: string
  raw?: Record<string, unknown>
}

export interface PMSCalendarDay {
  date: string // YYYY-MM-DD
  listingId: string
  available: boolean
  price?: number
  currency?: string
  minimumStay?: number
  reservationId?: string
}

export interface PMSWebhookEvent {
  provider: PMSProvider
  eventType:
    | 'reservation.created'
    | 'reservation.updated'
    | 'reservation.cancelled'
    | 'review.created'
    | 'message.received'
    | 'listing.updated'
    | 'calendar.updated'
  payload: Record<string, unknown>
  receivedAt: string
}

export interface PMSOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface PMSTokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt?: number // unix timestamp ms
  scope?: string
}

export interface PMSConnectionStatus {
  connected: boolean
  provider: PMSProvider
  accountName?: string
  listingCount?: number
  lastSyncAt?: string
  error?: string
}

/**
 * Every PMS adapter must implement this interface.
 */
export interface PMSAdapter {
  provider: PMSProvider

  /** Test that the current tokens are valid */
  testConnection(): Promise<PMSConnectionStatus>

  /** Fetch all listings for the connected account */
  getListings(): Promise<PMSListing[]>

  /** Fetch a single listing by PMS listing ID */
  getListing(listingId: string): Promise<PMSListing>

  /** Fetch reviews for a listing (or all listings if omitted) */
  getReviews(listingId?: string, limit?: number): Promise<PMSReview[]>

  /** Fetch messages for a reservation */
  getMessages(reservationId: string): Promise<PMSMessage[]>

  /** Fetch all recent reservations */
  getReservations(options?: {
    listingId?: string
    status?: PMSReservation['status']
    fromDate?: string
    toDate?: string
    limit?: number
  }): Promise<PMSReservation[]>

  /** Fetch calendar availability */
  getCalendar(listingId: string, fromDate: string, toDate: string): Promise<PMSCalendarDay[]>

  /** Send a reply to a review (if supported by PMS) */
  replyToReview?(reviewId: string, text: string): Promise<void>

  /** Send a message to a guest */
  sendMessage?(reservationId: string, text: string): Promise<void>
}

/**
 * Factory — given a provider name + token set, return the right adapter.
 */
export async function createPMSAdapter(
  provider: PMSProvider,
  tokens: PMSTokenSet
): Promise<PMSAdapter> {
  switch (provider) {
    case 'hostaway': {
      const { HostawayAdapter } = await import('./hostaway')
      return new HostawayAdapter(tokens)
    }
    case 'guesty': {
      const { GuestyAdapter } = await import('./guesty')
      return new GuestyAdapter(tokens)
    }
    case 'hospitable': {
      const { HospitableAdapter } = await import('./hospitable')
      return new HospitableAdapter(tokens)
    }
    default:
      throw new Error(`Unknown PMS provider: ${provider}`)
  }
}
