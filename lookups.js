// ============================================================
//  LOOKUPS
// ============================================================
// Static lookup tables used everywhere — sport colours / icons /
// esports logos, country flags, plus the small CSV-cell parsers
// (parseCountries, parseLinkedTournaments). Loaded as a classic
// script (not an ES module) so the constants and helpers become
// globals that ES modules can reference without importing.
//
// Tournament data itself (events, matches, promotions) is fetched
// at runtime by `./core/data.js` from the published Google Sheets
// CSV — edit the sheet to add or update events, not this file.

// ============================================================
//  SPORT COLORS
// ============================================================
// Each sport tries to get a relevant, distinct colour. Aliases (e.g.
// Motorsport/Motorsports, Aussie Rules/AFL, Rugby/Rugby Union) share the same
// hex — they're the same sport under different names.
const SPORT_COLORS = {
  // ── Ball + field sports ──────────────────────────────────
  'American Football':           '#C68642',  // tan leather ball
  'Athletics':                   '#FF6B6B',  // red track
  'Aquatics':                    '#00B4D8',  // pool blue
  'Badminton':                   '#A78BFA',  // racket purple
  'Baseball':                    '#1A8FD1',  // diamond blue
  'Basketball':                  '#F4844C',  // basketball orange
  'Basketball 3x3':              '#FFA947',  // 3x3 lighter orange
  'Cricket':                     '#6BCB77',  // pitch green
  'Football':                    '#F0F0F0',  // ⚪ white ball
  'Soccer':                      '#F0F0F0',  // alias of Football
  'Futsal':                      '#34C759',  // indoor bright green
  'Golf':                        '#95D5B2',  // fairway green
  'Handball':                    '#FF7F50',  // coral
  'Hockey':                      '#56CFB2',  // turf teal
  'Floorball':                   '#00B8A9',  // bright teal-green
  'Lacrosse':                    '#9966CC',  // royal violet
  'Netball':                     '#F472B6',  // netball pink
  'Padel':                       '#48C9B0',  // padel teal
  'Squash':                      '#48BB78',  // court green
  'Softball':                    '#FFD700',  // softball yellow
  'Table Tennis':                '#FF6F61',  // paddle red
  'Tennis':                      '#F2C94C',  // tennis-ball yellow
  'Volleyball':                  '#FFB74D',  // volleyball orange
  'Beach Volley':                '#FFD166',  // sandy yellow
  'Waterpolo':                   '#4DD9D0',  // pool aqua
  // ── Rugby / gridiron family ──────────────────────────────
  'Rugby':                       '#C0392B',
  'Rugby Union':                 '#C0392B',
  'Rugby League':                '#E07A5F',  // lighter rugby red
  'Aussie Rules':                '#5A8DEE',  // AFL blue
  'AFL':                         '#5A8DEE',
  'Gaelic Football':             '#2E8B57',  // Irish green
  'Gaelic Hurling':              '#E67E22',  // sliotar orange
  // ── Combat / individual ──────────────────────────────────
  'Boxing':                      '#B22222',  // firebrick
  'MMA':                         '#DC143C',  // crimson
  'Combat Sports':               '#8B1A1A',  // dark blood red
  'Gymnastics':                  '#F48C8C',  // ribbon pink
  'Darts':                       '#1E8449',  // dartboard green
  'Snooker':                     '#1A8A6E',  // table baize
  'Horse Racing':                '#8E44AD',  // royal silks
  // ── Motorsport family — single shared red, sub-cats ignored ─
  'Motorsport':                  '#E63946',
  'Motorsports':                 '#E63946',
  'Motorsport (Formula 1)':      '#E63946',
  'Formula 1':                   '#E63946',
  'Indy Racing':                 '#E63946',
  'Motorcycle Racing':           '#E63946',
  'Stock Car Racing':            '#E63946',
  // ── Endurance / outdoor ──────────────────────────────────
  'Cycling':                     '#F4A261',  // jersey orange
  'Yachting':                    '#3498DB',  // sea blue
  // ── Esports — single shared purple, sub-cats ignored ─────
  'Esports':                     '#7C3AED',
  'Esports (Counter-Strike 2)':  '#7C3AED',
  'Esports (VALORANT)':          '#7C3AED',
  'Esports (Rainbow Six)':       '#7C3AED',
  'Esports (Overwatch)':         '#7C3AED',
  'Esports (League of Legends)': '#7C3AED',
  'Esports (Dota 2)':            '#7C3AED',
  'Esports (Call of Duty)':      '#7C3AED',
  'Esports (Apex Legends)':      '#7C3AED',
  'Esports (Fighting Games)':    '#7C3AED',
  'Crossfire':                   '#37474F',  // gunmetal
  'FIFA':                        '#1F8345',  // FIFA green
  // ── Winter ───────────────────────────────────────────────
  'Winter Sports':               '#90D7FF',  // winter blue
  'Figure Skating':              '#AED6F1',  // rink pastel
  'Ice Hockey':                  '#5BA8D8',  // rink ice
  'Bandy':                       '#74B0E0',  // ice-blue
  'Ski Jumping':                 '#5DADE2',  // sky blue
  'Cross-Country':               '#7FB3D5',  // pine-snow
  'Biathlon':                    '#B8E0F0',  // pale snow
  // ── Multi / misc ─────────────────────────────────────────
  'Multi-Sport':                 '#F4A535',  // medal gold
  'Specials':                    '#9CA3AF',  // neutral grey
};

