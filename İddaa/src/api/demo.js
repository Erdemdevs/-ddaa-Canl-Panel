// Demo modu: API anahtarı yokken sistemi test etmek için sahte canlı maçlar
const M = [
  { id: 'd1', leagueId: 39, league: 'Premier League (DEMO)', home: 'Arsenal', away: 'Chelsea', bias: 0.75 },
  { id: 'd2', leagueId: 203, league: 'Süper Lig (DEMO)', home: 'Galatasaray', away: 'Fenerbahçe', bias: 0.5 },
  { id: 'd3', leagueId: 140, league: 'La Liga (DEMO)', home: 'Sevilla', away: 'Betis', bias: 0.3 },
].map(m => ({
  ...m, minute: 1, status: '1H', scoreH: 0, scoreA: 0, events: [],
  stats: { home: { shots: 0, sot: 0, corners: 0, possession: 50, fouls: 0, red: 0 }, away: { shots: 0, sot: 0, corners: 0, possession: 50, fouls: 0, red: 0 } },
  odds: { home: 2.1, draw: 3.4, away: 3.6, over25: 1.9, under25: 1.9 },
}));

async function fetchLive() {
  for (const m of M) {
    m.minute += 3;
    if (m.minute > 90) { m.minute = 1; m.scoreH = m.scoreA = 0; m.events = []; Object.values(m.stats).forEach(s => Object.assign(s, { shots: 0, sot: 0, corners: 0, fouls: 0, red: 0, possession: 50 })); }
    for (const side of ['home', 'away']) {
      const s = m.stats[side], f = side === 'home' ? m.bias : 1 - m.bias;
      const burst = Math.random() < 0.15 ? 2.5 : 1; // ara sıra baskı dalgası
      const sh = Math.round(Math.random() * 2 * f * burst);
      s.shots += sh; s.sot += Math.round(sh * Math.random());
      s.corners += Math.round(Math.random() * 1.5 * f * burst);
      s.possession = Math.round(100 * f * 0.6 + 20 + Math.random() * 10);
      if (Math.random() < 0.06 * f) { side === 'home' ? m.scoreH++ : m.scoreA++; m.events.push({ minute: m.minute, type: 'Goal', side }); }
    }
    m.stats.away.possession = 100 - m.stats.home.possession;
    if (Math.random() < 0.02) { const side = Math.random() < 0.5 ? 'home' : 'away'; m.stats[side].red++; m.events.push({ minute: m.minute, type: 'Card', detail: 'Red Card', side }); }
    // sahte oran hareketi
    m.odds.home = Math.max(1.2, +(m.odds.home * (1 + (Math.random() - 0.55) * 0.08)).toFixed(2));
  }
  return JSON.parse(JSON.stringify(M));
}

module.exports = { fetchLive };
