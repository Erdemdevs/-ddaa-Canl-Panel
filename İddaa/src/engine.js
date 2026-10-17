const C = require('./config');
const { store, save } = require('./store');
const { analyze } = require('./analysis/signals');
const odds = require('./api/oddsApi');
const football = C.FOOTBALL_API_KEY ? require('./api/footballApi') : require('./api/demo');
store.status.mode = C.FOOTBALL_API_KEY ? 'live' : 'demo';

async function poll() {
  try {
    await odds.refresh();
    const matches = await football.fetchLive(store.watched);
    matches.forEach(m => (m.watched = store.watched.has(m.id)));
    store.status.error = null;
    let liveOdds = {};
    if (football.fetchLiveOdds && matches.some(m => m.watched)) {
      try { liveOdds = await football.fetchLiveOdds(); } catch (e) { store.status.error = 'Canlı oran: ' + e.message; }
    }
    const analysis = {};
    for (const m of matches) {
      if (!m.watched) continue; // izlenmeyen maç: sadece skor
      let oddsLive = false;
      if (m.odds) { m.oddsSource = 'canlı'; oddsLive = true; }
      else if (liveOdds[m.id]) { m.odds = liveOdds[m.id]; m.oddsSource = 'canlı'; oddsLive = true; }
      else { m.odds = odds.getOdds(m.home, m.away); if (m.odds) m.oddsSource = 'maç öncesi'; }
      if (m.odds && !store.openingOdds[m.id]) store.openingOdds[m.id] = { ...m.odds };
      const snaps = (store.snapshots[m.id] = store.snapshots[m.id] || []);
      snaps.push({ minute: m.minute, home: { ...m.stats.home }, away: { ...m.stats.away } });
      if (snaps.length > 60) snaps.shift();
      // Demo maç döngüsü başa sararsa geçmişi sıfırla
      if (snaps.length > 1 && m.minute < snaps[snaps.length - 2].minute) { store.snapshots[m.id] = [snaps.pop()]; }
      const a = analyze(m, store.snapshots[m.id], store.openingOdds[m.id], oddsLive);
      m.analysis = { probs: a.probs, pressure: a.pressure, balance: a.balance };
      for (const s of a.signals) addSignal(m, s);
    }
    store.matches = matches;
    store.status.lastPoll = new Date().toISOString();
  } catch (e) { store.status.error = e.message; }
}

function addSignal(m, s) {
  const key = [m.id, s.type, s.side, s.event || s.market].join('|');
  const last = store.signals.filter(x => x.key === key).pop();
  if (last && Date.now() - last.ts < C.T.COOLDOWN_MIN * 60e3) return;
  const sig = { id: store.nextId++, key, ts: Date.now(), matchId: m.id, match: `${m.home} - ${m.away}`, league: m.league, minute: m.minute, score: `${m.scoreH}-${m.scoreA}`, ...s };
  store.signals.push(sig);
  save();
}

function start() { poll(); setInterval(poll, C.POLL_SECONDS * (store.status.mode === 'demo' ? 0.05 : 1) * 1000); }

module.exports = { start, poll };
