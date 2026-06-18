# Pulse — Page & Component Breakdown

Companion to `THEME.md`. Where THEME.md defines *how things look*, this document defines *what exists on each page* and *which backend endpoint feeds it*. Read both before building any page in Claude Code.

## Route map

| Route | Page | Auth required |
|---|---|---|
| `/` | Landing | No |
| `/login` | Login | No |
| `/register` | Register | No |
| `/feed` | Feed (post-login landing page) | Yes |
| `/items/:id` | Item detail + story cluster | Yes |
| `/stats` | Stats dashboard | Yes |
| `/library` | My Stuff (Interests + Collections, tabbed) | Yes |
| `/profile` | Profile / settings | Yes |

Unauthenticated users hitting any `Yes` route are redirected to `/login`. After successful login, users land on `/feed` directly (not a dashboard) — feed *is* the home.

---

## 1. Landing (`/`)

**Purpose:** rubric-required overview page before login. Marketing-style, not functional.

**Components:**
- `NavBar` (logged-out variant: Login / Register buttons, theme toggle)
- `Hero` — headline, one-line value prop, CTA button → `/register`
- `FeatureGrid` — 3–4 cards explaining: multi-source aggregation, transparent scoring, story clustering, personal interests
- `Footer` — minimal, course/project credit line

**Data:** none — fully static.

---

## 2. Login (`/login`) & Register (`/register`)

**Purpose:** auth entry points.

**Components:**
- `AuthCard` — centered glass card, shared between both pages
- `AuthForm` — username + password fields (+ confirm password on register)
- `FormFieldError` — inline validation feedback per field
- `AuthCard` footer link to switch between login/register

**Data:**
- Login → `POST /api/tokens`
- Register → `POST /api/users`

**Feedback requirements (rubric: "UI Feedback"):**
- Disable submit button + show spinner while request is in flight
- `401` on login → inline message "Invalid username or password" (matches backend's no-enumeration design — don't say which was wrong)
- `409` on register → inline message "Username already taken"
- `400` → inline per-field message
- On success: store token, redirect to `/feed`

---

## 3. Feed (`/feed`) — the search/query page

This is the rubric's required **Search Page with ≥3 filters**.

**Components:**
- `NavBar` (logged-in variant: Feed / Stats / Library / Profile links, theme toggle, logout)
- `FilterBar` — the ≥3 filters:
  1. `source_type` — tab-style toggle (All / News / Video / Discussion), mirrors the reference's room-tabs
  2. `interest_id` — dropdown of the user's interests
  3. `window` — segmented control (24h / 7d / 30d)
  4. (bonus 4th) `sort` — Relevance / Recency toggle
- `SearchInput` — free-text `q` filter, debounced
- `ItemGrid` — responsive card grid
- `ItemCard` — thumbnail-less glass card: source-type tag (colored per THEME.md), title, summary excerpt, credibility tier badge, relevance score bar, published time, click → `/items/:id`
- `Pagination` or infinite scroll (`page` / `per_page`)
- `EmptyState` — shown when filtered results are `[]` ("No items match these filters yet")
- `LoadingSkeletons` — card-shaped skeletons while fetching

**Data:** `GET /api/items?source_type=&interest_id=&q=&window=&sort=&page=&per_page=`

**Feedback requirements:**
- Changing any filter shows skeleton loaders, not a blank flash
- `429`/`502` from this endpoint → a dismissible banner: "Some sources are temporarily unavailable — showing what we have" (this is where your Phase 2 partial-failure work becomes visible in the UI)
- Empty `[]` result is a calm empty state, never treated as an error

---

## 4. Item Detail (`/items/:id`)

Rubric's required **Detail Result Page**. Per your choice: item first, full story cluster below.

**Components:**
- `ItemDetailHeader` — title, source, author, published date, external link out
- `ScoreBreakdown` — visual bar chart of the four score components (interest/recency/popularity/source) — this directly satisfies the backend's "transparency requirement" (score + score_breakdown) and the rubric's "Visualization" requirement
- `FeedbackButtons` — "More like this" / "Less like this" / "Hide" → `POST /api/feedback`
- `SaveToCollectionButton` — opens `CollectionPicker` modal → `PUT /api/collections/:id/items/:item_id`
- `StoryClusterSection` — header "Part of a larger story: {story.title}", horizontal scroll or grid of the other clustered items
- `ItemCard` (reused from Feed) for each clustered item

