# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build system or package manager. Open `index.html` directly in a browser, or serve locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Architecture

Single-page vanilla JS app. No framework, no bundler, no dependencies beyond Font Awesome (CDN).

**File roles:**
- `data.js` — global constants only: `SPORT_COLORS`, `SPORT_ICONS`, `ESPORTS_LOGOS`, `getFlag()`. Loaded first so app.js can reference these globals.
- `app.js` — all application logic: data fetching, view rendering, filtering, sorting, search, scroll behaviour.
- `style.css` — all styling for all three views.
- `index.html` — static markup shell. Both view containers (`#mainView` for timeline, `#cwLayout` for calendar/weekly) are always in the DOM; `setView()` shows/hides them.
- `tournaments.csv` — reference snapshot only, not loaded by the app.

**Data source:** Tournament data is fetched at runtime from a published Google Sheets CSV (`SHEET_URL` in app.js). Edit the sheet to add/update events — do not edit `data.js` for tournament data.

**Data shape:** Each CSV row produces either a `TOURNAMENTS[]` entry or a `MATCHES[]` entry (when `format === 'match'`). Key `format` values: `tournament`, `season`, `event`, `race`, `onedayevent`, `match`. The `match` format is excluded from `TOURNAMENTS` and linked to a parent tournament by name. Rows may carry a `sub-category` field (e.g. Esports games like "VALORANT"); `effectiveCategory(ev)` returns `"Category (sub-category)"` for these — except for categories listed in `NO_SUBCATEGORY_SPLIT` (currently `Yachting`), which always collapse to the bare category name regardless of `sub-category`.

**Per-row flags (CSV columns, value = "yes" to enable):**
- `highlight` → `ev.highlight`. Currently affects: (a) the in-row single-day event marker — highlighted events render as a gold ★ in their lane, non-highlighted single-day events render as a monochrome sport-icon tick; (b) multi-day bars get a gold border + shimmer (`.bar-highlight`); (c) tournament names in calendar and weekly views get gold styling (`.cal-event-highlight`, `.week-event-highlight`).
- `toppin` → `ev.topPin`. Pins the tournament to the **top header rail** above the timeline (gold "★ Name" pill with vertical tick to the start date). Works for any `format` — single-day or multi-day. The header rail is exclusively driven by this flag now; it is NOT linked to single-day events.
**Top revenue sports (separate sheet tab):** Sourced from a `SportCategories` tab in the same Google Sheet — NOT from per-event flags. The tab has two columns:
- `category` — must match what `effectiveCategory(ev)` returns at runtime (e.g. `Tennis`, `Esports (VALORANT)`).
- `toprevsport` — `yes`/blank.

The tab's published-CSV URL lives in `SHEET_URL_SPORT_CATEGORIES` in `app.js`; its `gid` placeholder (`REPLACE_WITH_YOUR_GID`) must be replaced with the real gid before this lights up. Failure to fetch is non-fatal — the feature simply hides itself.

After `loadData()`, `SPORT_CATEGORIES = [{ category, topRevSport }, …]`. `computeTopRevenueSports()` then builds `topRevenueSports = new Set(category names where topRevSport)`. Surfaces:
- Gold `$` icon next to the sport name in the timeline sport-mode sidebar, the timeline filter panel sport list, and the cw-sidebar Sport list.
- In both filter panels, top-revenue sports float to the top under a "Top revenue" header; the rest sit under "Other sports".
- "Top revenue sports only" toggle (`showOnlyTopRevenue`, persisted to `mjr_top_rev_only`) in the timeline filter panel and the cw-sidebar — filters all three views via `getSortedCatData`, `getSortedCountryData`, and `getFilteredTournaments`.
- Toggle hides itself entirely if `topRevenueSports.size === 0`.

## Promotions

Sport-trading-team feature: manually-created promos (e.g. "EPL refund if your team loses in 90th minute") that traders need to see alongside the tournaments they're attached to. Sourced from a separate `Promotions` tab in the same Google Sheet.

**Sheet columns** (one row per promo):
- `name` — promo name (required)
- `description` — what the promo offers (free text)
- `startdate`, `enddate` — `YYYY-MM-DD`
- `linkedtournaments` — pipe-delimited tournament names matching `TOURNAMENTS[].name` (e.g. `Wimbledon 2026 | US Open 2026`). Optional when `sport` is set.
- `sport` — applies the promo to every tournament whose raw `category`, `subCategory`, or rendered `effectiveCategory()` matches this string (case-insensitive). Optional when `linkedtournaments` is set. Examples: `UFC`, `Tennis`, `Esports (VALORANT)`. **At least one of `linkedtournaments` or `sport` is required** — promos with neither are filtered out at parse time.

The tab's published-CSV URL lives in `SHEET_URL_PROMOTIONS` in `app.js`; its `gid` placeholder (`REPLACE_WITH_PROMOTIONS_GID`) must be replaced with the real gid before this lights up. Failure to fetch is non-fatal — the rail and badges simply don't render.

