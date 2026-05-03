// Tournament data is now loaded from Google Sheets — see SHEET_URL in app.js.
// Edit the sheet directly to add or update events.

// ============================================================
//  (legacy placeholder — kept so old bookmarks don't 404)
// ============================================================
const _TOURNAMENTS_REMOVED = [
  // ── April 2026 ──────────────────────────────────────────────
  { category: "Combat Sports", name: "UFC 300",                          format: "event",      country: "USA",              startDate: "2026-04-12", endDate: "2026-04-12" },
  { category: "Combat Sports", name: "UFC Freedom 250",                   format: "event",      country: "USA",              startDate: "2026-06-14", endDate: "2026-06-14" },
  { category: "Rugby Union",   name: "Women's Six Nations",            format: "tournament", country: "Europe",           startDate: "2026-04-11", endDate: "2026-05-17" },
  { category: "Snooker",       name: "World Snooker Championship",     format: "tournament", country: "UK",               startDate: "2026-04-18", endDate: "2026-05-04" },
  { category: "Table Tennis",  name: "ITTF World Team Championships",  format: "tournament", country: "UK",               startDate: "2026-04-28", endDate: "2026-05-10" },

  // ── May 2026 ─────────────────────────────────────────────────
  { category: "Motorsport",    name: "Formula 1 Season",               format: "season",     country: "Global",           startDate: "2026-03-08", endDate: "2026-12-06" },
  { category: "Motorsport",    name: "Miami Grand Prix",               format: "tournament", country: "USA",              startDate: "2026-05-01", endDate: "2026-05-03" },
  { category: "Motorsport",    name: "Berlin E-Prix",                  format: "tournament", country: "Germany",          startDate: "2026-05-02", endDate: "2026-05-03" },
  { category: "Horse Racing",  name: "Kentucky Derby",                 format: "tournament", country: "USA",              startDate: "2026-05-02", endDate: "2026-05-02" },
  { category: "Cycling",       name: "Giro d'Italia",                  format: "tournament", country: "Multiple",         startDate: "2026-05-08", endDate: "2026-05-31" },
  { category: "Motorsport",    name: "French MotoGP",                  format: "tournament", country: "France",           startDate: "2026-05-08", endDate: "2026-05-10" },
  { category: "Esports",       game: "Rainbow Six",      name: "BLAST R6 Major Salt Lake City",         format: "tournament", country: "USA",          startDate: "2026-05-08", endDate: "2026-05-18" },
  { category: "Golf",          name: "PGA Championship",               format: "tournament", country: "USA",              startDate: "2026-05-14", endDate: "2026-05-17" },
  { category: "Ice Hockey",    name: "IIHF World Championship",        format: "tournament", country: "Switzerland",      startDate: "2026-05-15", endDate: "2026-05-31" },
  { category: "Motorsport",    name: "Monaco E-Prix",                  format: "tournament", country: "Monaco",           startDate: "2026-05-16", endDate: "2026-05-17" },
  { category: "Horse Racing",  name: "Preakness Stakes",               format: "tournament", country: "USA",              startDate: "2026-05-16", endDate: "2026-05-16" },
  { category: "Tennis",        name: "French Open",                    format: "tournament", country: "France",           startDate: "2026-05-18", endDate: "2026-06-07" },
  { category: "Motorsport",    name: "Canadian Grand Prix",            format: "tournament", country: "Canada",           startDate: "2026-05-22", endDate: "2026-05-24" },
  { category: "Esports",       game: "Overwatch",        name: "OWCS Champions Clash",                  format: "tournament", country: "Japan",         startDate: "2026-05-22", endDate: "2026-05-24" },
  { category: "Motorsport",    name: "Indianapolis 500",               format: "tournament", country: "USA",              startDate: "2026-05-24", endDate: "2026-05-24" },
  { category: "Motorsport",    name: "Coca-Cola 600",                  format: "tournament", country: "USA",              startDate: "2026-05-24", endDate: "2026-05-24" },
  { category: "Motorsport",    name: "Isle of Man TT",                 format: "tournament", country: "Isle of Man",      startDate: "2026-05-25", endDate: "2026-06-06" },

  // ── June 2026 ─────────────────────────────────────────────────
  { category: "Esports",       game: "Counter-Strike 2", name: "Counter-Strike 2 Major (Summer)",       format: "tournament", country: "Germany",       startDate: "2026-06-02", endDate: "2026-06-21" },
  { category: "Motorsport",    name: "Monaco Grand Prix",              format: "tournament", country: "Monaco",           startDate: "2026-06-05", endDate: "2026-06-07" },
  { category: "Horse Racing",  name: "Epsom Derby Festival",           format: "tournament", country: "UK",               startDate: "2026-06-05", endDate: "2026-06-06" },
  { category: "Motorsport",    name: "Hungarian MotoGP",               format: "tournament", country: "Hungary",          startDate: "2026-06-05", endDate: "2026-06-07" },
  { category: "Esports",       game: "VALORANT",         name: "VALORANT Masters London",               format: "tournament", country: "UK",            startDate: "2026-06-06", endDate: "2026-06-21" },
  { category: "Horse Racing",  name: "Belmont Stakes",                 format: "tournament", country: "USA",              startDate: "2026-06-06", endDate: "2026-06-06" },
  { category: "Motorsport",    name: "24 Hours of Le Mans",            format: "tournament", country: "France",           startDate: "2026-06-10", endDate: "2026-06-14" },
  { category: "Football",      name: "FIFA World Cup",                 format: "tournament", country: "USA/Canada/Mexico", startDate: "2026-06-12", endDate: "2026-07-19" },
  { category: "Football",      name: "FIFA Club World Cup",            format: "tournament", country: "USA/Canada/Mexico", startDate: "2026-06-17", endDate: "2026-07-04" },
  { category: "Cricket",       name: "Women's T20 World Cup",          format: "tournament", country: "UK",               startDate: "2026-06-12", endDate: "2026-07-05" },
  { category: "Horse Racing",  name: "Royal Ascot",                    format: "tournament", country: "UK",               startDate: "2026-06-16", endDate: "2026-06-20" },
  { category: "Golf",          name: "US Open",                        format: "tournament", country: "USA",              startDate: "2026-06-18", endDate: "2026-06-21" },
  { category: "Esports",       game: "Fighting Games",   name: "Evolution Championship Series (EVO)",   format: "event",      country: "USA",           startDate: "2026-06-26", endDate: "2026-06-28" },
  { category: "Motorsport",    name: "Austrian Grand Prix",            format: "tournament", country: "Austria",          startDate: "2026-06-26", endDate: "2026-06-28" },
  { category: "Tennis",        name: "Wimbledon",                      format: "tournament", country: "UK",               startDate: "2026-06-29", endDate: "2026-07-12" },
  { category: "Esports",       game: "League of Legends", name: "League of Legends Mid-Season Invitational", format: "tournament", country: "South Korea", startDate: "2026-06-28", endDate: "2026-07-12" },

  // ── July 2026 ─────────────────────────────────────────────────
  { category: "Cycling",       name: "Tour de France",                 format: "tournament", country: "France",           startDate: "2026-07-04", endDate: "2026-07-26" },
  { category: "Esports",       game: "Dota 2",           name: "Esports World Cup (Dota 2)",             format: "tournament", country: "Saudi Arabia",  startDate: "2026-07-06", endDate: "2026-07-20" },
  { category: "Golf",          name: "The Open Championship",          format: "tournament", country: "UK",               startDate: "2026-07-16", endDate: "2026-07-19" },
  { category: "Esports",       game: "Call of Duty",     name: "Call of Duty League Championship",       format: "tournament", country: "USA",           startDate: "2026-07-16", endDate: "2026-07-19" },
  { category: "Multi-Sport",   name: "Commonwealth Games",             format: "tournament", country: "Scotland",         startDate: "2026-07-23", endDate: "2026-08-02" },

  // ── August 2026 ───────────────────────────────────────────────
  { category: "Football",      name: "Major League Soccer (MLS)",      format: "season",     country: "USA",              startDate: "2026-02-21", endDate: "2026-12-12" },
  { category: "Football",      name: "FA Cup",                         format: "tournament", country: "England",          startDate: "2026-08-01", endDate: "2027-05-22" },
  { category: "Football",      name: "DFB-Pokal",                      format: "tournament", country: "Germany",          startDate: "2026-08-07", endDate: "2027-05-22" },
  { category: "Football",      name: "Coppa Italia",                   format: "tournament", country: "Italy",            startDate: "2026-08-08", endDate: "2027-05-19" },
  { category: "Football",      name: "Ligue 1",                        format: "season",     country: "France",           startDate: "2026-08-09", endDate: "2027-05-23" },
  { category: "Football",      name: "UEFA Super Cup",                 format: "event",      country: "Europe",           startDate: "2026-08-12", endDate: "2026-08-12" },
  { category: "Football",      name: "English Premier League",         format: "season",     country: "England",          startDate: "2026-08-15", endDate: "2027-05-23" },
  { category: "Football",      name: "La Liga",                        format: "season",     country: "Spain",            startDate: "2026-08-16", endDate: "2027-05-23" },
  { category: "Football",      name: "Saudi Pro League",               format: "season",     country: "Saudi Arabia",     startDate: "2026-08-20", endDate: "2027-05-20" },
  { category: "Football",      name: "Bundesliga",                     format: "season",     country: "Germany",          startDate: "2026-08-21", endDate: "2027-05-15" },
  { category: "Football",      name: "Serie A",                        format: "season",     country: "Italy",            startDate: "2026-08-23", endDate: "2027-05-23" },
  { category: "Football",      name: "Copa del Rey",                   format: "tournament", country: "Spain",            startDate: "2026-08-30", endDate: "2027-04-24" },
  { category: "Athletics",     name: "European Championships",         format: "tournament", country: "UK",               startDate: "2026-08-10", endDate: "2026-08-16" },
  { category: "Esports",       game: "Dota 2",           name: "The International",                      format: "tournament", country: "China",         startDate: "2026-08-13", endDate: "2026-08-23" },
  { category: "Gymnastics",    name: "Rhythmic Worlds",                format: "tournament", country: "Germany",          startDate: "2026-08-12", endDate: "2026-08-16" },
  { category: "Hockey",        name: "FIH World Cup",                  format: "tournament", country: "Belgium/Netherlands", startDate: "2026-08-15", endDate: "2026-08-30" },
  { category: "Badminton",     name: "World Championships",            format: "tournament", country: "India",            startDate: "2026-08-17", endDate: "2026-08-23" },
  { category: "Cycling",       name: "Vuelta a España",                format: "tournament", country: "Spain",            startDate: "2026-08-22", endDate: "2026-09-13" },
  { category: "Tennis",        name: "US Open",                        format: "tournament", country: "USA",              startDate: "2026-08-23", endDate: "2026-09-13" },

  // ── September 2026 ────────────────────────────────────────────
  { category: "Baseball",      name: "MLB Season",                     format: "season",     country: "USA",              startDate: "2026-03-26", endDate: "2026-09-27" },
  { category: "American Football", name: "NFL Season",                 format: "season",     country: "USA",              startDate: "2026-09-10", endDate: "2027-01-03" },
  { category: "Football",      name: "Coupe de France",                format: "tournament", country: "France",           startDate: "2026-09-01", endDate: "2027-05-08" },
  { category: "Basketball",    name: "FIBA Women's World Cup",         format: "tournament", country: "Germany",          startDate: "2026-09-04", endDate: "2026-09-13" },
  { category: "Football",      name: "UEFA Champions League",          format: "tournament", country: "Europe",           startDate: "2026-09-15", endDate: "2027-05-29" },
  { category: "Football",      name: "UEFA Europa League",             format: "tournament", country: "Europe",           startDate: "2026-09-17", endDate: "2027-05-26" },
  { category: "Football",      name: "UEFA Europa Conference League",  format: "tournament", country: "Europe",           startDate: "2026-09-17", endDate: "2027-05-25" },
  { category: "Multi-Sport",   name: "Asian Games",                    format: "tournament", country: "Japan",            startDate: "2026-09-19", endDate: "2026-10-04" },
  { category: "Cycling",       name: "UCI Road World Championships",   format: "tournament", country: "Canada",           startDate: "2026-09-20", endDate: "2026-09-27" },
  { category: "Esports",       game: "VALORANT",         name: "VALORANT Champions",                    format: "tournament", country: "China",         startDate: "2026-09-24", endDate: "2026-10-18" },

  // ── October 2026 ──────────────────────────────────────────────
  { category: "Baseball",      name: "MLB Postseason",                 format: "tournament", country: "USA",              startDate: "2026-09-29", endDate: "2026-10-31" },
  { category: "Basketball",    name: "NBA Season",                     format: "season",     country: "USA",              startDate: "2026-10-20", endDate: "2027-04-15" },
  { category: "Football",      name: "A-League Men",                   format: "season",     country: "Australia",        startDate: "2026-10-10", endDate: "2027-05-30" },
  { category: "Rugby League",  name: "Rugby League World Cup",         format: "tournament", country: "Australia/NZ/PNG", startDate: "2026-10-15", endDate: "2026-11-15" },
  { category: "Gymnastics",    name: "Artistic Worlds",                format: "tournament", country: "Netherlands",      startDate: "2026-10-17", endDate: "2026-10-25" },
  { category: "Esports",       game: "League of Legends", name: "League of Legends World Championship", format: "tournament", country: "USA",          startDate: "2026-10-15", endDate: "2026-11-15" },
  { category: "Multi-Sport",   name: "Youth Olympic Games",            format: "tournament", country: "Senegal",         startDate: "2026-10-31", endDate: "2026-11-13" },
  { category: "Baseball",      name: "World Series",                   format: "event",      country: "USA",              startDate: "2026-10-23", endDate: "2026-10-31" },
  { category: "Horse Racing",  name: "Melbourne Cup Carnival",         format: "event",      country: "Australia",       startDate: "2026-10-31", endDate: "2026-11-07" },
  { category: "Horse Racing",  name: "Melbourne Cup",                  format: "event",      country: "Australia",       startDate: "2026-11-03", endDate: "2026-11-03" },

  // ── November/December 2026 ────────────────────────────────────
  { category: "Esports",       game: "Counter-Strike 2", name: "Counter-Strike 2 Major (Winter)",       format: "tournament", country: "Singapore",     startDate: "2026-11-25", endDate: "2026-12-13" },

  // ── November 2026 ─────────────────────────────────────────────
  { category: "Tennis",        name: "ATP Finals",                     format: "tournament", country: "Italy",            startDate: "2026-11-15", endDate: "2026-11-22" },

  // ── December 2026 ─────────────────────────────────────────────
  { category: "Aquatics",      name: "World Swimming Championships (25m)", format: "tournament", country: "China",       startDate: "2026-12-01", endDate: "2026-12-06" },

  // ── January 2027 ──────────────────────────────────────────────
  { category: "American Football", name: "NFL Playoffs",               format: "tournament", country: "USA",              startDate: "2027-01-09", endDate: "2027-02-14" },
  { category: "Football",      name: "AFC Asian Cup",                  format: "tournament", country: "Saudi Arabia",    startDate: "2027-01-07", endDate: "2027-02-05" },
  { category: "Tennis",        name: "Australian Open",                format: "tournament", country: "Australia",       startDate: "2027-01-11", endDate: "2027-01-31" },
  { category: "Handball",      name: "Men's World Championship",       format: "tournament", country: "Germany",         startDate: "2027-01-13", endDate: "2027-01-31" },
  { category: "Esports",       game: "Apex Legends",     name: "Apex Legends Global Series Championship", format: "tournament", country: "Japan",       startDate: "2027-01-28", endDate: "2027-01-31" },

  // ── February 2027 ─────────────────────────────────────────────
  { category: "American Football", name: "Super Bowl",                 format: "event",      country: "USA",              startDate: "2027-02-14", endDate: "2027-02-14" },
  { category: "Winter Sports", name: "Alpine Ski World Championships", format: "tournament", country: "Switzerland",     startDate: "2027-02-01", endDate: "2027-02-14" },
  { category: "Rugby Union",   name: "Six Nations",                    format: "tournament", country: "Europe",          startDate: "2027-02-05", endDate: "2027-03-13" },
  { category: "Winter Sports", name: "Biathlon World Championships",   format: "tournament", country: "Estonia",         startDate: "2027-02-10", endDate: "2027-02-21" },
  { category: "Winter Sports", name: "Nordic Ski Worlds",              format: "tournament", country: "Sweden",          startDate: "2027-02-24", endDate: "2027-03-07" },

  // ── March 2027 ────────────────────────────────────────────────
  { category: "Winter Sports", name: "Snowboard & Freeski Worlds",     format: "tournament", country: "Austria",         startDate: "2027-03-06", endDate: "2027-03-21" },
  { category: "Figure Skating",name: "World Championships",            format: "tournament", country: "Finland",         startDate: "2027-03-15", endDate: "2027-03-21" },
  { category: "Horse Racing",  name: "Cheltenham Festival",            format: "event",      country: "UK",              startDate: "2027-03-16", endDate: "2027-03-19" },

  // ── April 2027 ────────────────────────────────────────────────
  { category: "Golf",             name: "Masters Tournament",             format: "tournament", country: "USA",    startDate: "2027-04-08", endDate: "2027-04-11" },
  { category: "Horse Racing",     name: "Grand National Festival",        format: "event",      country: "UK",     startDate: "2027-04-08", endDate: "2027-04-10" },
  { category: "Horse Racing",     name: "Grand National",                 format: "event",      country: "UK",     startDate: "2027-04-10", endDate: "2027-04-10" },
  { category: "Basketball",       name: "NBA Playoffs",                   format: "tournament", country: "USA",    startDate: "2027-04-17", endDate: "2027-06-20" },
  { category: "Snooker",          name: "World Snooker Championship",     format: "tournament", country: "UK",     startDate: "2027-04-17", endDate: "2027-05-03" },

  // ── May/June 2027 ─────────────────────────────────────────────
  { category: "Basketball",       name: "NBA Finals",                     format: "event",      country: "USA",    startDate: "2027-06-02", endDate: "2027-06-20" },
];