// ============================================================
//  SPORT ICONS — Font Awesome 6 Free
// ============================================================
const SPORT_ICONS = {
  'American Football':           'fa-solid fa-football',
  'Athletics':                   'fa-solid fa-person-running',
  'Aquatics':                    'fa-solid fa-person-swimming',
  'Badminton':                   'fa-solid fa-volleyball',
  'Baseball':                    'fa-solid fa-baseball',
  'Basketball':                  'fa-solid fa-basketball',
  'Combat Sports':               'fa-solid fa-hand-fist',
  'MMA':                         'fa-solid fa-hand-fist',
  'Boxing':                      'fa-solid fa-hand-fist',
  'Cricket':                     'fa-solid fa-baseball-bat-ball',
  'Darts':                       'fa-solid fa-bullseye',
  'Cycling':                     'fa-solid fa-person-biking',
  'Esports (Counter-Strike 2)':  'fa-solid fa-crosshairs',
  'Esports (VALORANT)':          'fa-solid fa-shield-halved',
  'Esports (Rainbow Six)':       'fa-solid fa-shield',
  'Esports (Overwatch)':         'fa-solid fa-eye',
  'Esports (Fighting Games)':    'fa-solid fa-hand-fist',
  'Esports (League of Legends)': 'fa-solid fa-chess-king',
  'Esports (Dota 2)':            'fa-solid fa-dragon',
  'Esports (Call of Duty)':      'fa-solid fa-gun',
  'Esports (Apex Legends)':      'fa-solid fa-rocket',
  'Formula 1':                   'fa-solid fa-flag-checkered',
  'Motorsport (F1)':             'fa-solid fa-flag-checkered',
  'Motorsport (Formula 1)':      'fa-solid fa-flag-checkered',
  'Figure Skating':              'fa-solid fa-person-skating',
  'Football':                    'fa-solid fa-futbol',
  'Golf':                        'fa-solid fa-golf-ball-tee',
  'Gymnastics':                  'fa-solid fa-dumbbell',
  'Handball':                    'fa-solid fa-hand',
  'Hockey':                      'fa-solid fa-hockey-puck',
  'Horse Racing':                'fa-solid fa-horse-head',
  'Ice Hockey':                  'fa-solid fa-hockey-puck',
  'Motorsport':                  'fa-solid fa-trophy',
  'Multi-Sport':                 'fa-solid fa-medal',
  'Rugby League':                'fa-solid fa-football',
  'Rugby Union':                 'fa-solid fa-football',
  'Snooker':                     'fa-solid fa-circle-dot',
  'Table Tennis':                'fa-solid fa-table-tennis-paddle-ball',
  'Tennis':                      'fa-solid fa-circle-half-stroke',
  'Winter Sports':               'fa-solid fa-snowflake',
  // ── Additional sports (per SportCategories list) ──────────
  'Aussie Rules':                'fa-solid fa-football',
  'AFL':                         'fa-solid fa-football',
  'Bandy':                       'fa-solid fa-hockey-puck',
  'Basketball 3x3':              'fa-solid fa-basketball',
  'Beach Volley':                'fa-solid fa-volleyball',
  'Biathlon':                    'fa-solid fa-person-skiing-nordic',
  'Cross-Country':               'fa-solid fa-person-skiing-nordic',
  'Crossfire':                   'fa-solid fa-crosshairs',
  'Esports':                     'fa-solid fa-gamepad',
  'FIFA':                        'fa-solid fa-futbol',
  'Floorball':                   'fa-solid fa-hockey-puck',
  'Futsal':                      'fa-solid fa-futbol',
  'Gaelic Football':             'fa-solid fa-futbol',
  'Gaelic Hurling':              'fa-solid fa-baseball-bat-ball',
  'Lacrosse':                    'fa-solid fa-baseball-bat-ball',
  'Motorsports':                 'fa-solid fa-flag-checkered',
  'Indy Racing':                 'fa-solid fa-flag-checkered',
  'Motorcycle Racing':           'fa-solid fa-motorcycle',
  'Stock Car Racing':            'fa-solid fa-flag-checkered',
  'Soccer':                      'fa-solid fa-futbol',
  'Netball':                     'fa-solid fa-basketball',
  'Padel':                       'fa-solid fa-table-tennis-paddle-ball',
  'Rugby':                       'fa-solid fa-football',
  'Ski Jumping':                 'fa-solid fa-person-skiing',
  'Softball':                    'fa-solid fa-baseball',
  'Specials':                    'fa-solid fa-tag',
  'Squash':                      'fa-solid fa-table-tennis-paddle-ball',
  'Volleyball':                  'fa-solid fa-volleyball',
  'Waterpolo':                   'fa-solid fa-person-swimming',
  'Yachting':                    'fa-solid fa-sailboat',
};

