# CardMeet — Technical Architecture & Technology Stack

## System Overview

CardMeet is a mobile-first coordination platform that connects card game buyers and sellers at shared events. The architecture prioritizes real-time coordination, geolocation-based matching, and a structured negotiation system.

## Core Architecture

### Frontend Architecture
- **Platform**: React Native (iOS/Android)
- **State Management**: Redux Toolkit + RTK Query
- **Navigation**: React Navigation 6
- **UI Framework**: Custom component library (no UI kits)
- **Styling**: StyleSheet with design system tokens
- **Local Storage**: AsyncStorage + SQLite for offline capability

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with Helmet security
- **Database**: PostgreSQL with PostGIS for geospatial queries
- **Caching**: Redis for session management and real-time data
- **Real-time**: Socket.io for offer negotiations and notifications
- **File Storage**: AWS S3 for card images and user avatars

### Infrastructure
- **Hosting**: AWS (EC2, RDS, ElastiCache, S3)
- **CDN**: CloudFront for static assets
- **Load Balancer**: Application Load Balancer
- **Monitoring**: CloudWatch + Sentry for error tracking
- **Deployment**: Docker containers with ECS

## Detailed Technology Stack

### Frontend Dependencies

```json
{
  "core": {
    "react": "^18.2.0",
    "react-native": "^0.72.0",
    "typescript": "^5.0.0"
  },
  "state": {
    "@reduxjs/toolkit": "^1.9.0",
    "react-redux": "^8.1.0",
    "redux-persist": "^6.0.0"
  },
  "navigation": {
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/stack": "^6.3.0",
    "@react-navigation/bottom-tabs": "^6.5.0"
  },
  "ui": {
    "react-native-svg": "^13.9.0",
    "react-native-reanimated": "^3.3.0",
    "react-native-gesture-handler": "^2.12.0"
  },
  "utilities": {
    "react-native-mmkv": "^2.8.0",
    "react-native-geolocation-service": "^5.3.0",
    "@react-native-async-storage/async-storage": "^1.19.0"
  }
}
```

### Backend Dependencies

```json
{
  "core": {
    "node": "^18.0.0",
    "typescript": "^5.0.0",
    "express": "^4.18.0"
  },
  "database": {
    "pg": "^8.11.0",
    "knex": "^2.4.0",
    "postgis": "^3.3.0"
  },
  "auth": {
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.0",
    "passport": "^0.6.0"
  },
  "realtime": {
    "socket.io": "^4.7.0",
    "redis": "^4.6.0"
  },
  "utilities": {
    "joi": "^17.9.0",
    "winston": "^3.9.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.0"
  }
}
```

## Database Schema

### Core Tables

```sql
-- Users and Profiles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    location_lat DECIMAL(10,8) NOT NULL,
    location_lng DECIMAL(11,8) NOT NULL,
    travel_radius_km INTEGER NOT NULL DEFAULT 50,
    games TEXT[] NOT NULL, -- ['mtg', 'pokemon', 'yugioh', 'lorcana']
    rating DECIMAL(3,2) DEFAULT 5.0,
    completed_deals INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Events and Conventions
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255) NOT NULL,
    location_lat DECIMAL(10,8) NOT NULL,
    location_lng DECIMAL(11,8) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    games TEXT[] NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'tournament', 'convention', 'fnm'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'cancelled', 'completed'
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User RSVPs to Events
CREATE TABLE event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_id UUID REFERENCES events(id),
    status VARCHAR(20) NOT NULL, -- 'going', 'maybe', 'no'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Card Listings
CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES users(id),
    card_name VARCHAR(255) NOT NULL,
    card_set VARCHAR(100),
    condition VARCHAR(20) NOT NULL, -- 'nm', 'lp', 'mp', 'hp'
    price_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'ILS',
    image_url TEXT,
    description TEXT,
    game VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'sold', 'withdrawn'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Deals and Negotiations
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id),
    buyer_id UUID REFERENCES users(id),
    seller_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL, -- 'negotiating', 'matched', 'scheduled', 'completed', 'cancelled'
    current_price_cents INTEGER,
    current_turn UUID REFERENCES users(id), -- whose turn to act
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Offer Chain (Structured Negotiations)
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id),
    from_user_id UUID REFERENCES users(id),
    price_cents INTEGER NOT NULL,
    note TEXT,
    status VARCHAR(20) NOT NULL, -- 'active', 'accepted', 'withdrawn', 'countered'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled Meetups
CREATE TABLE meetups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id),
    event_id UUID REFERENCES events(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location_note TEXT,
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'no_show_buyer', 'no_show_seller', 'cancelled'
    buyer_confirmed BOOLEAN DEFAULT FALSE,
    seller_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- 'offer_received', 'deal_matched', 'meetup_reminder'
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Database Indexes

```sql
-- Geospatial indexes for location-based queries
CREATE INDEX idx_user_profiles_location ON user_profiles USING GIST (
    ST_Point(location_lng, location_lat)
);

CREATE INDEX idx_events_location ON events USING GIST (
    ST_Point(location_lng, location_lat)
);

