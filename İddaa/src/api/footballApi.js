const C = require('../config');
const { store } = require('../store');

const BASE = 'https://v3.football.api-sports.io';
let day = new Date().toISOString().slice(0, 10);

async function call(p) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; store.status.requests = 0; }
  if (store.status.requests >= C.DAILY_REQUEST_CAP) throw new Error('Günlük API limiti doldu');
  store.status.requests++;
  const r = await fetch(BASE + p, { headers: { 'x-apisports-key': C.FOOTBALL_API_KEY } });
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) throw new Error(JSON.stringify(j.errors));
  return j.response;
}

const num = v => (v == null ? 0 : parseInt(String(v).replace('%', '')) || 0);
function parseStats(arr, teamId) {
  const t = (arr || []).find(x => x.team.id === teamId);
  const g = n => num(((t && t.statistics) || []).find(s => s.type === n)?.value);
  return { shots: g('Total Shots'), sot: g('Shots on Goal'), corners: g('Corner Kicks'), possession: g('Ball Possession'), fouls: g('Fouls'), red: g('Red Cards') };
}

// Top 10 liglerdeki canlı maçları normalize edilmiş formatta döndürür
async function fetchLive(watched = new Set()) {
  const live = (await call('/fixtures?live=all')).filter(f => C.LEAGUES[f.league.id]);
  const out = [];
  const zero = () => ({ shots: 0, sot: 0, corners: 0, possession: 50, fouls: 0, red: 0 });
  for (const f of live) {
    let stats = [];
    const w = watched.has(String(f.fixture.id));
    if (w) { try { stats = await call('/fixtures/statistics?fixture=' + f.fixture.id); } catch (e) { store.status.error = e.message; } }
    out.push({
      id: String(f.fixture.id), leagueId: f.league.id, league: f.league.name,
      home: f.teams.home.name, away: f.teams.away.name,
      minute: f.fixture.status.elapsed || 0, status: f.fixture.status.short,
      scoreH: f.goals.home || 0, scoreA: f.goals.away || 0,
      stats: w ? { home: parseStats(stats, f.teams.home.id), away: parseStats(stats, f.teams.away.id) } : { home: zero(), away: zero() },
      events: (f.events || []).map(e => ({ minute: e.time.elapsed, type: e.type, detail: e.detail, side: e.team.id === f.teams.home.id ? 'home' : 'away' })),
    });
  }
  return out;
}

// Tüm canlı maçların canlı oranları TEK istekte: {fixtureId: {home, draw, away, over25, under25}}
async function fetchLiveOdds() {
  const res = await call('/odds/live');
  const out = {};
  (res || []).forEach(r => {
    const o = {};
    (r.odds || []).forEach(mk => {
      const name = (mk.name || '').toLowerCase();
      const vals = (mk.values || []).filter(v => !v.suspended);
      if (/fulltime result|match winner/.test(name)) vals.forEach(v => { const k = { Home: 'home', Draw: 'draw', Away: 'away' }[v.value]; if (k) o[k] = +v.odd; });
      if (/over\/under/.test(name) && !/half|corner|card/.test(name)) vals.filter(v => String(v.handicap) === '2.5').forEach(v => { if (v.value === 'Over') o.over25 = +v.odd; if (v.value === 'Under') o.under25 = +v.odd; });
    });
    if (Object.keys(o).length) out[String(r.fixture.id)] = o;
  });
  return out;
}

module.exports = { fetchLive, fetchLiveOdds };
