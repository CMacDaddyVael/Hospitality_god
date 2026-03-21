/**
 * Stripe Webhook Handler — Unit Tests
 *
 * Run with: cd web && npx jest src/app/api/webhooks/stripe/__tests__/route.test.ts
 *
 * These tests mock Stripe and Supabase so no network calls are made.
 * For end-to-end testing, use the Stripe CLI:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *   stripe trigger checkout.session.completed
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockConstructEvent = jest.fn()
const mockCustomersRetrieve = jest.fn()
const mockSubscriptionsRetrieve = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    customers: {
      retrieve: mockCustomersRetrieve,
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
    },
  }))
})

const mockSupabaseFrom = jest.fn()
const mockUpsert = jest.fn()
const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockSelect = jest.fn()
const mockSingle = jest.fn()
const mockMaybeSingle = jest.fn()
const mockEq = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockSupabaseFrom,
  })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: string, signature: string): Request {
  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  })
}

function makeCheckoutSessionEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    id: 'evt_test_123',
    data: {
      object: {
        id: 'cs_test_123',
        mode: 'subscription',
        customer: 'cus_test_123',
        subscription: 'sub_test_123',
        customer_email: 'host@example.com',
        customer_details: { email: 'host@example.com' },
        metadata: {
          listing_url: 'https://airbnb.com/rooms/12345',
          session_id: 'sess_abc123',
          plan: 'pro',
        },
        ...overrides,
      },
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/stripe', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = {
      ...originalEnv,
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
      STRIPE_SECRET_KEY: 'sk_test_key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service_role_key',
    }

    // Default Supabase chain: from().upsert().select().single()
    mockSingle.mockResolvedValue({ data: { id: 'sub-uuid-123' }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockSelect.mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle })
    mockUpsert.mockReturnValue({ select: mockSelect })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ select: mockSelect, eq: mockEq })
    mockSupabaseFrom.mockReturnValue({
      upsert: mockUpsert,
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
    })

    // Default Stripe mocks
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_test_123',
      email: 'host@example.com',
      deleted: false,
      metadata: {
        listing_url: 'https://airbnb.com/rooms/12345',
        session_id: 'sess_abc123',
      },
    })
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
      metadata: { plan: 'pro' },
      items: { data: [{ price: { nickname: 'pro', unit_amount: 4900 } }] },
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ── Signature verification ─────────────────────────────────────────────────

  it('returns 400 when stripe-signature header is missing', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/missing signature/i)
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })
    const { POST } = await import('../route')
    const req = makeRequest('{}', 'bad_sig')
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/signature verification failed/i)
  })

  // ── checkout.session.completed ─────────────────────────────────────────────

  it('creates subscriber and enqueues swarm job on checkout.session.completed', async () => {
    const event = makeCheckoutSessionEvent()
    mockConstructEvent.mockReturnValue(event)

    const { POST } = await import('../route')
    const req = makeRequest(JSON.stringify(event), 'valid_sig')
    const res = await POST(req as never)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
    expect(json.handled).toBe(true)

    // Supabase upsert called for subscriber
    expect(mockSupabaseFrom).toHaveBeenCalledWith('subscribers')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: 'cus_test_123',
        email: 'host@example.com',
        plan: 'pro',
        status: 'active',
      }),
      expect.any(Object)
    )

    // Swarm job inserted
    expect(mockSupabaseFrom).toHaveBeenCalledWith('swarm_jobs')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: 'cus_test_123',
        email: 'host@example.com',
        job_type: 'initial_swarm_run',
        status: 'queued',
      })
    )
  })

  it('ignores non-subscription checkout sessions', async () => {
    const event = makeCheckoutSessionEvent({ mode: 'payment' })
    mockConstructEvent.mockReturnValue(event)

    const { POST } = await import('../route')
    const req = makeRequest(JSON.stringify(event), 'valid_sig')
    const res = await POST(req as never)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.handled).toBe(false)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  // ── customer.subscription.deleted ─────────────────────────────────────────

  it('marks subscriber as cancelled on customer.subscription.deleted', async () => {
    const event = {
      type: 'customer.subscription.deleted',
      id: 'evt_del_123',
      data: {
        object: {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'canceled',
        },
      },
    }
    mockConstructEvent.mockReturnValue(event)

    // update().eq().select().single()
    mockSingle.mockResolvedValue({ data: { id: 'sub-uuid-123', status: 'cancelled' }, error: null })

    const { POST } = await import('../route')
    const req = makeRequest(JSON.stringify(event), 'valid_sig')
    const res = await POST(req as never)

    expect(res.status).toBe(200)
    expect(mockSupabaseFrom).toHaveBeenCalledWith('subscribers')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    )
  })

  // ── Unhandled events ───────────────────────────────────────────────────────

  it('returns 422 for unhandled event types', async () => {
    const event = {
      type: 'invoice.payment_succeeded',
      id: 'evt_invoice_123',
      data: { object: {} },
    }
    mockConstructEvent.mockReturnValue(event)

    const { POST } = await import('../route')
    const req = makeRequest(JSON.stringify(event), 'valid_sig')
    const res = await POST(req as never)

    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.handled).toBe(false)
  })
})