// ============================================================
//  ESPORTS LOGOS — via Simple Icons CDN (simpleicons.org)
// ============================================================
const ESPORTS_LOGOS = {
  'Esports (Dota 2)':            'https://cdn.simpleicons.org/dota2/8b949e',
  'Esports (VALORANT)':          'https://cdn.simpleicons.org/valorant/8b949e',
  'Esports (League of Legends)': 'https://cdn.simpleicons.org/leagueoflegends/8b949e',
};

// ============================================================
//  COUNTRY FLAGS
// ============================================================
const FLAGS = {
  // ── British Isles ─────────────────────────────────────────
  'UK':                    '🇬🇧', 'United Kingdom':       '🇬🇧', 'England':          '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Scotland':         '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Wales':                 '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Ireland':              '🇮🇪', 'Isle of Man':      '🇮🇲',
  // ── Western Europe ────────────────────────────────────────
  'France':                '🇫🇷', 'Germany':              '🇩🇪', 'Spain':            '🇪🇸',
  'Italy':                 '🇮🇹', 'Netherlands':          '🇳🇱', 'Belgium':          '🇧🇪',
  'Portugal':              '🇵🇹', 'Switzerland':          '🇨🇭', 'Austria':          '🇦🇹',
  'Monaco':                '🇲🇨', 'Luxembourg':           '🇱🇺', 'Denmark':          '🇩🇰',
  'Norway':                '🇳🇴', 'Sweden':               '🇸🇪', 'Finland':          '🇫🇮',
  'Iceland':               '🇮🇸',
  // ── Central & Eastern Europe ──────────────────────────────
  'Poland':                '🇵🇱', 'Czech Republic':       '🇨🇿', 'Slovakia':         '🇸🇰',
  'Hungary':               '🇭🇺', 'Romania':              '🇷🇴', 'Bulgaria':         '🇧🇬',
  'Croatia':               '🇭🇷', 'Serbia':               '🇷🇸', 'Slovenia':         '🇸🇮',
  'Greece':                '🇬🇷', 'Cyprus':               '🇨🇾', 'Estonia':          '🇪🇪',
  'Latvia':                '🇱🇻', 'Lithuania':            '🇱🇹', 'Ukraine':          '🇺🇦',
  'Belarus':               '🇧🇾', 'Moldova':              '🇲🇩', 'Albania':          '🇦🇱',
  'North Macedonia':       '🇲🇰', 'Montenegro':           '🇲🇪', 'Kosovo':           '🇽🇰',
  'Bosnia and Herzegovina':'🇧🇦', 'Armenia':              '🇦🇲', 'Georgia':          '🇬🇪',
  'Azerbaijan':            '🇦🇿',
  // ── Russia ────────────────────────────────────────────────
  'Russia':                '🇷🇺',
  // ── Americas ──────────────────────────────────────────────
  'USA':                   '🇺🇸', 'Canada':               '🇨🇦', 'Mexico':           '🇲🇽',
  'Brazil':                '🇧🇷', 'Argentina':            '🇦🇷', 'Chile':            '🇨🇱',
  'Colombia':              '🇨🇴', 'Peru':                 '🇵🇪', 'Venezuela':        '🇻🇪',
  'Ecuador':               '🇪🇨', 'Uruguay':              '🇺🇾', 'Paraguay':         '🇵🇾',
  'Bolivia':               '🇧🇴', 'Cuba':                 '🇨🇺', 'Jamaica':          '🇯🇲',
  'Panama':                '🇵🇦', 'Guatemala':            '🇬🇹', 'Honduras':         '🇭🇳',
  'El Salvador':           '🇸🇻', 'Costa Rica':           '🇨🇷',
  'Bermuda':               '🇧🇲', 'Cayman Islands':       '🇰🇾',
  'Guadeloupe':            '🇬🇵',
  // ── Middle East ───────────────────────────────────────────
  'Saudi Arabia':          '🇸🇦', 'UAE':                  '🇦🇪', 'Qatar':            '🇶🇦',
  'Kuwait':                '🇰🇼', 'Bahrain':              '🇧🇭', 'Oman':             '🇴🇲',
  'Israel':                '🇮🇱', 'Jordan':               '🇯🇴', 'Lebanon':          '🇱🇧',
  'Iraq':                  '🇮🇶', 'Iran':                 '🇮🇷', 'Turkey':           '🇹🇷',
  // ── Asia ──────────────────────────────────────────────────
  'Japan':                 '🇯🇵', 'China':                '🇨🇳', 'South Korea':      '🇰🇷',
  'India':                 '🇮🇳', 'Singapore':            '🇸🇬', 'Thailand':         '🇹🇭',
  'Malaysia':              '🇲🇾', 'Indonesia':            '🇮🇩', 'Philippines':      '🇵🇭',
  'Vietnam':               '🇻🇳', 'Taiwan':               '🇹🇼', 'Hong Kong':        '🇭🇰',
  'Macao':                 '🇲🇴', 'Macau':                '🇲🇴',
  'Pakistan':              '🇵🇰', 'Sri Lanka':            '🇱🇰', 'Bangladesh':       '🇧🇩',
  'Kazakhstan':            '🇰🇿', 'Uzbekistan':           '🇺🇿', 'North Korea':      '🇰🇵',
  // ── Oceania ───────────────────────────────────────────────
  'Australia':             '🇦🇺', 'New Zealand':          '🇳🇿', 'Papua New Guinea': '🇵🇬',
  // ── Africa ────────────────────────────────────────────────
  'South Africa':          '🇿🇦', 'Nigeria':              '🇳🇬', 'Kenya':            '🇰🇪',
  'Ghana':                 '🇬🇭', 'Ethiopia':             '🇪🇹', 'Egypt':            '🇪🇬',
  'Morocco':               '🇲🇦', 'Tunisia':              '🇹🇳', 'Algeria':          '🇩🇿',
  'Senegal':               '🇸🇳', 'Cameroon':             '🇨🇲', 'Zimbabwe':         '🇿🇼',
  // ── Common abbreviations ──────────────────────────────────
  'NZ':                    '🇳🇿', 'PNG':                  '🇵🇬',
  // ── Multi-country / special ───────────────────────────────
  'Europe':                '🇪🇺', 'Global':               '🌍', 'Multiple':         '🌍',
  'TBC':                   '🌍',
};

// Case-insensitive flag lookup — handles ALL CAPS or mixed-case country names from the sheet
const _FLAGS_LC = Object.fromEntries(Object.entries(FLAGS).map(([k, v]) => [k.toLowerCase(), v]));

// Splits a multi-country string ("USA/Canada/Mexico", "Belgium, Netherlands", "France & Spain")
// into individual country names. Single-country values pass through as a one-element array.
function parseCountries(country) {
  if (!country) return [];
  return country.split(/\s*(?:\/|,|&)\s*/).map(s => s.trim()).filter(Boolean);
}

// Promotions' `linkedtournaments` column delimits by "|" — explicit choice so
// tournament names can safely contain commas, ampersands, or slashes.
function parseLinkedTournaments(str) {
  if (!str) return [];
  return str.split('|').map(s => s.trim()).filter(Boolean);
}

function getFlag(country) {
  if (!country) return '🌐';
  const list = parseCountries(country);
  const primary = list.length > 1 ? list[0] : country;
  return FLAGS[primary] || _FLAGS_LC[primary.toLowerCase()] || '🌐';
}
