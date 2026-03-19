---
name: trust_autonomy
description: Trust and graduated autonomy framework for AI-managed marketing — approval workflows, risk tiers, progressive automation
type: project
---

# Trust & Graduated Autonomy Framework (March 2026)

## The Trust Landscape
- 63% of consumers don't trust AI with their data (up from 44% in 2024)
- BUT 61% of STR operators already use AI (up from 30% in 2023)
- 71% report increased bookings from AI-enhanced content
- Market is primed but needs guardrails

## AI Marketing Horror Stories (Why This Matters)
- McDonald's AI ordering: added random McNuggets, couldn't be corrected → cancelled across 100 locations
- Coca-Cola AI holiday campaign: mocked as soulless, replacing artists
- Google AI Overviews: told users to put glue on pizza
- Willy's Chocolate Experience: AI images created impossible expectations
- For STR owners: one bad listing change = lost bookings = lost mortgage payment

## The 5-Level Autonomy Model

| Level | Name | Description | STR Example |
|-------|------|------------|-------------|
| 0 | Manual | Human does everything | Owner writes all listings manually |
| 1 | Suggestion | AI suggests, human executes | AI drafts title, owner copies it |
| 2 | Approve/Reject | AI prepares output, human approves | AI generates full listing, owner reviews |
| 3 | Human-on-the-Loop | AI executes, human monitors | AI posts updates, owner gets notification |
| 4 | Full Autonomy | AI acts independently | AI manages entire marketing lifecycle |

## Our Implementation: Crawl, Walk, Run

### Week 1-2: SUGGEST MODE (Level 2)
- AI drafts everything — review responses, social posts, listing updates
- Owner gets push notification for each: "Approve / Edit / Reject"
- Every action requires explicit approval
- Builds trust AND trains AI on owner's preferences

### Week 3-4: SMART AUTO (Level 3 for low-risk)
- Low-risk actions go automatic: guest check-in messages, social posts
- High-risk actions still need approval: review responses, listing changes
- Activity feed shows everything
- One-tap undo on any action

### Month 2+: FULL AUTO (Level 3-4)
- Everything runs autonomously
- Weekly digest: "Here's what I did this week"
- Emergency brake: pause all actions instantly
- AI flags unusual situations for human review

## Content Risk Tiers

| Risk Level | Content Type | Default Mode |
|------------|-------------|-------------|
| Low | Seasonal pricing nudges, check-in messages, social posts | Auto after Week 2 |
| Medium | Review responses (positive), listing description updates | Approve until Month 2 |
| High | Review responses (negative), pricing changes, photo swaps | Always approve initially |

## Key Design Principles
1. **Batch approval > real-time interrupts** — queue 5 social posts, approve all at once
2. **Smart defaults with override** — AI publishes, sends summary, owner can revert within 24hrs
3. **Confidence dashboard** — "You approved 47 of 50 suggestions. Want to enable auto-publish?"
4. **Prompt for autonomy, don't assume it** — owner opts in to each level
5. **Always provide undo window** — minimum 24 hours for any action
6. **Show AI reasoning** — "I updated your summer listing because occupancy dropped 15% vs last June"
7. **Transparency kills anxiety** — activity feed, weekly reports, reasoning explanations
