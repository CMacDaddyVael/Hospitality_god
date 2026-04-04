# lib/images — Lifestyle Image Generation Pipeline

## Overview

This module implements the VAEL Host lifestyle image generation pipeline — the feature
described as the "holy shit moment" and primary competitive moat.

Given a property's listing data (type, location, amenities, season), it:
1. Auto-detects the current season (or accepts an override)
2. Builds 3 tailored Gemini image generation prompts (exterior, interior, lifestyle)
3. Calls the Gemini Imagen API to generate each image
4. Uploads results to Supabase Storage at `listing-images/{subscriber_id}/{deliverable_id}/`
5. Records a `deliverables` row with `type: lifestyle_images` and `status: ready`
6. Returns the array of 3 public image URLs

## Usage

```js
import { generateListingImages } from './lib/images/lifestyle-generator.js';

const imageUrls = await generateListingImages({
  propertyType: 'cabin',
  location: 'Lake Tahoe, CA',
  amenities: ['fireplace', 'hot tub', 'mountain view'],
  // season is auto-detected from current month — or pass 'winter' | 'spring' | 'summer' | 'autumn'
  subscriberId: 'sub_abc123',
  deliverableId: 'del_xyz789',
});

// imageUrls = [
//   'https://.../listing-images/sub_abc123/del_xyz789/exterior_hero.jpg',
//   'https://.../listing-images/sub_abc123/del_xyz789/interior_living.jpg',
//   'https://.../listing-images/sub_abc123/del_xyz789/lifestyle_ambiance.jpg',
// ]
```

## Image Slots

| Slot | File | Description |
|------|------|-------------|
| `exterior_hero` | `exterior_hero.jpg` | Hero/exterior shot — curb appeal, setting |
| `interior_living` | `interior_living.jpg` | Interior living space — cozy, welcoming |
| `lifestyle_ambiance` | `lifestyle_ambiance.jpg` | Ambiance detail — emotional, aspirational |

## Season Auto-Detection

| Months | Season |
|--------|--------|
| Dec, Jan, Feb | `winter` |
| Mar, Apr, May | `spring` |
| Jun, Jul, Aug | `summer` |
| Sep, Oct, Nov | `autumn` |

## Storage Layout

```
listing-images/
  {subscriber_id}/
    {deliverable_id}/
      exterior_hero.jpg
      interior_living.jpg
      lifestyle_ambiance.jpg
```

## Error Handling

- If **any individual image** fails, the error is logged but generation continues for remaining slots
- If **all images** fail, the deliverable is marked `status: failed` and an error is thrown
- If **some images** succeed, the deliverable is marked `status: ready` with partial URLs
- No broken/empty image URLs are ever stored

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key with Imagen access |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (write access) |

## Supabase Setup Required

### Storage Bucket
```sql
-- Create the storage bucket (public)
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true);
```

### Deliverables Table
See `supabase/migrations/002_deliverables.sql` for the required schema.

## Running Tests

```bash
node --input-type=module lib/images/lifestyle-generator.test.js
```