**Parsing:** `loadData()` populates `PROMOTIONS = [{ name, description, startDate, endDate, linkedTournaments, sport }]`. Every row in the sheet is shown — past, present, and future. The only parse-time filter is structural validity (`name && startDate && endDate && (linkedTournaments.length > 0 || sport)`). `PROMOTIONS_BY_TOURNAMENT` is a lowercase-keyed map for O(1) badge lookup per tournament; sport-wide promos are expanded across all matching tournaments at build time (deduped per tournament).

**Surfaces:**
- **Timeline rail** (`#promoRail`, `buildPromoRail()`): horizontal sticky strip below `.months-header` with one pill per promo, positioned `startDate → endDate`. Overlapping promos lane-pack like the toppin rail. Purple gradient pill with gift icon; click navigates to the first linked tournament; hover shows promo tooltip. Past promos render at 45% opacity (`.promo-pill-past`); single-day icon-only pills get `.promo-pill-icon-only` for centered icon.
- **Timeline bar badge** (`.bar-promo-btn`): small purple gift icon on tournament bars with linked promos. Mirrors `.bar-fav-btn`: only renders when `widthPx >= 58`. Sits at `right: 4px` alone, `right: 22px` when fav star is also present (`.has-fav.has-promo` → `padding-right: 40px`). Hover lists every active promo for that tournament; click is a no-op.
- **Calendar/Weekly badge** (`.cal-event-promo-badge`, `.week-event-promo-badge`): same gift icon inline in event rows for any tournament with linked promos. Hover-only tooltip (`showBarPromoTooltip`).
- **Sidebar Promotions section** (`#sidebarPromoSection`): clickable label in the timeline sidebar at the same Y as the promo rail. Click opens the promo panel.
- **Promo panel** (`#promoPanel`): slide-in right panel, Active / Upcoming / Past grouping, each promo as a card with name, description, dates, sport chip (cyan), tournament chips (purple, click-to-navigate). Esc closes (priority: promo panel → settings → match panel → view default).
- **"Active promotions only" filter toggle**: in both the timeline filter panel (`.filter-option-promo`) and the cw-sidebar (inside `#cwSpecialFilters`, the consolidated "Special filters" section). State is `showOnlyPromos`, persisted to `mjr_promo_only`. Hides itself when `PROMOTIONS.length === 0`. Wires into `getSortedCatData`, `getSortedCountryData`, `getFilteredTournaments`, and both filter-button badge counts. Cleared by `clearFilters()` and `clearCwFilters()`.
- **`hasActivePromo(ev)`**: helper — `true` iff at least one linked promo's `startDate <= today <= endDate`.
- **`parseLinkedTournaments(str)`** in `data.js` splits on `|`. Explicit choice so tournament names can safely contain commas, ampersands, or slashes.

**Roadmap (deferred):** dedicated "Promotions" view (4th tab), `link`/`featured`/`status` columns, search integration — see memory `project_promotions_feature.md`.

## Three views

| View | Container | Sidebar |
|------|-----------|---------|
| Timeline | `#mainView` | `#sidebarRows` — sortable by Sport/Country/A–Z, with sport/country filter panel; filters persisted to `localStorage` per sort mode (`mjr_filters_*`) |
| Calendar | `#calendarView` inside `#cwLayout` | `#cwLayout > .cw-sidebar` — filters by sport + country (not persisted) |
| Weekly | `#weeklyView` inside `#cwLayout` | same shared cw-sidebar |

`setView(view)` switches between them. Calendar and Weekly share `#cwLayout` and `buildCwSidebar()` / `cwFilters`.

## Favourites

User-starred tournaments. Per-edition: keyed by `${name}|${startDate}` so the 2026 edition is distinct from 2027.

- State: in-memory `favourites` (Set) and `showOnlyFavourites` (bool). Persisted to `localStorage` under `mjr_favourites` (array) and `mjr_fav_only` (`'0'|'1'`).
- API: `isFavourite(ev)`, `toggleFavourite(ev)`, `loadFavourites()`, `saveFavourites()`, `saveFavOnly()`.
- UI surfaces:
  - **Bar ⭐ button** (`.bar-fav-btn`): rendered on multi-day tournament bars in the timeline when `widthPx >= 58`. Adds `.has-fav` to the bar so right padding reserves space. Single-day `event`/`race` star markers do NOT get a fav button in v1.
  - **Timeline filter panel**: a "My favourites only" row prepended in `renderFilterOptions()` above the sport/country list. Cleared by `clearFilters()`.
  - **Calendar/Weekly sidebar**: the "My favorite events only" toggle lives in the consolidated `#cwSpecialFilters` section (the "Special filters" header at the top of `cwSidebarBody`), alongside the top-revenue and active-promos toggles. All injected by `buildCwSidebar()`. Cleared by `clearCwFilters()`.
