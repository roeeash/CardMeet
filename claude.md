# CardMeet — Claude Code Project Initialization

## Project Overview

CardMeet is a coordination layer for in-person card-game sales. It connects buyers and sellers who will both be attending the same conventions, tournaments, and events, eliminating the need for DM-based coordination and solving the no-show problem through structured commitment windows.

## Core Value Proposition

- **No more DM chaos** - Replace messy chat negotiations with structured offers
- **Built-in reliability** - Commitment windows and no-show tracking prevent ghosting  
- **Event-based matching** - Meet at conventions you're already attending
- **Cash transactions** - No payment processing complexity, focus on coordination

## Target Games (v1)
- Magic: The Gathering
- Pokémon
- Yu-Gi-Oh!
- Lorcana

## Key Features

### 8 Core Screens
1. **Onboarding** - Set location, travel radius, game preferences
2. **Calendar** - RSVP to events within your reach
3. **Browse** - Filter listings with shared convention indicators
4. **Listing Detail** - View card details, seller info, shared events
5. **My Deals** - Track Negotiating/Matched/Scheduled deals
6. **Offer Chain** - Structured price negotiations (no chat)
7. **Meetup** - Confirm 30-min windows at shared events
8. **Profile** - Reputation system with no-show tracking

### Critical Design Patterns
- **"Your turn" banners** - Clear action indicators
- **Shared convention badges** - 📅 BOTH @ EVENT_NAME
- **Commitment windows** - 13:00–13:30 format, not single times
- **No-show visibility** - Public reputation metric
- **Structured offers** - Accept/counter/withdraw, no free text

## Technical Constraints

- **Mobile-first** React Native application
- **Cash-only transactions** (v1)
- **Geolocation-based** event discovery
- **Real-time notifications** for offer turns
- **Offline capability** for convention venues

## Design System Requirements

- **Typography**: Fraunces (headlines), Inter (body), JetBrains Mono (labels)
- **Colors**: Warm paper (#f7f6f2) background, near-black ink (#14141a), single blue accent (#2c4cff)
- **Voice**: Direct, concrete, human-truth focused
- **No AI slop**: Purple gradients, generic features, corporate speak

## Success Metrics

- **Deal completion rate** (vs. traditional DM sales)
- **No-show reduction** (target: <5% vs. industry ~30%)
- **Time to first deal** (onboarding to successful transaction)
- **Event coverage density** (listings per active user)

## Development Phases

### Phase 1: Core Coordination Loop
- User profiles with location/games/radius
- Event calendar with RSVP system
- Basic listing creation and browsing
- Structured offer negotiation
- Meetup scheduling

### Phase 2: Trust & Reputation
- No-show tracking system
- User ratings and reviews
- Deal history and statistics
- Profile verification

### Phase 3: Scale Features
- Event discovery API integration
- Advanced filtering and search
- Push notification optimization
- Analytics dashboard

## Non-Negotiable Principles

1. **No chat-based negotiations** - Structured offers only
2. **Event-based matching** - Must have shared convention
3. **Commitment windows** - 30-minute scheduled slots
4. **Cash transactions** - No in-app payment processing
5. **No-show accountability** - Public reputation impact

## Getting Started with Claude Code

This project requires careful attention to the design system and user experience patterns outlined in the wireframes. The core innovation is in the coordination layer, not the marketplace mechanics.

Focus on:
- Implementing the structured offer flow correctly
- Building reliable event-based matching
- Creating clear "your turn" states
- Maintaining the restrained, editorial design aesthetic

Do not add:
- Chat/messaging features
- Online payment processing  
- Complex discovery algorithms
- Gamification elements
- Social features beyond reputation

The goal is to solve the coordination problem, not build another marketplace.

## Syntax Checking (MANDATORY)

After writing or editing any `.html` file, always run:
```bash
node check-syntax.js <file.html>
```
from the project root. This validates all `<script type="text/babel">` blocks with `@babel/parser` (JSX + TypeScript plugins).

The PostToolUse hook in `~/.claude/settings.json` runs this automatically on every `Write` to an `.html` file. If it exits non-zero, fix the reported error before proceeding — do NOT skip or ignore the check.

Common JSX pitfalls to avoid:
- Apostrophes inside single-quoted JS strings within JSX: use `"you're"` or `{`you're`}` instead of `'you're'`
- Unescaped `<` or `>` inside JSX text: use `&lt;` / `&gt;`
- Unterminated template literals or ternary chains