-- Performance indexes
CREATE INDEX idx_listings_seller_game ON listings(seller_id, game, status);
CREATE INDEX idx_deals_buyer_status ON deals(buyer_id, status);
CREATE INDEX idx_deals_seller_status ON deals(seller_id, status);
CREATE INDEX idx_event_rsvps_user_event ON event_rsvps(user_id, event_id);
CREATE INDEX idx_offers_deal_created ON offers(deal_id, created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
```

## API Architecture

### RESTful Endpoints

```typescript
// Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

// User Profile
GET    /api/profile
PUT    /api/profile
GET    /api/profile/:id
PUT    /api/profile/location

// Events
GET    /api/events
POST   /api/events
GET    /api/events/:id
POST   /api/events/:id/rsvp
PUT    /api/events/:id/rsvp

// Listings
GET    /api/listings
POST   /api/listings
GET    /api/listings/:id
PUT    /api/listings/:id
DELETE /api/listings/:id

// Deals
GET    /api/deals
POST   /api/deals
GET    /api/deals/:id
POST   /api/deals/:id/offers
PUT    /api/deals/:id/offers/:offerId

// Meetups
GET    /api/meetups
POST   /api/meetups
PUT    /api/meetups/:id/confirm
PUT    /api/meetups/:id/complete

// Notifications
GET    /api/notifications
PUT    /api/notifications/:id/read
```

### WebSocket Events

```typescript
// Client -> Server
socket.emit('join_deal', dealId: string)
socket.emit('send_offer', { dealId, priceCents, note })
socket.emit('accept_offer', { dealId, offerId })
socket.emit('withdraw_offer', { dealId, offerId })

// Server -> Client
socket.on('offer_received', (offer: Offer))
socket.on('offer_accepted', (deal: Deal))
socket.on('deal_matched', (deal: Deal))
socket.on('turn_changed', (deal: Deal))
socket.on('meetup_scheduled', (meetup: Meetup))
```

## Frontend Architecture

### Redux Store Structure

```typescript
interface RootState {
  auth: {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    loading: boolean
  }
  profile: {
    profile: UserProfile | null
    loading: boolean
    updating: boolean
  }
  events: {
    events: Event[]
    rsvps: Record<string, 'going' | 'maybe' | 'no'>
    loading: boolean
  }
  listings: {
    listings: Listing[]
    filters: ListingFilters
    loading: boolean
    hasMore: boolean
  }
  deals: {
    negotiating: Deal[]
    matched: Deal[]
    scheduled: Deal[]
    loading: boolean
  }
  notifications: {
    notifications: Notification[]
    unreadCount: number
  }
}
```

### Component Architecture

```
src/
├── components/
│   ├── common/
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Input/
│   │   ├── Pill/
│   │   └── PhoneFrame/
│   ├── features/
│   │   ├── auth/
│   │   ├── events/
│   │   ├── listings/
│   │   ├── deals/
│   │   └── profile/
│   └── layout/
│       ├── Navigation/
│       ├── TabBar/
│       └── Header/
├── screens/
│   ├── Onboarding/
│   ├── Calendar/
│   ├── Browse/
│   ├── ListingDetail/
│   ├── MyDeals/
│   ├── OfferChain/
│   ├── Meetup/
│   └── Profile/
├── services/
│   ├── api/
│   ├── socket/
│   ├── storage/
│   └── location/
├── store/
│   ├── slices/
│   └── api/
├── utils/
│   ├── designSystem/
│   ├── formatters/
│   └── validators/
└── types/
    ├── api/
    ├── navigation/
    └── store/
```

## Security Architecture

### Authentication & Authorization
- JWT tokens with refresh mechanism
- Password hashing with bcrypt
- Rate limiting on auth endpoints
- Input validation with Joi schemas

### Data Protection
- HTTPS everywhere
- SQL injection prevention with parameterized queries
- XSS protection with content security policy
- Sensitive data encryption at rest

### API Security
- Request signing for critical operations
- IP-based rate limiting
- CORS configuration
- Request/response logging for audit trails

## Performance Optimization

### Frontend Optimization
- Image lazy loading and caching
- FlatList optimization for large datasets
- Memoization of expensive computations
- Bundle size optimization with tree shaking

### Backend Optimization
- Database query optimization with proper indexing
- Redis caching for frequently accessed data
- Connection pooling for database
- CDN for static assets

### Real-time Performance
- Socket.io room management
- Efficient event broadcasting
- Connection state management
- Automatic reconnection logic

## Monitoring & Observability

### Application Monitoring
- Sentry for error tracking
- Custom performance metrics
- User behavior analytics
- API response time monitoring

### Infrastructure Monitoring
- CloudWatch metrics and alerts
- Database performance monitoring
- Memory and CPU usage tracking
- Load balancer health checks

## Deployment Architecture

### Container Strategy
- Multi-stage Docker builds
- Environment-specific configurations
- Health checks and graceful shutdown
- Rolling updates with zero downtime

### CI/CD Pipeline
- GitHub Actions for automated testing
- Automated security scanning
- Blue-green deployment strategy
- Database migration automation

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Load balancer distribution
- Database read replicas
- Microservices preparation

### Data Growth
- Archive strategy for old deals
- Image compression and CDN offloading
- Database partitioning by date
- Cleanup of expired sessions

## Development Environment

### Local Development
- Docker Compose for local services
- Hot reloading for frontend
- Database seeding scripts
- Mock API for offline development

### Testing Strategy
- Unit tests with Jest
- Integration tests with Supertest
- E2E tests with Detox
- Performance testing with Artillery
