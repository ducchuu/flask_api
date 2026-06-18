# Pulse — Frontend Theme & Design Decisions

This document captures the visual direction for the Pulse frontend before any UI code is written. It exists so design decisions are made once, deliberately, and then followed consistently — directly addressing the rubric's "Consistent Template" and "Color Palette" requirements.

## Reference

Visual direction is closely modeled on a smart-home dashboard reference (Fireart Studio, Dribbble): dark glassmorphism cards, soft shadows, rounded corners, generous whitespace, a calm blue-gray base with a single saturated accent color reserved for primary actions and live/active states.

We are keeping the same *vibe* — frosted translucent panels, soft depth, rounded widget cards arranged in a dashboard grid — but replacing the smart-home content (rooms, devices, AC controls) with Pulse's actual content (source types, stories, stats, interests).

## Mapping reference → Pulse

| Reference UI element | Pulse equivalent |
|---|---|
| "Living Room / Bedroom / Kitchen" room tabs | "News / Video / Discussion" source-type tabs |
| Device cards (light, AC, speaker) | Item cards (article, video, discussion post) |
| Now-playing music widget | "Trending story" widget — top clustered story right now |
| Temperature / humidity / air quality stats | Stats cards — item count, source breakdown, sentiment |
| Greeting header ("Hi Isabella, have a great day") | Greeting header ("Hi {username}, here's what's happening") |
| Toggle switches for devices | Toggle filters for source types / read-later / saved |

## Theme modes

The app ships with **both light and dark mode**, switchable via a toggle in the navigation bar. Preference is stored client-side and respected on reload. Dark mode is the primary/default design target since it matches the reference most closely; light mode is a derived palette using the same hues at adjusted lightness, not a separate design.

## Color palette

Chosen for a news/media dashboard: a desaturated blue-gray base (calm, readable, doesn't compete with thumbnails/images in cards) with a warm coral-orange accent (alert, lively, distinct from typical "tech blue" — gives Pulse its own identity) and a teal secondary accent for positive/live states.

### Dark mode (default)

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0F1419` | App background |
| `--bg-surface` | `#1A2128` | Base card surface (before glass blur) |
| `--bg-glass` | `rgba(255,255,255,0.04)` | Glassmorphism card fill |
| `--border-glass` | `rgba(255,255,255,0.08)` | Card borders |
| `--text-primary` | `#F4F6F8` | Headings, primary text |
| `--text-secondary` | `#9AA5B1` | Captions, metadata, timestamps |
| `--accent-primary` | `#FF6B4A` | Primary actions, active tab, CTA buttons |
| `--accent-secondary` | `#3DD6B4` | Live/positive states, success, "trending now" |
| `--accent-info` | `#5B8DEF` | Links, info badges, video source tag |
| `--source-news` | `#5B8DEF` | News source-type tag |
| `--source-video` | `#FF6B4A` | Video source-type tag |
| `--source-discussion` | `#3DD6B4` | Discussion source-type tag |
| `--danger` | `#EF5B5B` | Errors, destructive actions |

### Light mode

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#F4F6F8` | App background |
| `--bg-surface` | `#FFFFFF` | Base card surface |
| `--bg-glass` | `rgba(15,20,25,0.03)` | Glassmorphism card fill |
| `--border-glass` | `rgba(15,20,25,0.08)` | Card borders |
| `--text-primary` | `#14181D` | Headings, primary text |
| `--text-secondary` | `#5B6470` | Captions, metadata |
| `--accent-primary` | `#E85A3B` | Primary actions (darkened for AA contrast on white) |
| `--accent-secondary` | `#1FA98A` | Live/positive states |
| `--accent-info` | `#3D6FD1` | Links, info badges |
| `--source-news` | `#3D6FD1` | News source-type tag |
| `--source-video` | `#E85A3B` | Video source-type tag |
| `--source-discussion` | `#1FA98A` | Discussion source-type tag |
| `--danger` | `#D14343` | Errors, destructive actions |

All accent-on-background pairs above meet WCAG AA contrast (4.5:1) for normal text.

## Typography

- **Headings:** Inter (or system sans-serif fallback) — semi-bold, slightly tight letter-spacing, matches the clean geometric feel of the reference's "Hi Isabella" greeting text.
- **Body:** Inter, regular weight.
- **Numerals/stats:** tabular figures (`font-variant-numeric: tabular-nums`) so stat cards don't jitter when values update.

## Card & surface style (glassmorphism)

Every card follows the same recipe so the UI never feels collage-like:

```css
background: var(--bg-glass);
border: 1px solid var(--border-glass);
border-radius: 20px;
backdrop-filter: blur(16px);
box-shadow: 0 8px 32px rgba(0,0,0,0.24); /* dark mode */
box-shadow: 0 8px 32px rgba(15,20,25,0.06); /* light mode */
```

Corner radius scale: `12px` (small chips/tags) → `20px` (cards) → `28px` (modals/large panels). Never mix radii within the same visual hierarchy level.

## Layout grid

- Dashboard-style grid, same bone structure as the reference: a left/primary content column (feed, stories) + a right rail (stats widgets, trending, profile).
- 12-column responsive grid, collapsing the right rail below the primary content on tablet, and collapsing to a single column with a bottom tab bar on mobile.

## Pages this theme must hold up across

(per the assignment's required pages — same template, no exceptions)

1. Landing page
2. Login / Register
3. Feed (search page w/ filters: source_type, interest, date window)
4. Item detail page
5. Stats dashboard (charts: by source_type, by day, by interest)
6. Interests (CRUD)
7. Collections (CRUD)
8. Profile / settings (incl. theme toggle)

## Open decisions for next doc (component/page planning)

- Icon set (likely Lucide, pairs well with React)
- Chart library for stats page (Recharts recommended — maps cleanly onto `/api/items/stats` response shape)
- Whether trending story widget pulls from `/api/stories` live or is a static "most recent" placeholder for v1
