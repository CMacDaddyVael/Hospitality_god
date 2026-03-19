# Hospitality God — Vision & Goals

## Mission
Autonomous AI CMO for short-term rental owners. Not advice — execution. The agent manages your marketing so you can manage your properties.

## Target Market
**Short-term rental owners and managers** — Airbnb hosts, Vrbo operators, vacation rental managers with 1-50 properties. 1.7M+ properties in the US alone. Currently have zero marketing support.

## Target
3,000 paying STR clients by end of 2027

## Pricing
$99-199/mo (replaces: nothing — these owners currently do zero marketing, or pay $3K+/mo for an agency they can't afford)

## Revenue Math
- 3,000 clients × $149/mo avg = $447K MRR = $5.4M ARR
- Market penetration needed: 0.17% of US STR market
- Expand to hotels/resorts after establishing STR dominance

## What "Done" Looks Like
An STR owner signs up, connects their listings, and the agent autonomously:

### Core Features (MVP — April 2026)
1. **Listing Optimization** — Rewrites Airbnb/Vrbo titles, descriptions, tags for maximum search visibility. Analyzes photos, suggests improvements.
2. **Review Management** — Drafts responses to all guest reviews (positive and negative) in the owner's voice. Posts them automatically.
3. **Guest Communication** — Pre-arrival messages, check-in instructions, mid-stay check-ins, post-stay thank you + review request. Automated sequences.
4. **Social Content** — Creates and schedules Instagram/TikTok posts showcasing the property. AI-generated lifestyle visuals.
5. **Performance Dashboard** — Shows occupancy trends, review sentiment, listing health score, competitive positioning.

### Phase 2 (Q3 2026)
6. **Direct Booking Website** — Generates a branded website for the property with booking capability. SEO-optimized.
7. **SEO/GEO** — Optimizes the direct site for Google and AI search engines. Schema markup, local content, answer-ready pages.
8. **Email Marketing** — Past guest database, return-visit campaigns, seasonal promotions.
9. **Competitive Intelligence** — Monitors comparable listings, alerts on pricing/amenity changes, suggests adjustments.

### Phase 3 (Q4 2026 - 2027)
10. **Paid Ads** — Google Ads and Meta campaigns driving direct bookings. Budget management, creative generation, optimization.
11. **Dynamic Pricing Integration** — Connects with PriceLabs/Wheelhouse/Beyond Pricing, feeds marketing strategy based on pricing data.
12. **Multi-property Portfolio Dashboard** — For managers with 5-50 properties.
13. **Upmarket: Boutique Hotels** — Extend platform to independent hotels.

## Tech Stack
- **Frontend:** Next.js + React + Tailwind (web app + dashboard)
- **Backend:** Node.js, Vercel serverless
- **AI:** Claude API (strategy, content, conversation), Gemini (image generation/analysis)
- **Database:** Supabase (Postgres + auth + realtime)
- **Integrations:** Airbnb API (unofficial/scraping), Vrbo API, Meta Graph API, Google Business Profile API, Stripe (billing)
- **Scheduling:** Cron jobs for automated tasks

## Principles
- Execution over advice — the agent DOES the work
- Start with STR owners (underserved, fast adopters, huge market)
- Ship MVP by April 2026 — listing optimization + review management + guest comms
- Don't contact leads yet — build the product first
- Every feature must save the owner measurable time or make them measurable money

## Timeline
- **Now → April 2026:** MVP (listing optimization, review management, guest comms, social content, dashboard)
- **April 2026:** Start selling. First 50 beta users.
- **Q2 2026:** Iterate based on feedback. Add direct booking sites.
- **Q3-Q4 2026:** SEO/GEO, email marketing, competitive intel. Scale to 300 clients.
- **2027:** Paid ads, multi-property, upmarket to hotels. Scale to 3,000.

## Current State (March 2026)
- [x] Knowledge base seeded (SEO/GEO, paid ads, content/social, industry trends, competitive intel)
- [x] Automated research loop (every 2 hours)
- [x] Orchestrator agent (every 4 hours)
- [x] Parallel worker agents (up to 10 concurrent)
- [ ] Product spec for MVP features
- [ ] Web app scaffolding (Next.js + Supabase)
- [ ] Listing optimization engine
- [ ] Review response generator
- [ ] Guest communication sequences
- [ ] Social content generator
- [ ] Dashboard
- [ ] Stripe billing integration
- [ ] Landing page
- [ ] Beta program
