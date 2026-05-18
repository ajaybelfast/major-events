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

**Data shape:** Each CSV row produces either a `TOURNAMENTS[]` entry or a `MATCHES[]` entry (when `format === 'match'`). Key `format` values: `tournament`, `season`, `event`, `race`, `onedayevent`, `match`. The `match` format is excluded from `TOURNAMENTS` and linked to a parent tournament by name. Rows may carry a `sub-category` field (e.g. Esports games like "VALORANT"); `effectiveCategory(ev)` returns `"Category (sub-category)"` for these.

**Per-row flags (CSV columns, value = "yes" to enable):**
- `highlight` → `ev.highlight`. Currently affects: (a) the in-row single-day event marker — highlighted events render as a gold ★ in their lane, non-highlighted single-day events render as a monochrome sport-icon tick; (b) multi-day bars get a gold border + shimmer (`.bar-highlight`); (c) tournament names in calendar and weekly views get gold styling (`.cal-event-highlight`, `.week-event-highlight`).
- `toppin` → `ev.topPin`. Pins the tournament to the **top header rail** above the timeline (gold "★ Name" pill with vertical tick to the start date). Works for any `format` — single-day or multi-day. The header rail is exclusively driven by this flag now; it is NOT linked to single-day events.

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
  - **Calendar/Weekly sidebar**: a "Favourites" section is injected at the top of `cwSidebarBody` by `buildCwSidebar()` (id `cwFavSection`). Cleared by `clearCwFilters()`.
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
| `C` | Toggle calendar view |
| `Esc` | Scroll to start (timeline) |
