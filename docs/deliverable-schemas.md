# Deliverable `content_json` Schemas

Every row in the `deliverables` table carries a `content_json` JSONB column
whose structure depends on the `type` field. This document is the canonical
reference for what each agent writes and what the dashboard / weekly brief can
expect to read.

**Last updated:** 2026-03-21  
**Issue:** #225

---

## Overview

| `type` | Producer agent | Consumer |
|---|---|---|
| `listing_copy` | Listing Optimizer (#197) | Dashboard, Approval UI (#208), Weekly Brief |
| `review_response` | Review Responder (#204) | Dashboard, Approval UI (#208), Weekly Brief |
| `social_post` | Social Content Agent (#205) | Dashboard, Approval UI (#208), Social Scheduler |
| `competitive_report` | Competitive Intel Agent (#207) | Dashboard, Weekly Brief |
| `seasonal_update` | Seasonal Content Agent | Dashboard, Approval UI (#208), Weekly Brief |

All agents call `saveDeliverable()` from `lib/db/deliverables.mjs`. No agent
writes directly to the `deliverables` table or invents its own storage format.

---

## `listing_copy`

Rewritten listing title, description, and tags optimised for the Airbnb/Vrbo
algorithm. The owner copies these fields into their listing editor.

```json
{
  "platform": "airbnb",
  "listing_id": "12345678",
  "original": {
    "title": "Cozy cabin in the woods",
    "description": "A great place to stay...",
    "tags": []
  },
  "optimized": {
    "title": "Secluded Pine Cabin — Hot Tub, Fire Pit & Stargazing",
    "description": "Escape to this solar-powered cabin perched on 5 private acres of old-growth forest. Wake up to birdsong, soak in the cedar hot tub under the stars, and roast marshmallows at the stone fire pit. Fast WiFi + full kitchen means you can actually work from the woods.\n\n✓ 25 min from downtown Asheville  ✓ Pet-friendly  ✓ Free early check-in when available",
    "tags": ["hot tub", "fire pit", "pet-friendly", "remote work", "stargazing"]
  },
  "changes_summary": [
    "Added USPs (hot tub, fire pit, stargazing) to headline",
    "Rewrote description with sensory-first opening and scannable bullet points",
    "Added 5 high-search-volume tags missing from original"
  ],
  "score_before": 41,
  "score_after": 74,
  "agent_notes": "Title length optimized to 50 chars (Airbnb shows ~50 in search). Description structured for both human skimmers and Airbnb's ranking algorithm."
}
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `platform` | `"airbnb" \| "vrbo"` | Which platform this copy targets |
| `listing_id` | `string` | Platform's listing identifier |
| `original` | `object` | Snapshot of the copy before changes |
| `optimized` | `object` | The ready-to-use rewritten copy |
| `optimized.title` | `string` | ≤ 50 chars for Airbnb |
| `optimized.description` | `string` | Full rewritten description |
| `optimized.tags` | `string[]` | Suggested tags/amenity highlights |
| `changes_summary` | `string[]` | Human-readable list of what changed and why |
| `score_before` | `number` | 0–100 listing score before optimization |
| `score_after` | `number` | 0–100 projected score after changes |

---

## `review_response`

A ready-to-post response to a guest review, written in the owner's calibrated
voice. The owner copies this into the Airbnb response field.

```json
{
  "review_id": "R_abc123",
  "guest_name": "Sarah",
  "review_text": "Such a magical place! The hot tub was perfect and the cabin was spotless. Only wish the driveway directions were clearer.",
  "review_rating": 5,
  "review_date": "2026-03-15",
  "response": "Sarah, thank you so much — it genuinely made our week to hear that! We're glad the hot tub delivered (it's our favourite part too 🌲). Great call on the driveway — we're adding a landmark sign this spring so future guests find it without the detour. Hope to have you back for fall foliage season!",
  "voice_profile_used": "warm-casual",
  "tone_notes": "Owner signs off as 'Jake & Maya'. Response kept under 150 words per owner preference. Addressed the negative point constructively without over-apologising.",
  "word_count": 68
}
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `review_id` | `string` | Platform review identifier |
| `guest_name` | `string` | First name of the reviewer |
| `review_text` | `string` | Original review content |
| `review_rating` | `number` | 1–5 star rating |
| `review_date` | `string` | ISO 8601 date |
| `response` | `string` | The ready-to-post response text |
| `voice_profile_used` | `string` | Which voice calibration profile was applied |
| `tone_notes` | `string` | Agent's notes on how voice was applied |
| `word_count` | `number` | Length of the response |

---

## `social_post`

A complete, ready-to-post social media package: caption, hashtags, and
optionally a reference to a VAEL-generated lifestyle image.

```json
{
  "platform": "instagram",
  "caption": "Some mornings the mist rolls in so thick the trees disappear. ☁️ Our guests describe it as 'waking up inside a cloud.' Book your escape before fall fills up — link in bio.",
  "hashtags": [
    "#CabinLife",
    "#AshevilleNC",
    "#STRHost",
    "#VacationRental",
    "#MountainGetaway",
    "#AirbnbHost",
    "#NatureRetreat",
    "#WNCmountains"
  ],
  "image_prompt": "Misty pine forest at dawn, warm cabin glow visible through trees, cinematic lifestyle photography, golden hour haze",
  "image_url": null,
  "suggested_post_time": "2026-03-25T07:00:00-05:00",
  "content_theme": "atmosphere",
  "cta": "link_in_bio",
  "character_count": 178
}
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `platform` | `"instagram" \| "tiktok" \| "facebook"` | Target platform |
| `caption` | `string` | Full caption text (no hashtags embedded) |
| `hashtags` | `string[]` | Hashtag list, ready to append |
| `image_prompt` | `string \| null` | Prompt sent to VAEL image generator |
| `image_url` | `string \| null` | URL of generated image (null if not yet generated) |
| `suggested_post_time` | `string` | ISO 8601 datetime with timezone |
| `content_theme` | `string` | e.g. `atmosphere`, `amenity`, `local`, `review_highlight` |
| `cta` | `string` | Call to action type: `link_in_bio`, `dm_to_book`, `comment_below` |
| `character_count` | `number` | Caption length (platform limits awareness) |

---

## `competitive_report`

A structured market intelligence snapshot: what competitors are doing, pricing
gaps, and specific positioning recommendations.

```json
{
  "market": "Asheville, NC",
  "scan_date": "2026-03-21",
  "listings_analysed": 42,
  "price_range": {
    "min": 89,
    "max": 485,
    "median": 167,
    "your_price": 195
  },
  "positioning": {
    "your_rank_estimate": "top 25%",
    "primary_gap": "Competitors in your tier average 4.2 photos of outdoor amenities; you have 1.",
    "price_recommendation": "Current pricing is well-positioned. No change needed this week."
  },
  "top_competitor_moves": [
    {
      "listing_title": "Luxury Treehouse with Hot Tub",
      "change_detected": "Added 'EV charger' to amenity list and raised nightly rate by $30",
      "implication": "EV charging is becoming a differentiator in this market. Consider adding if feasible."
    }
  ],
  "opportunities": [
    "Add outdoor amenity photos (fire pit, hot tub at night) — highest-correlated factor with bookings in your tier",
    "Two nearby competitors lowered prices 15% for April — your calendar shows gaps; consider a limited-time promo"
  ],
  "threats": [
    "Three new 'cabin' listings launched this week within 10 miles at $145/night"
  ]
}
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `market` | `string` | City/region scanned |
| `scan_date` | `string` | ISO 8601 date |
| `listings_analysed` | `number` | Count of competitor listings reviewed |
| `price_range` | `object` | Market pricing snapshot including `your_price` |
| `positioning` | `object` | Where the subscriber's listing sits + top recommendation |
| `top_competitor_moves` | `array` | Notable changes detected at competitor listings |
| `opportunities` | `string[]` | Prioritised action items |
| `threats` | `string[]` | New risks identified |

---

## `seasonal_update`

Refreshed listing copy, photo suggestions, and promotional ideas tailored to
an upcoming season or holiday period.

```json
{
  "season": "fall",
  "target_dates": {
    "start": "2026-09-22",
    "end": "2026-11-30"
  },
  "updated_title": "Secluded Pine Cabin — Fall Foliage, Hot Tub & Fire Pit",
  "updated_description_hook": "Peak foliage hits our valley in mid-October — the maples turn crimson and the air smells like woodsmoke and rain. Book your fall escape now before the leaf-peeper rush.",
  "photo_suggestions": [
    "Hot tub surrounded by orange and red maple leaves",
    "Morning fog over the forest from the cabin deck — sunrise lighting",
    "Fire pit scene with s'mores, flannel blankets, hot drinks"
  ],
  "promo_ideas": [
    {
      "name": "Fall Foliage Special",
      "description": "3+ nights in October = complimentary welcome basket with local cider and snacks",
      "suggested_discount": null,
      "add_value_instead": true
    }
  ],
  "urgency_window": "Publish by 2026-08-15 for Airbnb seasonal search visibility",
  "seo_keywords": ["fall cabin rental Asheville", "leaf peeping NC mountains", "autumn getaway Blue Ridge"]
}
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `season` | `string` | `spring`, `summer`, `fall`, `winter`, or named holiday |
| `target_dates.start` | `string` | ISO 8601 date — season opens |
| `target_dates.end` | `string` | ISO 8601 date — season closes |
| `updated_title` | `string` | Season-flavoured listing title |
| `updated_description_hook` | `string` | New opening paragraph for the description |
| `photo_suggestions` | `string[]` | Descriptions of shots to capture or generate |
| `promo_ideas` | `array` | Promotional offers with rationale |
| `urgency_window` | `string` | Human-readable publishing deadline with reason |
| `seo_keywords` | `string[]` | Seasonal search terms to weave into copy |

---

## Notes for Agent Developers

1. **Always use `saveDeliverable()` from `lib/db/deliverables.mjs`** — never
   write to the `deliverables` table directly.

2. **`contentJson` is additive** — you may add fields beyond the required set
   as your agent evolves. The approval UI and weekly brief only depend on
   the documented required fields.

3. **`agentVersion`** should follow semver (`"1.0.0"`). Bump it when you change
   the shape of `contentJson` so the UI can handle old vs. new formats.

4. **Titles should be human-readable** — the `title` field appears in the
   dashboard card header. Examples:
   - `"Listing copy refresh — March 2026"`
   - `"Response to Sarah's review (⭐⭐⭐⭐⭐)"`
   - `"Instagram post — mist & atmosphere"`
   - `"Weekly competitive scan — Asheville NC"`
   - `"Fall 2026 seasonal update"`

5. **`listing_id` is optional** — competitive reports and some social posts are
   account-level, not tied to a single listing. Pass `null` or omit it.
