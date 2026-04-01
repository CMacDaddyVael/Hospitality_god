/**
 * Hostaway PMS Adapter
 * Docs: https://api.hostaway.com
 * Auth: OAuth2 (client_credentials grant for most ops, authorization_code for user installs)
 */

import type {
  PMSAdapter,
  PMSListing,
  PMSReview,
  PMSMessage,
  PMSReservation,
  PMSCalendarDay,
  PMSConnectionStatus,
  PMSTokenSet,
} from './pms-adapter'

const BASE_URL = 'https://api.hostaway.com/v1'

export class HostawayAdapter implements PMSAdapter {
  readonly provider = 'hostaway' as const
  private tokens: PMSTokenSet

  constructor(tokens: PMSTokenSet) {
    this.tokens = tokens
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.refreshIfNeeded()

    const url = `${BASE_URL}${path}`
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens.accessToken}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...(options.headers ?? {}),
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Hostaway API error ${res.status} on ${path}: ${body}`)
    }

    return res.json() as Promise<T>
  }

  private async refreshIfNeeded(): Promise<void> {
    if (!this.tokens.expiresAt) return
    const bufferMs = 60_000 // refresh 1 min before expiry
    if (Date.now() < this.tokens.expiresAt - bufferMs) return

    if (!this.tokens.refreshToken) {
      throw new Error('Hostaway access token expired and no refresh token available')
    }

    const clientId = process.env.HOSTAWAY_CLIENT_ID!
    const clientSecret = process.env.HOSTAWAY_CLIENT_SECRET!

    const res = await fetch('https://api.hostaway.com/v1/accessTokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.tokens.refreshToken,
      }),
    })

    if (!res.ok) {
      throw new Error(`Hostaway token refresh failed: ${await res.text()}`)
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    this.tokens = {
      ...this.tokens,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.tokens.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    }

    // Persist updated tokens — caller should handle this via onTokenRefresh callback
    // For now we update in-memory; the API route layer saves back to Supabase
  }

  // ---------------------------------------------------------------------------
  // OAuth helpers (static — used during the OAuth flow, not per-instance)
  // ---------------------------------------------------------------------------

  static getAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'listings reservations reviews messages calendar',
      state,
    })
    return `https://app.hostaway.com/oauth?${params.toString()}`
  }

  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<PMSTokenSet> {
    const res = await fetch('https://api.hostaway.com/v1/accessTokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!res.ok) {
      throw new Error(`Hostaway token exchange failed: ${await res.text()}`)
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      scope: data.scope,
    }
  }

  // ---------------------------------------------------------------------------
  // PMSAdapter implementation
  // ---------------------------------------------------------------------------

  async testConnection(): Promise<PMSConnectionStatus> {
    try {
      const data = await this.fetch<{ result: { name: string; listingsCount?: number } }>(
        '/account'
      )
      return {
        connected: true,
        provider: this.provider,
        accountName: data.result?.name,
        listingCount: data.result?.listingsCount,
      }
    } catch (err) {
      return {
        connected: false,
        provider: this.provider,
        error: (err as Error).message,
      }
    }
  }

  async getListings(): Promise<PMSListing[]> {
    const data = await this.fetch<{ result: HostawayListing[] }>('/listings?limit=100')
    return (data.result ?? []).map(mapHostawayListing)
  }

  async getListing(listingId: string): Promise<PMSListing> {
    const data = await this.fetch<{ result: HostawayListing }>(`/listings/${listingId}`)
    return mapHostawayListing(data.result)
  }

  async getReviews(listingId?: string, limit = 50): Promise<PMSReview[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (listingId) params.set('listingMapId', listingId)

    const data = await this.fetch<{ result: HostawayReview[] }>(
      `/reviews?${params.toString()}`
    )
    return (data.result ?? []).map(mapHostawayReview)
  }

  async getMessages(reservationId: string): Promise<PMSMessage[]> {
    const data = await this.fetch<{ result: HostawayMessage[] }>(
      `/reservations/${reservationId}/messages`
    )
    return (data.result ?? []).map((m) => mapHostawayMessage(m, reservationId))
  }

  async getReservations(options: {
    listingId?: string
    status?: PMSReservation['status']
    fromDate?: string
    toDate?: string
    limit?: number
  } = {}): Promise<PMSReservation[]> {
    const params = new URLSearchParams({ limit: String(options.limit ?? 100) })
    if (options.listingId) params.set('listingMapId', options.listingId)
    if (options.status) params.set('status', hostawayStatusMap[options.status] ?? options.status)
    if (options.fromDate) params.set('arrivalStartDate', options.fromDate)
    if (options.toDate) params.set('arrivalEndDate', options.toDate)

    const data = await this.fetch<{ result: HostawayReservation[] }>(
      `/reservations?${params.toString()}`
    )
    return (data.result ?? []).map(mapHostawayReservation)
  }

  async getCalendar(
    listingId: string,
    fromDate: string,
    toDate: string
  ): Promise<PMSCalendarDay[]> {
    const params = new URLSearchParams({ startDate: fromDate, endDate: toDate })
    const data = await this.fetch<{ result: HostawayCalendarDay[] }>(
      `/listings/${listingId}/calendar?${params.toString()}`
    )
    return (data.result ?? []).map((d) => mapHostawayCalendarDay(d, listingId))
  }

  async replyToReview(reviewId: string, text: string): Promise<void> {
    await this.fetch(`/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply: text }),
    })
  }

  async sendMessage(reservationId: string, text: string): Promise<void> {
    await this.fetch(`/reservations/${reservationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    })
  }
}

