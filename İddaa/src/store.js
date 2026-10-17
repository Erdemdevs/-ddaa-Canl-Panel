const fs = require('fs');
const path = require('path');
const { BANKROLL } = require('./config');

const FILE = path.join(__dirname, '..', 'data', 'history.json');
const store = {
  matches: [],
  snapshots: {}, // matchId -> [{minute, home:{shots,sot,corners,possession}, away:{...}}]
  openingOdds: {}, // matchId -> ilk görülen oranlar
  signals: [],
  status: { mode: 'demo', lastPoll: null, requests: 0, error: null },
  bankroll: BANKROLL,
  nextId: 1,
  watched: new Set(), // sadece bu maçlar için istatistik/oran isteği atılır
};

try {
  const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  store.signals = d.signals || [];
  store.bankroll = d.bankroll || BANKROLL;
  store.nextId = d.nextId || 1;
  store.watched = new Set(d.watched || []);
} catch (e) {}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ signals: store.signals.slice(-500), bankroll: store.bankroll, nextId: store.nextId, watched: [...store.watched] }));
  } catch (e) {}
}

function performance() {
  const done = store.signals.filter(s => s.result);
  let staked = 0, ret = 0, won = 0;
  done.forEach(s => {
    staked += s.stake || 0;
    if (s.result === 'won') { won++; ret += (s.stake || 0) * (s.betOdds || 0); }
  });
  return {
    total: store.signals.length, settled: done.length, won,
    hitRate: done.length ? won / done.length : 0,
    staked, profit: Math.round(ret - staked),
    roi: staked ? (ret - staked) / staked : 0,
  };
}

module.exports = { store, save, performance };
