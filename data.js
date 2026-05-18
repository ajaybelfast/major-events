// Tournament data is now loaded from Google Sheets — see SHEET_URL in app.js.
// Edit the sheet directly to add or update events.

// ============================================================
//  SPORT COLORS
// ============================================================
const SPORT_COLORS = {
  'American Football':           '#4CAF82',
  'Athletics':                   '#FF6B6B',
  'Aquatics':                    '#4DD9D0',
  'Badminton':                   '#45B7D1',
  'Baseball':                    '#1A8FD1',
  'Basketball':                  '#F7C948',
  'Combat Sports':               '#E53935',
  'MMA':                         '#E53935',
  'Boxing':                      '#E53935',
  'Cricket':                     '#6BCB77',
  'Cycling':                     '#F4A261',
  'Esports (Counter-Strike 2)':  '#7C3AED',
  'Esports (VALORANT)':          '#7C3AED',
  'Esports (Rainbow Six)':       '#7C3AED',
  'Esports (Overwatch)':         '#7C3AED',
  'Esports (Fighting Games)':    '#7C3AED',
  'Esports (League of Legends)': '#7C3AED',
  'Esports (Dota 2)':            '#7C3AED',
  'Esports (Call of Duty)':      '#7C3AED',
  'Esports (Apex Legends)':      '#7C3AED',
  'Figure Skating':              '#AED6F1',
  'Football':                    '#52B788',
  'Golf':                        '#95D5B2',
  'Gymnastics':                  '#F48C8C',
  'Handball':                    '#E59866',
  'Hockey':                      '#56CFB2',
  'Horse Racing':                '#D4A5E0',
  'Ice Hockey':                  '#74B0E0',
  'Motorsport':                  '#E63946',
  'Motorsport (Formula 1)':      '#E63946',
  'Multi-Sport':                 '#F4A535',
  'Rugby League':                '#E07A5F',
  'Rugby Union':                 '#C0392B',
  'Snooker':                     '#1A8A6E',
  'Table Tennis':                '#2196F3',
  'Tennis':                      '#F2C94C',
  'Winter Sports':               '#90D7FF',
  // ── Additional sports (per SportCategories list) ──────────
  'Aussie Rules':                '#5A8DEE',
  'AFL':                         '#5A8DEE',
  'Bandy':                       '#74B0E0',
  'Basketball 3x3':              '#F7C948',
  'Beach Volley':                '#FFA94D',
  'Biathlon':                    '#90D7FF',
  'Cross-Country':               '#AEDFF7',
  'Crossfire':                   '#7C3AED',
  'Darts':                       '#16A085',
  'Esports':                     '#7C3AED',
  'FIFA':                        '#7C3AED',
  'Floorball':                   '#56CFB2',
  'Formula 1':                   '#E63946',
  'Futsal':                      '#52B788',
  'Gaelic Football':             '#2E8B57',
  'Gaelic Hurling':              '#FFA500',
  'Lacrosse':                    '#9966CC',
  'Motorsports':                 '#E63946',
  'Netball':                     '#F472B6',
  'Padel':                       '#48C9B0',
  'Rugby':                       '#C0392B',
  'Ski Jumping':                 '#5DADE2',
  'Softball':                    '#FFD700',
  'Specials':                    '#9CA3AF',
  'Squash':                      '#48BB78',
  'Volleyball':                  '#FFB74D',
  'Waterpolo':                   '#4DD9D0',
  'Yachting':                    '#3498DB',
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

function getFlag(country) {
  if (!country) return '🌐';
  const list = parseCountries(country);
  const primary = list.length > 1 ? list[0] : country;
  return FLAGS[primary] || _FLAGS_LC[primary.toLowerCase()] || '🌐';
}
