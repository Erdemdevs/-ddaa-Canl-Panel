const C = require('../config');

let cache = {}; // normalize ad çifti -> {home, draw, away, over25, under25}
let lastFetch = 0;

const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(fc|cf|sc|afc|club|de|the)\b/g, '').replace(/\s+/g, ' ').trim();
const key = (h, a) => norm(h) + '|' + norm(a);

async function refresh() {
  if (!C.ODDS_API_KEY || Date.now() - lastFetch < C.ODDS_REFRESH_HOURS * 3600e3) return;
  lastFetch = Date.now();
  const next = {};
  for (const sport of Object.values(C.LEAGUES)) {
    try {
      const r = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal&apiKey=${C.ODDS_API_KEY}`);
      const games = await r.json();
      if (!Array.isArray(games)) continue;
      for (const g of games) {
        const o = {};
        const bm = g.bookmakers.find(b => b.key === 'pinnacle') || g.bookmakers[0];
        if (!bm) continue;
        const h2h = bm.markets.find(m => m.key === 'h2h');
        if (h2h) h2h.outcomes.forEach(x => {
          if (x.name === g.home_team) o.home = x.price; else if (x.name === g.away_team) o.away = x.price; else o.draw = x.price;
        });
        const tot = bm.markets.find(m => m.key === 'totals');
        if (tot) tot.outcomes.filter(x => x.point === 2.5).forEach(x => { if (x.name === 'Over') o.over25 = x.price; else o.under25 = x.price; });
        next[key(g.home_team, g.away_team)] = o;
      }
    } catch (e) {}
  }
  if (Object.keys(next).length) cache = next;
}

function getOdds(home, away) {
  const k = key(home, away);
  if (cache[k]) return cache[k];
  // gevşek eşleşme
  const h = norm(home).split(' ')[0], a = norm(away).split(' ')[0];
  const found = Object.keys(cache).find(x => x.split('|')[0].includes(h) && x.split('|')[1].includes(a));
  return found ? cache[found] : null;
}

module.exports = { refresh, getOdds };
