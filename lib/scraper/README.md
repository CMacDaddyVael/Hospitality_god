# Airbnb Listing Scraper

Puppeteer-based scraper that extracts all public data from Airbnb listing pages.

## Usage

```typescript
import { scrapeAirbnbListing } from '@/lib/scraper';

const listing = await scrapeAirbnbListing('https://www.airbnb.com/rooms/12345678');

console.log(listing.title);        // "Cozy Beach Cottage"
console.log(listing.rating);       // 4.87
console.log(listing.reviewCount);  // 143
console.log(listing.photos);       // ['https://a0.muscache.com/...', ...]
console.log(listing.amenities);    // ['Wifi', 'Kitchen', 'Free parking', ...]
console.log(listing.pricePerNight); // 149
```

## Output Schema

```typescript
{
  url: string;
  platform: 'airbnb' | 'vrbo';
  title: string;
  description: string;
  photos: string[];          // Up to 50 photo URLs
  photoCount: number;
  amenities: string[];       // Up to 100 amenities
  rating: number | null;     // e.g. 4.87
  reviewCount: number;
  reviews: {                 // Up to 20 recent reviews
    text: string;
    rating: number;
    date: string;
    reviewer: string;
  }[];
  pricePerNight: number | null;
  currency: string;          // 'USD', 'EUR', 'GBP', etc.
  propertyType: string;      // e.g. 'Entire cabin'
  location: string;          // e.g. 'Asheville, North Carolina'
  hostResponseRate: string | null;  // e.g. '98%'
  hostName: string | null;
  maxGuests: number | null;
  bedrooms: number | null;
  beds: number | null;
  baths: number | null;
  listingId: string | null;
  scrapedAt: string;         // ISO timestamp
}
```

## Options

```typescript
scrapeAirbnbListing(url, {
  propertyId: 'uuid',  // Associate with a property record in Supabase
  skipDb: true,        // Don't write to Supabase (useful in tests)
});
```

## Retry Logic

The scraper retries up to 3 times on failure with exponential backoff:
- Attempt 1 fails → wait 2s
- Attempt 2 fails → wait 4s
- Attempt 3 fails → throw

## Supabase Schema

The scraper writes to the `listings` table. Apply the migration:

```sql
-- supabase/migrations/002_listings_table.sql
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser  # optional, for custom Chrome path
```

## Vercel / Serverless Notes

- Uses `--single-process` and `--no-sandbox` flags required in serverless environments
- Scrape typically completes in 10-25 seconds
- If approaching Vercel's 30s limit, move to a background job (see queue workers)
- For production, consider using `@sparticuz/chromium` for optimized serverless Chromium