**Data:**
- `GET /api/items/:id`
- `GET /api/stories/:id` (using the item's `story_id`) for the cluster section
- `POST /api/feedback`, `PUT /api/collections/:id/items/:item_id` on interaction

**Feedback requirements:**
- `404` (bad id) → friendly "This item no longer exists" page with a link back to `/feed`, not a raw error
- Feedback button clicks show a brief toast confirmation ("Got it, we'll show you more like this")

---

## 5. Stats Dashboard (`/stats`)

Rubric's required **Visualization** component, directly powered by your Phase 2 backend work.

**Components:**
- `StatsTabBar` — switches the `by=` mode: Source Type / Interest / Day
- `SourceTypeChart` — donut/bar chart (Recharts), colored using `--source-news` / `--source-video` / `--source-discussion` tokens from THEME.md
- `InterestChart` — horizontal bar chart, one bar per interest
- `DayChart` — line chart, time series, supports zoom/brush (rubric explicitly calls out zooming as a desired interaction)
- `TotalCard` — small glass stat card showing the `total` field
- `EmptyState` — "Not enough data yet — try following some interests" when `stats: []`

**Data:** `GET /api/items/stats?by=source_type|interest|day`

**Feedback requirements:**
- `429` → banner: "Stats temporarily unavailable due to rate limiting, try again shortly"
- `502` → banner: "Couldn't reach one of our sources right now"
- Switching tabs shows a brief chart-area skeleton, not a flash of empty chart

---

## 6. My Stuff (`/library`) — Interests + Collections, tabbed

**Components:**
- `LibraryTabBar` — "Interests" / "Collections"

**Interests tab:**
- `InterestList` — list of `InterestRow` (name, keyword chips, weight slider preview)
- `InterestFormModal` — create/edit (name, keywords as chip input, weight slider) → `POST` / `PUT /api/interests/:id`
- Delete with `ConfirmDialog` → `DELETE /api/interests/:id`

**Collections tab:**
- `CollectionGrid` — `CollectionCard` per collection (name, description, item count)
- `CollectionFormModal` — create/edit → `POST` / `PUT /api/collections/:id`
- Clicking a collection expands/navigates to its saved `ItemCard`s
- Remove item from collection → `DELETE /api/collections/:id/items/:item_id`

**Data:**
- `GET/POST/PUT/DELETE /api/interests`
- `GET/POST/PUT/DELETE /api/collections`
- `PUT/DELETE /api/collections/:id/items/:item_id`

**Feedback requirements:**
- Full CRUD round-trip feedback: optimistic UI update + toast on success, rollback + error toast on failure
- `409`/`400` validation errors shown inline on the form, not just a toast

---

## 7. Profile (`/profile`)

**Components:**
- `ProfileForm` — username (editable), created_at (read-only)
- `WeightsEditor` — sliders for the four scoring weights (interest/recency/popularity/source) stored in `weights_json` — lets the user tune their own relevance algorithm, a nice "beyond minimum requirements" touch
- `SourcePrefsEditor` — sliders for `source_prefs_json` (news/video/discussion preference)
- `ThemeToggle` — light/dark, same component used in `NavBar`, duplicated here for discoverability

**Data:** `GET /api/users/me`, `PATCH /api/users/me`

**Feedback requirements:**
- Slider changes save on release (not on every pixel of drag) with a small "Saved" pulse indicator
- `409` on username change → inline "Username already taken"

---

## Shared/global components

| Component | Used on | Notes |
|---|---|---|
| `NavBar` | every page | logged-in/out variants per THEME.md layout grid |
| `ThemeToggle` | NavBar + Profile | persists to localStorage, respects system preference on first load |
| `Toast` | global | success/error/info variants, auto-dismiss |
| `ErrorBanner` | Feed, Stats | for 429/502 upstream warnings specifically — distinct from Toast since these are non-blocking and persistent until dismissed |
| `ConfirmDialog` | Library (delete actions) | |
| `LoadingSkeleton` | Feed, Stats, Item Detail | shape varies per context |
| `ApiClient` (not visual) | everywhere | single module wrapping `fetch`, attaches `Authorization: Bearer`, parses the `{"error": {"code","message"}}` envelope uniformly |

## Error → UI mapping (single source of truth)

| Backend code | UI treatment |
|---|---|
| `400 BAD_REQUEST` | Inline field error on the form that triggered it |
| `401 UNAUTHORIZED` | Force redirect to `/login`, clear stored token |
| `404 NOT_FOUND` | Dedicated "not found" state on detail pages, never a blank screen |
| `409 CONFLICT` | Inline field error ("already taken") |
| `429 RATE_LIMITED` | Persistent dismissible `ErrorBanner`, page still renders whatever data it has |
| `502 BAD_GATEWAY` | Persistent dismissible `ErrorBanner`, page still renders whatever data it has |

This table is what makes the "Phase 2 polish" backend work actually visible and valuable in the frontend — without it, 429/502 would just look like generic broken pages.

## Build order suggestion for Claude Code

1. `ApiClient` + auth flow (Login/Register) + route guarding
2. `NavBar` + `ThemeToggle` + Landing page (cheap, static, builds confidence in the design system)
3. Feed page (the most complex page — filters, grid, loading/empty/error states)
4. Item Detail page (reuses `ItemCard`, introduces `ScoreBreakdown`)
5. Stats dashboard (introduces chart library)
6. My Stuff (CRUD-heavy, reuses modal/form patterns)
7. Profile

Building Feed early is deliberate — nearly every shared pattern (cards, filters, skeletons, error banners) gets established there and just gets reused afterward.
