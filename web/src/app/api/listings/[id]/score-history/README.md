# Score History API

## Endpoint
`GET /api/listings/[id]/score-history`

## Authentication
Requires a valid Supabase JWT passed as `Authorization: Bearer <token>` header.
Users may only access score history for listings they own (enforced via `user_id` check).

## Response Shape

```json
{
  "listing_id": "uuid",
  "history": [
    {
      "scored_at": "2026-01-15T12:00:00Z",
      "total_score": 41,
      "category_scores": {
        "photos": 35,
        "description": 45,
        "amenities": 50,
        "reviews": 38
      }
    }
  ],
  "delta": 26,
  "first_score": 41,
  "current_score": 67,
  "count": 3
}
```

## Database Tables Required
This endpoint reads from two tables:

### `listings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to auth.users |

### `listing_audits`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| listing_id | uuid | Foreign key to listings.id |
| scored_at | timestamptz | When audit ran |
| total_score | integer | 0–100 |
| category_scores | jsonb | Per-category breakdown |

## Error Responses
- `401 Unauthorized` — missing or invalid token
- `404 Not Found` — listing doesn't exist or belongs to another user
- `500 Internal Server Error` — database error
