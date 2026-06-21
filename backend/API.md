# CardMeet API Response Contract

## Overview

All API responses use **camelCase** field names and **whole-shekel prices** (not cents). Timestamps are in ISO 8601 format.

## Field Mappings

### User

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `id` | `id` | string | UUID |
| `email` | `email` | string | |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "roee@example.com",
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

### UserProfile

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `user_id` | `userId` | string | UUID |
| `display_name` | `displayName` | string | |
| `avatar_url` | `avatarUrl` | string \| null | |
| `location_lat` | `locationLat` | number | |
| `location_lng` | `locationLng` | number | |
| `travel_radius_km` | `travelRadiusKm` | number | |
| `games` | `games` | string[] | `['mtg', 'pokemon', 'yugioh', 'lorcana']` |
| `rating` | `rating` | number | 1.0–5.0 |
| `completed_deals` | `completedDeals` | number | |
| `no_shows` | `noShows` | number | |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "displayName": "Roee",
  "avatarUrl": null,
  "locationLat": 32.0853,
  "locationLng": 34.7818,
  "travelRadiusKm": 50,
  "games": ["mtg", "pokemon"],
  "rating": 4.8,
  "completedDeals": 12,
  "noShows": 1,
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

### Listing

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `id` | `id` | string | UUID |
| `seller_id` | `sellerId` | string | UUID |
| `card_name` | `cardName` | string | |
| `card_set` | `cardSet` | string \| null | |
| `condition` | `condition` | string | `'nm' \| 'lp' \| 'mp' \| 'hp'` |
| `price_cents` | `price` | number | **Divided by 100** (cents → shekels) |
| `currency` | `currency` | string | Default: `'ILS'` |
| `image_url` | `imageUrl` | string \| null | |
| `description` | `description` | string \| null | |
| `game` | `game` | string | `'mtg' \| 'pokemon' \| 'yugioh' \| 'lorcana'` |
| `status` | `status` | string | `'active' \| 'sold' \| 'withdrawn'` |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "id": "abc123",
  "sellerId": "123e4567-e89b-12d3-a456-426614174000",
  "cardName": "Liliana of the Veil",
  "cardSet": "Innistrad",
  "condition": "nm",
  "price": 310,
  "currency": "ILS",
  "imageUrl": null,
  "description": "Original Innistrad print, near mint borders and corners.",
  "game": "mtg",
  "status": "active",
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

### Deal

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `id` | `id` | string | UUID |
| `listing_id` | `listingId` | string | UUID |
| `buyer_id` | `buyerId` | string | UUID |
| `seller_id` | `sellerId` | string | UUID |
| `status` | `status` | string | `'negotiating' \| 'matched' \| 'scheduled' \| 'completed' \| 'cancelled'` |
| `current_price_cents` | `currentPriceCents` | number \| null | In cents (not divided) |
| `current_turn` | `currentTurn` | string \| null | User ID of who can offer next |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "id": "deal-123",
  "listingId": "abc123",
  "buyerId": "buyer-id",
  "sellerId": "seller-id",
  "status": "negotiating",
  "currentPriceCents": 31000,
  "currentTurn": "seller-id",
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

### Offer

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `id` | `id` | string | UUID |
| `deal_id` | `dealId` | string | UUID |
| `from_user_id` | `fromUserId` | string | UUID |
| `price_cents` | `priceCents` | number | In cents (not divided) |
| `note` | `note` | string \| null | |
| `status` | `status` | string | `'active' \| 'accepted' \| 'withdrawn' \| 'countered'` |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "id": "offer-123",
  "dealId": "deal-123",
  "fromUserId": "buyer-id",
  "priceCents": 31000,
  "note": "Can you go down to 310?",
  "status": "active",
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

