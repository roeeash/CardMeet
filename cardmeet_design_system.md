# CardMeet — Design System Instructions

> A reference document for designing new CardMeet screens, marketing assets, and components. Hand this to a designer or paste it into any AI tool (Claude, GPT, etc.) along with the request "design a new CardMeet screen for X" and the output should feel native to the product.

---

## 1. Brand Premise

CardMeet is a **coordination layer**, not a marketplace. It's the calm, structured antidote to the chaos of selling cards via social-media DMs. The design must feel:

- **Considered, not flashy.** Like a well-designed notebook, not a flashy app.
- **Editorial, not corporate.** Magazine-influenced typography. Confident, slightly literary voice.
- **Quiet, with one clear accent.** Mostly neutral palette with a single decisive blue.
- **Human, not cute.** No mascots, no emoji-heavy UI, no playful illustration. Restrained.

If a design feels like it could be for a SaaS dashboard, it's wrong. If it feels like it could be for a curated shop, an indie publishing platform, or a thoughtful product magazine, it's right.

---

## 2. Typography

Three typefaces. All free via Google Fonts.

### Display & Editorial — `Fraunces`

A contemporary serif with optical sizing and an italic that feels handwritten. Used for headlines, screen titles, prices, and any moment that should feel considered.

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&display=swap" rel="stylesheet">
```

**Weights to load:** 400, 500, 600, 700 (italic for emotional/editorial moments).

**Use for:**
- Page headlines (weight 500–600, letter-spacing -0.02 to -0.035em)
- Section titles, card titles, prices
- Numbers that deserve presence (the radius display, prices, step counters)
- Italic in pull quotes and emotive phrases — *"meet at the convention you were already going to"*

**Don't use for:**
- Body text
- Form inputs
- Code-like or metric content

### Body & UI — `Inter`

Clean, neutral, optimized for screens. Used for everything that's read in volume: paragraphs, button labels, list items, navigation.

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Weights to load:** 400, 500, 600, 700.

**Use for:**
- All body copy
- Buttons, form fields, navigation
- Card descriptions, list items
- Anything more than ~10 words

### Mono & Metric — `JetBrains Mono`

A modern monospace. Used for any text that's *systemic* rather than *narrative* — labels, statuses, timestamps, technical metadata.

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**Weights to load:** 400, 500, 600.

**Use for:**
- Section eyebrows ("SCREEN 03", "PROBLEM 01")
- Field labels ("YOUR LOCATION", "WHEN")
- Pill text, statuses ("CHECKED IN", "YOUR TURN")
- Timestamps, distances, units ("75 KM", "2H AGO")

**Style note:** Always uppercase with letter-spacing 0.1–0.18em for these uses. The mono + uppercase + spacing combo signals "this is metadata, not content."

### Combined Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;  /* default */
font-family: 'Fraunces', Georgia, serif;                               /* display */
font-family: 'JetBrains Mono', 'Menlo', monospace;                     /* metric */
```

---

## 3. Color System

A neutral palette with one accent. Restraint is the point.

### Tokens (CSS variables)

```css
:root {
  /* Ink scale — neutrals, used for 95% of text */
  --ink:        #14141a;   /* near-black for body text and primary buttons */
  --ink-2:      #3a3a45;   /* secondary text, sub-headlines */
  --muted:      #767685;   /* tertiary text, metadata, placeholders */
  --line:       #e6e6ec;   /* borders, dividers, faint structures */

  /* Paper scale — warm-neutral backgrounds */
  --paper:      #f7f6f2;   /* primary canvas (slight warm cast — NOT pure white) */
  --paper-2:    #fbfaf6;   /* slightly lighter card surfaces */

  /* Accent — used sparingly for action and emphasis */
  --accent:      #2c4cff;  /* primary action, links, "shared convention" indicator */
  --accent-soft: #e8edff;  /* tinted backgrounds for accent contexts */

  /* Status — semantic only, never decorative */
  --good:       #15803d;   /* checked-in, going, success */
  --good-soft:  #d6f0de;
  --warn:       #92400e;   /* "your turn", action-needed */
  --warn-soft:  #fef0c7;
  --bad:        #991b1b;   /* no-shows, cancellations */
  --bad-soft:   #fde2e2;
}
```