// ---------------------------------------------------------------------------
// Raw Hostaway types (subset of what the API returns)
// ---------------------------------------------------------------------------

interface HostawayListing {
  id: number
  externalListingId?: string
  name: string
  description?: string
  address?: string
  city?: string
  state?: string
  countryCode?: string
  lat?: number
  lng?: number
  bedroomsNumber?: number
  bathroomsNumber?: number
  personCapacity?: number
  amenities?: string[]
  images?: { url: string; caption?: string }[]
  price?: number
  currencyCode?: string
  channelName?: string
  status?: string
}

interface HostawayReview {
  id: number
  reservationId?: number
  listingMapId?: number
  guestName?: string
  rating?: number
  reviewText?: string
  date?: string
  isReplied?: boolean
  replyText?: string
  channelName?: string
}

interface HostawayMessage {
  id: number
  reservationId?: number
  guestName?: string
  guestEmail?: string
  message?: string
  type?: 'incoming' | 'outgoing'
  date?: string
  channelName?: string
}

interface HostawayReservation {
  id: number
  listingMapId?: number
  guestFirstName?: string
  guestLastName?: string
  guestEmail?: string
  guestPhone?: string
  arrivalDate?: string
  departureDate?: string
  numberOfGuests?: number
  totalPrice?: number
  currencyCode?: string
  status?: string
  channelName?: string
  insertTime?: string
}

interface HostawayCalendarDay {
  date?: string
  isAvailable?: boolean
  price?: number
  currencyCode?: string
  minimumStay?: number
  reservationId?: number
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapHostawayListing(l: HostawayListing): PMSListing {
  return {
    id: String(l.id),
    externalId: l.externalListingId ?? String(l.id),
    name: l.name ?? '',
    description: l.description ?? '',
    address: l.address ?? '',
    city: l.city ?? '',
    state: l.state ?? '',
    country: l.countryCode ?? '',
    latitude: l.lat,
    longitude: l.lng,
    bedrooms: l.bedroomsNumber ?? 0,
    bathrooms: l.bathroomsNumber ?? 0,
    maxGuests: l.personCapacity ?? 0,
    amenities: l.amenities ?? [],
    photos: (l.images ?? []).map((img) => ({ url: img.url, caption: img.caption })),
    pricePerNight: l.price ?? 0,
    currency: l.currencyCode ?? 'USD',
    platform: l.channelName ?? 'airbnb',
    status: l.status === 'active' ? 'active' : 'inactive',
    raw: l as unknown as Record<string, unknown>,
  }
}

function mapHostawayReview(r: HostawayReview): PMSReview {
  return {
    id: String(r.id),
    listingId: String(r.listingMapId ?? ''),
    guestName: r.guestName ?? 'Guest',
    rating: r.rating ?? 5,
    text: r.reviewText ?? '',
    date: r.date ?? new Date().toISOString(),
    replied: r.isReplied ?? false,
    replyText: r.replyText,
    platform: r.channelName ?? 'airbnb',
    raw: r as unknown as Record<string, unknown>,
  }
}

function mapHostawayMessage(m: HostawayMessage, reservationId: string): PMSMessage {
  return {
    id: String(m.id),
    reservationId,
    guestName: m.guestName ?? 'Guest',
    guestEmail: m.guestEmail,
    direction: m.type === 'outgoing' ? 'outbound' : 'inbound',
    text: m.message ?? '',
    sentAt: m.date ?? new Date().toISOString(),
    platform: m.channelName ?? 'airbnb',
    raw: m as unknown as Record<string, unknown>,
  }
}

function mapHostawayReservation(r: HostawayReservation): PMSReservation {
  return {
    id: String(r.id),
    listingId: String(r.listingMapId ?? ''),
    guestName: `${r.guestFirstName ?? ''} ${r.guestLastName ?? ''}`.trim() || 'Guest',
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    checkIn: r.arrivalDate ?? '',
    checkOut: r.departureDate ?? '',
    guests: r.numberOfGuests ?? 1,
    totalAmount: r.totalPrice ?? 0,
    currency: r.currencyCode ?? 'USD',
    status: normalizeHostawayStatus(r.status),
    platform: r.channelName ?? 'airbnb',
    bookedAt: r.insertTime ?? new Date().toISOString(),
    raw: r as unknown as Record<string, unknown>,
  }
}

function mapHostawayCalendarDay(d: HostawayCalendarDay, listingId: string): PMSCalendarDay {
  return {
    date: d.date ?? '',
    listingId,
    available: d.isAvailable ?? true,
    price: d.price,
    currency: d.currencyCode,
    minimumStay: d.minimumStay,
    reservationId: d.reservationId ? String(d.reservationId) : undefined,
  }
}

function normalizeHostawayStatus(status?: string): PMSReservation['status'] {
  switch ((status ?? '').toLowerCase()) {
    case 'confirmed':
    case 'accepted':
      return 'confirmed'
    case 'pending':
      return 'pending'
    case 'cancelled':
    case 'canceled':
      return 'cancelled'
    case 'completed':
    case 'checked_out':
      return 'completed'
    default:
      return 'confirmed'
  }
}

const hostawayStatusMap: Record<PMSReservation['status'], string> = {
  confirmed: 'confirmed',
  pending: 'pending',
  cancelled: 'cancelled',
  completed: 'completed',
}
