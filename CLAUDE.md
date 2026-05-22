# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build system or package manager. Open `index.html` directly in a browser, or serve locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Architecture

Vanilla JS, ES modules. No framework, no bundler, no dependencies beyond Font Awesome (CDN) and a country-flag-emoji polyfill (lazy-loaded only on Windows).

The codebase is split into three module folders plus a thin orchestrator at the root:

```
/
├── index.html
├── app.js              ← orchestrator: imports, init(), refreshAll(), wireDomHandlers()
├── lookups.js          ← classic-script globals: SPORT_COLORS, SPORT_ICONS, FLAGS, …
├── CLAUDE.md
├── assets/             ← shipped as-is: Stake_logo.svg, favicon-32x32.webp, tournaments.csv
├── styles/             ← split CSS, loaded in cascade order:
│   ├── base.css        ← :root design tokens, reset, header, search, layout
│   ├── sidebar.css     ← timeline sidebar + filter button + filter panel
│   ├── timeline.css    ← timeline rows/bars/markers + tooltip + mobile + view-toggle
│   ├── cw-views.css    ← calendar, weekly, match panel, cw-sidebar shared
│   └── overlays.css    ← promotions, bar fav buttons, settings panel, version badge
├── core/               ← shared foundation
├── features/           ← stateful feature modules
└── views/              ← DOM-rendering modules
```

**CSS organisation.** Five files loaded as separate `<link>` tags in `index.html` (HTTP/2 parallelises them). Each is a consecutive slice of the original `style.css`, so the cascade order matches what the app had before the split. **Design tokens** (`--bg`, `--text`, `--accent-gold`, `--t-fast`, `--r-md`, …) live at the top of `base.css` under `:root` — use them in new styles rather than re-hardcoding hex values or spacing constants.

**Module folders at a glance:**

- `core/` — foundation reused everywhere. No DOM ownership, no feature state of its own.
  - `data.js` — live tournament data + loader (sheets, parsing, `effectiveCategory`).
  - `timeline-config.js` — layout constants (`DAY_PX`, `BAR_H`, …), timeline bounds, `dayOffset`.
  - `util.js` — `fmtDate`, `parseLocalDate`, `todayLocalStr`, `getColor` (with fallback palette).
  - `view-state.js` — `currentView` (live binding) and `setView()` choreography.
- `features/` — one folder per user-visible feature. Each owns its state, its persistence, and any panel/sidebar UI specific to that feature.
  - `favourites.js`, `top-revenue.js`, `promotions.js`, `match-panel.js`, `settings-panel.js`, `filters.js`, `cw-filters.js`, `search.js`, `keyboard.js`.
- `views/` — pure DOM-rendering modules called from the render pipeline.
  - `timeline-rows.js`, `month-headers.js`, `sidebar.js`, `calendar.js`, `weekly.js`, `tooltip.js`, `scroll.js`.

**Dependency rules** (enforced by convention, not by tooling):

- `core/*` can import from other `core/*` and from `lookups.js` globals.
- `features/*` can import from `core/*` and from other `features/*`.
- `views/*` can import from `core/*`, `features/*`, and other `views/*`.
- Nothing imports back into `app.js`. The orchestrator is a one-way sink.

**Mutable state via ES module live bindings.** Modules that own mutable state (`TOURNAMENTS`, `sortMode`, `currentView`, `showOnlyFavourites`, etc.) export the value as `let` and expose a setter (`setSortModeValue`, `setShowOnlyFavourites`, …) for cross-module writes. Consumers `import { thing }` and reads always see the latest value at access time. There is no runtime "deps-injection" pattern — every dependency is an explicit ES import.

**Inline HTML handlers.** None. `index.html` has no `onclick`/`oninput` attributes. All event wiring is done at init by `wireDomHandlers()` in `app.js` using `addEventListener`. Adding a new button means: give it an id, then add one line in `wireDomHandlers()`.

## Data flow