// (lengthDays is now computed in app.js after the fetch)

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
  'Motorsport (Formula 1)':      '#E63946',
  'Figure Skating':              '#AED6F1',
  'Football':                    '#52B788',
  'Golf':                        '#95D5B2',
  'Gymnastics':                  '#F48C8C',
  'Handball':                    '#E59866',
  'Hockey':                      '#56CFB2',
  'Horse Racing':                '#D4A5E0',
  'Ice Hockey':                  '#74B0E0',
  'Motorsport':                  '#E63946',
  'Multi-Sport':                 '#F4A535',
  'Rugby League':                '#E07A5F',
  'Rugby Union':                 '#C0392B',
  'Snooker':                     '#1A8A6E',
  'Table Tennis':                '#2196F3',
  'Tennis':                      '#F2C94C',
  'Winter Sports':               '#90D7FF',
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
  'Cricket':                     'fa-solid fa-baseball-bat-ball',
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
  'Motorsport (Formula 1)':      'fa-solid fa-flag-checkered',
  'Figure Skating':              'fa-solid fa-person-skating',
  'Football':                    'fa-solid fa-futbol',
  'Golf':                        'fa-solid fa-golf-ball-tee',
  'Gymnastics':                  'fa-solid fa-dumbbell',
  'Handball':                    'fa-solid fa-hand',
  'Hockey':                      'fa-solid fa-hockey-puck',
  'Horse Racing':                'fa-solid fa-horse-head',
  'Ice Hockey':                  'fa-solid fa-hockey-puck',
  'Motorsport':                  'fa-solid fa-flag-checkered',
  'Multi-Sport':                 'fa-solid fa-medal',
  'Rugby League':                'fa-solid fa-football',
  'Rugby Union':                 'fa-solid fa-football',
  'Snooker':                     'fa-solid fa-circle-dot',
  'Table Tennis':                'fa-solid fa-table-tennis-paddle-ball',
  'Tennis':                      'fa-solid fa-circle-half-stroke',
  'Winter Sports':               'fa-solid fa-snowflake',
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
  'UK':                    '🇬🇧', 'England':              '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Scotland':         '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
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
  'Pakistan':              '🇵🇰', 'Sri Lanka':            '🇱🇰', 'Bangladesh':       '🇧🇩',
  'Kazakhstan':            '🇰🇿', 'Uzbekistan':           '🇺🇿', 'North Korea':      '🇰🇵',
  // ── Oceania ───────────────────────────────────────────────
  'Australia':             '🇦🇺', 'New Zealand':          '🇳🇿', 'Papua New Guinea': '🇵🇬',
  // ── Africa ────────────────────────────────────────────────
  'South Africa':          '🇿🇦', 'Nigeria':              '🇳🇬', 'Kenya':            '🇰🇪',
  'Ghana':                 '🇬🇭', 'Ethiopia':             '🇪🇹', 'Egypt':            '🇪🇬',
  'Morocco':               '🇲🇦', 'Tunisia':              '🇹🇳', 'Algeria':          '🇩🇿',
  'Senegal':               '🇸🇳', 'Cameroon':             '🇨🇲', 'Zimbabwe':         '🇿🇼',
  // ── Multi-country / special ───────────────────────────────
  'Europe':                '🇪🇺', 'Global':               '🌍', 'Multiple':         '🌍',
  'TBC':                   '🌍', 'USA/Canada/Mexico':    '🌎', 'Belgium/Netherlands': '🌍',
  'Australia/NZ/PNG':      '🌏',
};
