---
name: airbnb_integration
description: How to integrate with Airbnb without a public API — connectivity partner program, PMS middleware, scraping risks
type: project
---

# Airbnb Integration Strategy (March 2026)

## The Reality
- Airbnb API is **closed/invite-only** — no open application form
- Not actively accepting new partners — they seek out and invite companies
- 32 approved Preferred/Preferred+ partners as of 2025
- Scraping is a non-starter (ToS violation, legal risk, actively blocked)
- iCal is garbage (30-60 min delay, calendar-only, no listing management)

## What the Official API Can Do (If You Have Access)
- Create/update listings, descriptions, amenities, photos
- Set/modify pricing and availability
- Manage reservations
- Send/receive guest messages
- Access reviews and ratings
- Real-time two-way calendar sync
- Performance analytics

## Our Strategy: Three Paths

### Path 1: PMS API Integrations (NOW — MVP)
Build on Hostaway, Guesty, and Hospitable public APIs:
- Users connect their PMS → we access Airbnb data through the PMS
- Covers majority of professional STR operators
- Partnership/distribution opportunity (PMS promotes us to their users)
- **Limitation:** Users must already use a PMS

### Path 2: Hospitable Connect (NOW — fastest)
- Hospitable built middleware that gives third-party tools Airbnb access
- Currently free
- Fastest path to Airbnb data without own partnership
- **Risk:** Dependency on Hospitable

### Path 3: Direct Airbnb Partnership (LATER — when we have scale)
- Pursue once we have 500+ clients flowing through PMS integrations
- Demonstrate value: "We manage marketing for X thousand listings on your platform"
- Expect months-to-years timeline

## Connectivity Partner Requirements
- Proven uptime, reliability, API performance
- Data security compliance
- Excellent support for shared users
- Must demonstrate significant business scale
- Airbnb assigns integration consultant during onboarding