- Filter wiring: `getSortedCatData`, `getSortedCountryData`, and `getFilteredTournaments` all honour `showOnlyFavourites`. The badge count on the timeline filter button and the cw-sidebar badge both include the fav toggle.

## Settings panel

Right-side slide-in panel for managing user preferences. Opened by the gear button in the header (`.settings-btn`) or the "Manage favourites…" link inside the timeline filter panel. Closed by the × button, clicking the backdrop, or Esc (handled in `initKeyboardShortcuts`).

- Markup: `#settingsBackdrop` + `#settingsPanel` live near the end of `index.html` body. Panel uses fixed positioning with a `transform: translateX(100%)` → `0` transition (`.settings-panel.open`).
- Render flow: `openSettingsPanel()` → `renderSettings()` → currently only `renderSettingsFavourites()`. Add more sections here as new settings are introduced.
- Favourites section: shows count, alphabetical list of starred tournaments (name + sport + dates + country), each with an unstar button that animates the row out (`.removing` class) then re-renders. "Clear all favourites" button at the bottom uses a native `confirm()`.
- After any change, the function refreshes the panel itself plus `updateFilterBtn()`, `updateCwUI()`, `rebuildViews()`, and `rebuildCwView()` so the rest of the UI stays in sync.

## Search

`initSearch()` powers the header search box. Matches against tournament `name`, `effectiveCategory()` (sport), and `country` via case-insensitive substring.

- **Action chips**: when the query matches a distinct sport or country, the dropdown prepends a "Filter to …" chip (up to 2 sports, 2 countries). Selecting a chip calls `applySearchFilter(kind, label)` which:
  - switches `sortMode` if needed (sport chip → `'live'` if currently `'country'`; country chip → `'country'`),
  - overrides `activeFilters` (timeline) and mirrors into `cwFilters` (calendar/weekly) so the filter is visible regardless of view,
  - saves, refreshes `updateFilterBtn` / `updateCwUI`, calls `rebuildViews()` + `buildCwSidebar()`, and rebuilds the cw view if it's the current one.
- **Tournament rows** follow below (up to 7). On select they call `goToTournament()` which navigates per current view (`navigateToEvent` / `scrollToCalendarEvent` / `scrollToWeekEvent`).
- Keyboard nav covers chips and tournaments in document order via a unified `combinedItems` array (`ArrowUp`/`Down`, `Enter` to activate, `Esc` to close).

## Key patterns

**Lane assignment** (`assignLanes`, `assignCountryLanes`): greedy left-to-right collision detection that packs overlapping tournament bars into horizontal lanes. Each event gets `_lane` (sport view) or `_cLane` (country view). Row height is derived from lane count.

**Timeline coordinate system:** `DAY_PX` pixels per day (9 on mobile, 18 on desktop). `dayOffset(dateStr)` returns days from `TIMELINE_START`. All bar positions are computed as `dayOffset * DAY_PX`.

**Date parsing:** Use `parseLocalDate(str)` (not `new Date(str)`) for YYYY-MM-DD strings to avoid UTC/local midnight mismatch when comparing against locally-constructed dates.

**Live sort mode:** Active tournaments are split into a "live" slice shown at the top; upcoming tournaments sorted by start date follow below. This split happens in `getSortedCatData()` and `getSortedCountryData()`.

**Match panel:** In the Weekly view, clicking a tournament with associated `MATCHES` entries opens a slide-in panel (`buildMatchPanel`). Only one match panel is open at a time (`_activeMatchTournament`).

**Filtered-view trimming:** Both Calendar and Weekly views trim empty leading/trailing periods when filters narrow the result set.
- **Calendar:** only renders year grids that contain at least one filtered event; falls back to a "No events match the current filters." empty state.
- **Weekly:** computes `renderStart`/`renderEnd` from the earliest/latest filtered event's Monday-of-week, but always extends to include the current week so the "you are here" blue marker stays visible. Years entirely outside the window are skipped (year header is only added on the first rendered week of a year via `yearHeaderAdded`).

## Cache-busting and version badge

Cache-busting is automatic — no manual `?v=N` bumping. `index.html` contains a small inline boot script that:

- Sets `style.css?v=${Date.now()}` so CSS is always fresh on reload.
- For `data.js` and `app.js`: issues a HEAD request, reads the `Last-Modified` header, and loads each script with `?v=<mtime-epoch-ms>`. Scripts are awaited sequentially so `data.js` loads before `app.js`.
- Computes the newest mtime across all three files and writes it into the `#versionBadge` element (bottom-right pill) as `v YYYY.MM.DD HH:MM`. The badge ticks up only when source files actually change, making it easy to confirm a refresh picked up your edit.

The version badge is positioned via `.version-badge` in `style.css`.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `T` | Go to today |
| `S` | Focus search |
| `V` | Cycle view: Timeline → Calendar → Weekly |
| `Esc` | Close open panel; otherwise scroll to start (timeline) or go to today (calendar/weekly) |