1. **`loadData()`** in `core/data.js` fetches four sheet tabs in parallel: Tournaments, Matches, SportCategories, Promotions. Each parsed row is mapped to a plain object; results populate the live bindings `TOURNAMENTS`, `MATCHES` (private), `SPORT_CATEGORIES`, plus `PROMOTIONS` via `buildPromotionsData()` in `features/promotions.js`.
2. **`computeTimelineBounds(TOURNAMENTS)`** sets `TIMELINE_START`/`END`/`TOTAL_DAYS`/`TOTAL_W` in `core/timeline-config.js`.
3. **`buildData()`** in `features/filters.js` populates `catData` (one entry per sport, with lane-packed events) and clears the lazy `_countryData` cache.
4. **`computeTopRevenueSports()`** builds `topRevenueSports` (Set) from flagged `SPORT_CATEGORIES` rows.
5. **`renderAll()`** in `app.js` then calls every `build*` function in order: header date, month headers, promo rail, sidebar, timeline rows, cw-sidebar, plus the current cw view if applicable.

Both `init()` (first load) and `refreshAll()` (every 15 minutes, see [Auto-refresh](#auto-refresh)) go through `refreshData()` → `renderAll()` so there is one canonical pipeline.

## Data source

Tournament data is fetched at runtime from a published Google Sheets CSV. Four tabs:

| Tab | Constant | Purpose |
|-----|----------|---------|
| Tournaments | `SHEET_URL_TOURNAMENTS` | One row per tournament/event/race. Populates `TOURNAMENTS`. |
| Matches | `SHEET_URL_MATCHES` | One row per individual match (linked to a parent tournament by name). Populates `MATCHES`. |
| SportCategories | `SHEET_URL_SPORT_CATEGORIES` | One row per sport, with a `toprevsport` yes/no flag. Drives top-revenue surfaces. |
| Promotions | `SHEET_URL_PROMOTIONS` | One row per promo (name, dates, linked tournaments / sport). Populates `PROMOTIONS`. |

All four URLs live in `core/data.js`. Edit the sheets, not `lookups.js`.

## Data shape

Each Tournaments-tab row produces a `TOURNAMENTS[]` entry. Key `format` values: `tournament`, `season`, `event`, `race`, `onedayevent`, `match`. The `match` format is excluded from `TOURNAMENTS` and tracked separately as a `MATCHES` entry linked to a parent tournament by name.

Rows may carry a `sub-category` field (e.g. Esports games like "VALORANT"); `effectiveCategory(ev)` returns `"Category (sub-category)"` for these — except for categories listed in `NO_SUBCATEGORY_SPLIT` (currently `Yachting`), which always collapse to the bare category name regardless of `sub-category`.

**Per-row flags** (CSV columns on the Tournaments tab, value = `"yes"` to enable):

- `highlight` → `ev.highlight`. Affects: (a) single-day event marker — highlighted events render as a gold ★, non-highlighted as a monochrome sport-icon tick; (b) multi-day bars get a gold border + shimmer (`.bar-highlight`); (c) calendar/weekly event names get gold styling (`.cal-event-highlight`, `.week-event-highlight`).
- `toppin` → `ev.topPin`. Pins the tournament to the **top header rail** above the timeline (gold "★ Name" pill with vertical tick to start date). Works for any `format`. Header rail is exclusively driven by this flag.

## Features

### Favourites

User-starred tournaments, keyed per-edition by `${name}|${startDate}` so 2026 and 2027 editions are distinct.

- State in `features/favourites.js`: `favourites` (Set), `showOnlyFavourites` (bool). Persisted to `localStorage` as `mjr_favourites` (array) and `mjr_fav_only` (`'0'|'1'`).
- API: `isFavourite(ev)`, `toggleFavourite(ev)`, `loadFavourites()`, `saveFavourites()`, `saveFavOnly()`, `setShowOnlyFavourites(v)`.
- Surfaces:
  - Bar ⭐ button (`.bar-fav-btn`) on multi-day timeline bars when `widthPx >= 58`. Adds `.has-fav` to reserve right padding.
  - "My favorite events only" toggle in the timeline filter panel and the cw-sidebar's `#cwSpecialFilters` section.
  - Settings panel section (`features/settings-panel.js`) — alphabetical list with per-row unstar + "Clear all".
- Filter wiring: `getSortedCatData`, `getSortedCountryData`, `getFilteredTournaments` all honour `showOnlyFavourites`.

### Top revenue sports

Sourced from the `SportCategories` sheet tab. The tab has two columns: `category` (must match `effectiveCategory(ev)` output, e.g. `Tennis`, `Esports`) and `toprevsport` (`yes`/blank).

Failure to fetch is non-fatal — the feature simply hides itself.

After `loadData()`, `SPORT_CATEGORIES = [{ category, topRevSport }, …]` in `core/data.js`. `computeTopRevenueSports()` in `features/top-revenue.js` then builds `topRevenueSports` (Set) by **expanding** each flagged row to every event whose raw `ev.category` OR rendered `effectiveCategory(ev)` matches — so a sheet entry of `Esports` covers `Esports (VALORANT)`, `Esports (CS2)`, etc. without needing a row per game.

Surfaces:
- Gold `$` icon next to the sport in the timeline sport-mode sidebar, the timeline filter panel sport list, and the cw-sidebar Sport list.
- In both filter panels, top-revenue sports float to the top under a "Top revenue" header; the rest under "Other sports".
- "Top revenue sports only" toggle (`showOnlyTopRevenue`, persisted to `mjr_top_rev_only`) in both filter panels. Filters all three views via `getSortedCatData`, `getSortedCountryData`, `getFilteredTournaments`. Toggle hides itself if `topRevenueSports.size === 0`.

### Promotions

Sport-trading-team feature: manually-created promos (e.g. "EPL refund if your team loses in 90th minute"). Owned by `features/promotions.js`. Sourced from the `Promotions` sheet tab.

**Sheet columns** (one row per promo):
- `name` — promo name (required).
- `description` — what the promo offers (free text).
- `startdate`, `enddate` — `YYYY-MM-DD`.
- `linkedtournaments` — pipe-delimited tournament names matching `TOURNAMENTS[].name` (e.g. `Wimbledon 2026 | US Open 2026`). Optional when `sport` is set.
- `sport` — applies the promo to every tournament whose raw `category`, `subCategory`, or rendered `effectiveCategory()` matches this string (case-insensitive). Optional when `linkedtournaments` is set. **At least one of `linkedtournaments` or `sport` is required** — promos with neither are dropped at parse time.

Failure to fetch is non-fatal — rail and badges simply don't render.

**Parsing:** `buildPromotionsData()` populates `PROMOTIONS = [{ name, description, startDate, endDate, linkedTournaments, sport }]`. Every row is shown — past, present, and future. The only parse-time filter is structural validity. `PROMOTIONS_BY_TOURNAMENT` is a lowercase-keyed map (private to the module) for O(1) badge lookup; sport-wide promos are expanded across all matching tournaments at build time (deduped per tournament).

**Surfaces:**
- **Timeline rail** (`#promoRail`, `buildPromoRail()`): sticky strip below `.months-header` with one pill per promo, positioned `startDate → endDate`. Overlapping promos lane-pack like the toppin rail. Past promos render at 45% opacity (`.promo-pill-past`); single-day icon-only pills get `.promo-pill-icon-only`.
- **Timeline bar badge** (`.bar-promo-btn`): small purple gift icon on tournament bars with linked promos. Only renders when `widthPx >= 58`. `.has-promo` reserves right padding; `.has-fav.has-promo` reserves more so the fav star and gift icon don't collide.
- **Calendar/Weekly badge** (`.cal-event-promo-badge`, `.week-event-promo-badge`): same gift icon inline in event rows for any tournament with linked promos. Hover shows promo list (`showBarPromoTooltip`).
- **Sidebar Promotions section** (`#sidebarPromoSection`): clickable label in the timeline sidebar at the same Y as the promo rail. Click opens the promo panel.
- **Promo panel** (`#promoPanel`): slide-in right panel with Active / Upcoming / Past grouping. Each promo as a card with name, description, dates, sport chip (cyan), and tournament chips (purple, click-to-navigate).
- **"Active promotions only" filter toggle**: in both filter panels. State is `showOnlyPromos`, persisted to `mjr_promo_only`. Hides itself when `PROMOTIONS.length === 0`. Wires into all three sorted-data getters and both filter-button badge counts.
- **`hasActivePromo(ev)`**: helper — `true` iff at least one linked promo's `startDate <= today <= endDate`.

`parseLinkedTournaments(str)` in `lookups.js` splits on `|`. Explicit choice so tournament names can safely contain commas, ampersands, or slashes.

### Settings panel

Right-side slide-in panel in `features/settings-panel.js`. Opened by the gear button in the header. Closed by × button, backdrop click, or Esc.

- Markup: `#settingsBackdrop` + `#settingsPanel` in `index.html`. Panel uses fixed positioning with a `transform: translateX(100%)` → `0` transition.
- Render flow: `openSettingsPanel()` → `renderSettings()` → `renderSettingsFavourites()` + `renderSettingsShortcuts()`. Add more sections by appending to `renderSettings()`.
- Favourites section: count + alphabetical list of starred tournaments (name + sport + dates + country), each with an unstar button that animates the row out then re-renders. "Clear all favorite events" button at the bottom uses native `confirm()`.
- After any change, the function calls `updateFilterBtn()`, `updateCwUI()`, `rebuildViews()`, and (if in calendar/weekly view) `rebuildCwView()` so the rest of the UI stays in sync.

### Search

`features/search.js`. Header search box. Matches against tournament `name`, `effectiveCategory()` (sport), and `country` via case-insensitive substring.

- **Action chips**: when the query matches a distinct sport or country, the dropdown prepends a "Filter to …" chip (up to 2 sports, 2 countries). Selecting a chip calls `applySearchFilter(kind, label)` in `features/filters.js`, which switches `sortMode` if needed, overrides `activeFilters` + `cwFilters`, and triggers a rebuild.
- **Tournament rows** follow (up to 7). On select they call `goToTournament()` which navigates per current view (`navigateToEvent` / `scrollToCalendarEvent` / `scrollToWeekEvent`).
- Keyboard nav covers chips + tournaments in document order via a unified `combinedItems` array.

### Match panel

`features/match-panel.js`. Slide-in panel in the Weekly view showing all matches for a tournament. Opened by clicking the "Matches loaded ›" link on a weekly row when the tournament has linked matches.

- Owns `_activeMatchTournament`. Exposed via `getActiveMatchTournament()` / `resetActiveMatchTournament()` so the Esc handler and the weekly-view rebuild can read/clear it.
- Closed by the × button or Esc (priority chain: promo panel → settings → match panel → view default).

## Views (the three top-level layouts)

| View | Container | Build fn | Sidebar |
|------|-----------|----------|---------|
| Timeline | `#mainView` | `buildSidebar` + `buildTimelineRows` + `buildMonthHeaders` + `buildPromoRail` | `#sidebarRows` — sortable by Sport/Country/A–Z. Filter panel persisted per sort mode (`mjr_filters_*`). |
| Calendar | `#calendarView` inside `#cwLayout` | `buildCalendarView` | `#cwLayout > .cw-sidebar` — Special filters + Sport + Country (cwFilters not persisted). |
| Weekly | `#weeklyView` inside `#cwLayout` | `buildWeeklyView` | same shared cw-sidebar. |

`setView(view)` in `core/view-state.js` toggles which layout is visible and dispatches to the right `build*` function for the cw views. Calendar and Weekly share `#cwLayout` and the cw-sidebar (`features/cw-filters.js`).

## Key patterns

**Lane assignment** (`assignLanes`, `assignCountryLanes` in `features/filters.js`): greedy left-to-right collision detection that packs overlapping tournament bars into horizontal lanes. Each event gets `_lane` (sport view) or `_cLane` (country view). Row height is derived from lane count. Same pattern reused for the toppin rail (`views/month-headers.js`) and the promo rail (`features/promotions.js`).

**Timeline coordinate system** (`core/timeline-config.js`): `DAY_PX` pixels per day (9 on mobile, 18 on desktop). `dayOffset(date)` returns days from `TIMELINE_START`. All bar positions are computed as `dayOffset * DAY_PX`. `TIMELINE_START`/`END`/`TOTAL_DAYS`/`TOTAL_W` are live bindings — reassigned by `computeTimelineBounds()` on every refresh.

**Date parsing** (`core/util.js`): use `parseLocalDate(str)` (not `new Date(str)`) for YYYY-MM-DD strings to avoid UTC/local midnight mismatch when comparing against locally-constructed dates.

**Live sort mode:** active tournaments are split into a "live" slice shown at the top; upcoming tournaments sorted by start date follow below. This split happens in `getSortedCatData()` and `getSortedCountryData()` in `features/filters.js`.

**Filtered-view trimming:**
- **Calendar** (`views/calendar.js`): only renders year grids that contain at least one filtered event; falls back to a "No events match the current filters." empty state.
- **Weekly** (`views/weekly.js`): computes `renderStart`/`renderEnd` from the earliest/latest filtered event's Monday-of-week, but always extends to include the current week so the blue "you are here" marker stays visible.

**Forward-only navigation:** `navigateToEvent(ev, { forwardOnly: true })` in `views/scroll.js` never scrolls horizontally backward — used by promo-rail pill clicks so past events don't yank the user into history. `{ horizontalOnly: true }` skips the vertical row-snap (used by sidebar status-pill clicks). Both are opt-in via the options object.

## Auto-refresh

For unattended displays (e.g. meeting-room screens) where the page is never reloaded. Every 15 minutes (`REFRESH_MS` in `app.js`) `refreshAll()` runs the same pipeline as `init()`:

1. Capture scroll positions of the timeline, calendar, weekly, sidebar containers.
2. `refreshData()` — re-fetch all four sheet tabs + rebuild `catData` + `topRevenueSports`.
3. `renderAll()` — re-render every view.
4. Restore scroll positions on the next animation frame.

If the user is on Calendar or Weekly, the current view is also rebuilt at the end of `renderAll()`.

## Cache-busting and version badge

Cache-busting is automatic — no manual `?v=N` bumping. `index.html` contains an inline boot script that:

- Sets `style.css?v=${Date.now()}` so CSS is always fresh on reload.
- For `lookups.js` and `app.js`: HEAD requests each file, reads `Last-Modified`, and loads each script with `?v=<mtime-epoch-ms>`. Loaded sequentially so `lookups.js` runs first (it defines globals the modules read).
- Computes the newest mtime across all three files and writes it into `#versionBadge` (bottom-right pill) as `v YYYY.MM.DD HH:MM`. The badge ticks up only when a source file actually changes, so a hard refresh proves your edit landed.

The version badge is positioned via `.version-badge` in `style.css`.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `T` | Go to today |
| `S` | Focus search |
| `V` | Cycle view: Timeline → Calendar → Weekly |
| `+` / `−` (in input) | (no global shortcuts beyond the above) |
| `Esc` | Close open panel (priority: promo → settings → match → default); timeline scrolls to start, calendar/weekly go to today |

All implemented in `features/keyboard.js`. Add a new shortcut here AND in `renderSettingsShortcuts()` in `features/settings-panel.js` so the help reflects it.
