const fs = require('fs');
const path = require('path');

// Basit .env yükleyici (bağımlılıksız)
try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  env.split('\n').forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
} catch (e) {}

module.exports = {
  PORT: +process.env.PORT || 3000,
  FOOTBALL_API_KEY: process.env.FOOTBALL_API_KEY || '',
  ODDS_API_KEY: process.env.ODDS_API_KEY || '',
  BANKROLL: +process.env.BANKROLL || 10000,
  POLL_SECONDS: +process.env.POLL_SECONDS || 120,
  DAILY_REQUEST_CAP: 95, // API-Football ücretsiz limit 100/gün
  ODDS_REFRESH_HOURS: 4, // The Odds API kredi tasarrufu
  // API-Football lig ID -> The Odds API sport key
  LEAGUES: {
    39: 'soccer_epl',
    140: 'soccer_spain_la_liga',
    78: 'soccer_germany_bundesliga',
    135: 'soccer_italy_serie_a',
    61: 'soccer_france_ligue_one',
    203: 'soccer_turkey_super_league',
    88: 'soccer_netherlands_eredivisie',
    94: 'soccer_portugal_primeira_liga',
    2: 'soccer_uefa_champs_league',
    3: 'soccer_uefa_europa_league',
  },
  // Sinyal eşikleri
  T: {
    MIN_EDGE: 0.05,
    PRESSURE: 60,
    MOMENTUM_SHIFT: 30,
    ODDS_DROP: 0.15,
    COOLDOWN_MIN: 10,
    KELLY_FRACTION: 0.5,
    MAX_STAKE_PCT: 0.05,
  },
};