### Event

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `id` | `id` | string | UUID |
| `name` | `name` | string | |
| `description` | `description` | string \| null | |
| `location_name` | `locationName` | string | |
| `location_lat` | `locationLat` | number | |
| `location_lng` | `locationLng` | number | |
| `start_date` | `startDate` | Date | ISO 8601 |
| `end_date` | `endDate` | Date | ISO 8601 |
| `games` | `games` | string[] | `['mtg', 'pokemon', 'yugioh', 'lorcana']` |
| `event_type` | `eventType` | string | `'tournament' \| 'convention' \| 'fnm'` |
| `status` | `status` | string | `'active' \| 'cancelled' \| 'completed'` |
| `created_by` | `createdBy` | string \| null | UUID |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "id": "event-123",
  "name": "GP Tel Aviv",
  "description": "Grand Prix Tel Aviv",
  "locationName": "Tel Aviv Convention Center",
  "locationLat": 32.0853,
  "locationLng": 34.7818,
  "startDate": "2026-07-01T09:00:00Z",
  "endDate": "2026-07-03T20:00:00Z",
  "games": ["mtg"],
  "eventType": "tournament",
  "status": "active",
  "createdBy": "admin-id",
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

### EventRSVP

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `id` | `id` | string | UUID |
| `user_id` | `userId` | string | UUID |
| `event_id` | `eventId` | string | UUID |
| `status` | `status` | string | `'going' \| 'maybe' \| 'no'` |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "id": "rsvp-123",
  "userId": "user-id",
  "eventId": "event-123",
  "status": "going",
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

### Meetup

| DB Field | API Field | Type | Notes |
|----------|-----------|------|-------|
| `id` | `id` | string | UUID |
| `deal_id` | `dealId` | string | UUID |
| `event_id` | `eventId` | string | UUID |
| `start_time` | `startTime` | Date | ISO 8601 |
| `end_time` | `endTime` | Date | ISO 8601 |
| `location_note` | `locationNote` | string \| null | |
| `status` | `status` | string | `'scheduled' \| 'completed' \| 'no_show_buyer' \| 'no_show_seller' \| 'cancelled'` |
| `buyer_confirmed` | `buyerConfirmed` | boolean | |
| `seller_confirmed` | `sellerConfirmed` | boolean | |
| `buyer_checked_in` | `buyerCheckedIn` | boolean | |
| `seller_checked_in` | `sellerCheckedIn` | boolean | |
| `buyer_checked_in_at` | `buyerCheckedInAt` | Date \| null | ISO 8601 |
| `seller_checked_in_at` | `sellerCheckedInAt` | Date \| null | ISO 8601 |
| `created_at` | `createdAt` | Date | ISO 8601 |
| `updated_at` | `updatedAt` | Date | ISO 8601 |

**Example:**
```json
{
  "id": "meetup-123",
  "dealId": "deal-123",
  "eventId": "event-123",
  "startTime": "2026-07-02T13:00:00Z",
  "endTime": "2026-07-02T13:30:00Z",
  "locationNote": "Hall C, near registration desk",
  "status": "scheduled",
  "buyerConfirmed": true,
  "sellerConfirmed": false,
  "buyerCheckedIn": false,
  "sellerCheckedIn": false,
  "buyerCheckedInAt": null,
  "sellerCheckedInAt": null,
  "createdAt": "2026-06-19T10:30:00Z",
  "updatedAt": "2026-06-19T10:30:00Z"
}
```

## Auth Responses

### Register / Login Response

```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "roee@example.com",
    "createdAt": "2026-06-19T10:30:00Z",
    "updatedAt": "2026-06-19T10:30:00Z"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### Refresh Token Response

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

## Grouped Deal Response

When fetching user's deals, they are grouped by status:

```json
{
  "negotiating": [
    { /* deal 1 */ },
    { /* deal 2 */ }
  ],
  "matched": [
    { /* deal 3 */ }
  ],
  "scheduled": [
    { /* deal 4 */ }
  ]
}
```

## Price Conversion Notes

- **Listing prices** are stored as `price_cents` (integers, e.g., `31000` for 310 ILS)
- When returned via API, they are **divided by 100** and rounded to whole shekels: `price: 310`
- **Offer/Deal prices** in `currentPriceCents` and `priceCents` are **NOT divided** (sent as-is in cents)
- This asymmetry is intentional: the frontend displays listing prices directly (in shekels), but can work with offer prices in cents for precision

## Timestamp Format

All dates are ISO 8601 strings when serialized to JSON:
- `2026-06-19T10:30:00Z` (UTC)
- Python/Node.js `Date` objects are automatically serialized to this format by `JSON.stringify()`

## Error Responses

All errors follow this format:

```json
{
  "error": "Unauthorized",
  "message": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

Status codes:
- `400` - Validation error
- `401` - Authentication error
- `403` - Authorization error
- `404` - Resource not found
- `500` - Server error