### Usage Rules

1. **Backgrounds are warm, not pure white.** `--paper` (#f7f6f2) is the canvas. White (#ffffff) is reserved for elevated surfaces (cards, the phone frame interior).
2. **Text is `--ink`, not pure black.** Pure black is harsh against the warm paper.
3. **Accent appears at most once or twice per screen.** A button. A link. A "shared convention" badge. Never as decoration.
4. **Status colors only mean what they say.** Don't use `--good` to make something look nice. It must indicate success.
5. **The dark mode equivalent uses `--ink` as the canvas with white type at 70% opacity for body, full opacity for headlines.**

### Do Not Use

- Purple gradients on white (the AI-generated default).
- Multiple accent colors on the same screen.
- Pastel rainbow palettes.
- Fully saturated reds/greens — always use the `--*-soft` variants for backgrounds, the strong variants for text/borders only.

---

## 4. Spacing & Type Scale

### Spacing scale (in pixels — 4px base)

```
4   8   12   16   20   24   32   40   48   56   72   80   120
```

Common pairings:
- Card internal padding: `12px` (mobile), `14–16px` (desktop)
- Card-to-card gap: `8–12px` (mobile), `16–24px` (desktop)
- Section vertical padding: `80–120px` (desktop), `48–80px` (mobile)
- Stack gap inside a form: `14–16px`

### Type scale

| Use | Font | Weight | Size | Line-height | Letter-spacing |
|-----|------|--------|------|-------------|----------------|
| Hero headline | Fraunces | 500 | 56–76px | 1.0–1.05 | -0.03em |
| Section title | Fraunces | 500 | 32–52px | 1.05–1.1 | -0.025em |
| Screen title | Fraunces | 600 | 19–32px | 1.1–1.2 | -0.015em |
| Card title | Fraunces | 600 | 14–16px | 1.2 | -0.01em |
| Body | Inter | 400 | 14–15px | 1.55–1.65 | 0 |
| Button | Inter | 600 | 13px | 1 | 0 |
| Eyebrow / metric | JetBrains Mono | 500–600 | 10–11px | 1 | 0.12–0.18em (UPPERCASE) |
| Italic emphasis | Fraunces italic | 400 | matches context | matches context | matches context |

### Border radius scale

```
6px   small (card images, mini chips)
8–10px  inputs, list cards, mini details
12–14px main cards, banners
16–24px large containers, hero sections
36px    phone frames
100px   pills and full-rounded buttons
```

---

## 5. Component Patterns

### Buttons

Three roles, never more:

```html
<!-- Primary: dark ink, white text. The single CTA per screen. -->
<button class="btn btn-primary">Confirm meetup</button>

<!-- Secondary: paper background, ink text, line border. The alternate. -->
<button class="btn btn-secondary">Edit</button>

<!-- Ghost: transparent, accent text, soft accent border. The escape hatch. -->
<button class="btn btn-ghost">Withdraw</button>
```

Pill-rounded (100px) for marketing/landing CTAs. 10px-rounded for in-app utility buttons.

### Pills

Semantic, mono, uppercase, spaced. Used for statuses and tags.

```html
<span class="pill pill-good">Going</span>
<span class="pill pill-warn">Your turn</span>
<span class="pill pill-accent">Shared con</span>
```

### Cards

Always `background: white`, `border: 1px solid var(--line)`, `border-radius: 12px`, `padding: 12–16px`. Cards stack with 8–12px gaps. No drop shadows in-app — shadows are reserved for elevated marketing surfaces (phone frames, the floating signup form).

### Eyebrow + Title pattern

The signature pattern for any new section:

```html
<div class="section-eyebrow">— Some short framing</div>
<h2 class="section-title">A statement <em>with an italic emotional pivot.</em></h2>
```

Eyebrow is JetBrains Mono, uppercase, muted. Title is Fraunces, with one phrase italicized to add emotional weight — preferably the part that names the human truth ("you were already going to", "shouldn't feel like chasing ghosts").

### Phone frame (for marketing)

Always 280–320px wide × 540–660px tall. 1.5px ink border. 36px border-radius. Subtle shadow: `0 4px 12px rgba(20, 20, 26, 0.06), 0 24px 48px rgba(20, 20, 26, 0.12)`. Status bar uses JetBrains Mono. Header has Fraunces title + Inter sub.

---

## 6. Voice & Copy

### Principles

1. **Direct, never cute.** "Stop chasing buyers" — not "Say goodbye to ghosting!"
2. **One human truth per surface.** Each screen, section, or hero has exactly one sentence that names a real feeling. The rest supports it.
3. **Concrete, not generic.** "Sat May 23 · 13:00–13:30" not "Schedule your meetup." "0 no-shows" not "Reliable seller."
4. **Italics carry emotion.** Use the Fraunces italic to lean into emotional or interpretive phrases. Don't italicize for emphasis on data.
5. **Mono labels are systemic, not decorative.** "WINDOW (COMMITMENT)" only goes above a piece of structured data, never above prose.

### Words we use

- **commitment**, **window**, **shared convention**, **your turn**, **check in**, **match**, **listing**, **counter**, **withdraw**

### Words we don't use

- "Discover", "seamless", "effortless", "unlock", "elevate" (corporate-speak)
- "Awesome", "amazing", "rockstar" (too casual)
- "Buyer/seller persona", "stakeholder" (jargon)
- Excess exclamation points

### Tone examples

- **Hero**: "Meet at the convention *you were already going to.*"
- **Empty state**: "No deals yet. Browse the feed and make your first offer."
- **Error**: "We couldn't reach the server. Check your connection and try again."
- **Success**: "Match confirmed. You and Daniel are meeting at GP Tel Aviv on May 23."
- **Push notification**: "Daniel countered ₪240 — your turn."

Notice: no exclamation points except where genuinely warranted (a true match notification might use one). No "Yay!" or "Hooray!" Confirmation reads as factual, not celebratory.

---

## 7. Motion & Interaction

### Principles

- **CSS-only when possible.** Hover transforms, transitions on backgrounds and borders.
- **Subtle, not theatrical.** Most interactions are 100–200ms. Page-level reveals can use 400ms staggers.
- **Pulse for live state.** A subtle pulse animation on the green "we're live" dot in the hero, on the "your turn" indicator, anywhere that signals presence.

### Common transitions

```css
/* Button press */
transition: transform 0.1s;
&:hover { transform: translateY(-1px); }

/* Input focus */
transition: border-color 0.15s;
&:focus { border-color: var(--ink); }

/* Phone stack hover (landing page) */
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

### What we avoid

- Bouncing animations (cute but distracting).
- Confetti on success.
- Multiple things animating in at once on page load.
- Parallax effects.

---

## 8. Iconography

CardMeet doesn't use a custom icon set. We use:

- **Native emoji** sparingly and only for spatial/contextual cues: 📍 for location, 📅 for date/convention, ⚡ for urgency ("your turn"), ✓ for confirmed states.
- **Geometric primitives** for tab bars: a square, a circle, a diamond. Drawn with 1.5px borders, 18px size.

No Material Icons. No Font Awesome. No Lucide. The restraint is intentional — adding a third visual language (after typography and color) would crowd the system.

---

## 9. Design Patterns Specific to CardMeet

These are the patterns that define the product. Always preserve them when designing new screens.

### "Your turn" / "Their turn" banners

Every screen showing a deal, offer, or commitment has a single banner at the top stating whose turn it is. Yellow (`--warn-soft`/`--warn`) when it's the user's turn; muted grey (`--paper`/`--muted`) when waiting. This pattern eliminates ambiguity and is the design solution to the "lost in chat" problem.

### Shared convention badge

The accent-colored, mono-typed tag that appears anywhere a buyer and seller will both attend an event. Format: `📅 BOTH @ EVENT NAME`. Always in `--accent-soft` background with `--accent` text. This is the product's most important signal — surface it prominently.

### Commitment window (not a single time)

Times in CardMeet are always presented as windows: "13:00 – 13:30", not "13:00". This visual pattern reinforces the no-show logic (you're committing to a window, not a moment) and absorbs the natural messiness of conventions. Always use the format `HH:MM – HH:MM`.

### No-show count visible at first glance

Wherever a seller/buyer profile is shown, the no-show count appears beside the rating. Format: `★★★★★ 4.9 · 23 deals · 0 no-shows`. Never hidden. Never collapsed.

### Three-tab "My Deals" structure

Negotiating / Matched / Scheduled. Always in this order. Always with live counts in the tab labels. Completed deals live elsewhere — this view is for active business.

---

## 10. What "AI Slop" Looks Like (And How To Avoid It)

If your design has any of these, start over:

- ❌ Purple-to-pink gradient on a white background
- ❌ Inter for headlines (use Fraunces)
- ❌ Generic "Get started" CTA on the hero
- ❌ Three-card "Features" grid with checkmarks
- ❌ Stock-photo person looking at a phone
- ❌ Multiple accent colors per screen
- ❌ Drop shadows on every card
- ❌ Centered everything
- ❌ "Trusted by" logo wall (we don't have one)
- ❌ Statistics with "+" symbols ("10,000+ users")
- ❌ Robot/AI emoji or imagery
- ❌ "Sleek", "intuitive", "powerful", "next-generation" anywhere

If your design has these, it's correct:

- ✅ Warm paper background, near-black ink
- ✅ Fraunces serif headlines with one italicized phrase
- ✅ JetBrains Mono labels in uppercase with letterspacing
- ✅ A single blue accent appearing at most twice per screen
- ✅ Phone mockups showing real, specific data (not "User Name", not "Lorem ipsum")
- ✅ Asymmetric grids, generous whitespace
- ✅ Editorial-feeling section eyebrows ("— The status quo is broken")
- ✅ One human-truth sentence per major surface

---

## 11. Quick-start Snippet

Drop this into any HTML file to start a new CardMeet screen instantly correct:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --ink: #14141a;  --ink-2: #3a3a45;  --muted: #767685;  --line: #e6e6ec;
  --paper: #f7f6f2;  --paper-2: #fbfaf6;
  --accent: #2c4cff;  --accent-soft: #e8edff;
  --good: #15803d;  --good-soft: #d6f0de;
  --warn: #92400e;  --warn-soft: #fef0c7;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: var(--paper);
  color: var(--ink);
  line-height: 1.55;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { font-family: 'Fraunces', serif; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); font-weight: 500; }
.btn-primary { background: var(--ink); color: white; padding: 12px 20px; border-radius: 100px; font-family: inherit; font-weight: 600; border: none; cursor: pointer; }
</style>
</head>
<body>
  <!-- Your screen here -->
</body>
</html>
```

---

## 12. Asking Claude (or Another AI) To Design A New Screen

Use a prompt template like this:

> Using the CardMeet design system (Fraunces serif headlines on warm paper #f7f6f2 background, JetBrains Mono for labels in uppercase with 0.16em letterspacing, Inter for body, single #2c4cff accent, "your turn" banners in `--warn-soft`, eyebrow-then-title sections with one italicized phrase per headline, no purple gradients, no Inter for display, no AI-slop), design a new screen for [SPECIFIC USE CASE]. Show me the HTML/CSS in a single file, with realistic data (specific card names, prices in ₪, real convention names like GP Tel Aviv).

Paste this design instruction file into the system context if the model is having trouble. The longer the conversation, the more drift — re-anchor with the file as needed.

---

*Last updated: v1 wireframe set + landing page complete. Next surfaces to design: post-listing flow, profile page, post-meetup confirmation, push-notification copy.*
