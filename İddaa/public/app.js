const $ = id => document.getElementById(id);
const j = u => fetch(u).then(r => r.json());
const icons = { VALUE: '💰', BASKI: '🔥', MOMENTUM: '📊', OLAY: '🟥', ZAMAN: '⏱️', ORAN: '📉' };
const STRONG = 70;
const open = new Set();
let seen = new Set(), first = true;

function beep() { try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.2); } catch (e) {} }

const bar = (name, a, b) => { const t = a + b; const p = t ? (a / t) * 100 : 50;
  return `<div class="row"><span class="v">${a}</span><span class="nm">${name}</span><span class="v">${b}</span><div class="sbar"><i style="width:${p}%"></i><u></u></div></div>`; };

function matchCard(m, hasSig) {
  if (!m.watched) return `<div class="m mini"><div class="mh"><span>${m.league}</span><span class="live">● ${m.minute}'</span></div>
    <div class="score"><span>${m.home}</span><span class="sc">${m.scoreH} - ${m.scoreA}</span><span class="t2">${m.away}</span></div>
    <button class="wb" onclick="watch('${m.id}',true)">👁 İzle (veri çek)</button></div>`;
  const a = m.analysis || {}, pb = a.probs || {}, h = Math.max(8, Math.min(92, (a.balance || {}).home || 50)), s = m.stats, o = m.odds;
  const odd = (l, v) => v ? `<span class="od">${l}<b>${(+v).toFixed(2)}</b></span>` : '';
  const oddsHtml = o ? `${odd('1', o.home)}${odd('X', o.draw)}${odd('2', o.away)}${odd('2.5 Üst', o.over25)}${odd('2.5 Alt', o.under25)}<span class="src">${m.oddsSource || ''} oran</span>` : '<span class="src">Oran bulunamadı</span>';
  const evs = (m.events || []).filter(e => e.type === 'Goal' || /red/i.test(e.detail || '')).map(e => `${e.minute}' ${e.type === 'Goal' ? '⚽' : '🟥'} ${e.side === 'home' ? m.home : m.away}`).join(' &nbsp;•&nbsp; ');
  return `<div class="m ${open.has(m.id) ? 'open' : ''} ${hasSig ? 'hasSig' : ''}" onclick="tog('${m.id}')">
    <div class="mh"><span>${m.league}</span><span><button class="wb on" onclick="event.stopPropagation();watch('${m.id}',false)">✕ Bırak</button> <span class="live">● ${m.minute}'</span></span></div>
    <div class="score"><span>${m.home}</span><span class="sc">${m.scoreH} - ${m.scoreA}</span><span class="t2">${m.away}</span></div>
    <div class="bal"><div class="h" style="width:${h}%">%${h}</div><div class="a" style="width:${100 - h}%">%${100 - h}</div></div>
    <div class="balLbl"><span>Son 25 dk üstünlük</span><span>${m.home} ← → ${m.away}</span></div>
    <div class="odds">${oddsHtml}</div>
    <div class="det" onclick="event.stopPropagation()">
      ${bar('Şut', s.home.shots, s.away.shots)}${bar('İsabetli şut', s.home.sot, s.away.sot)}${bar('Korner', s.home.corners, s.away.corners)}
      ${bar('Topa sahip %', s.home.possession, s.away.possession)}${bar('Faul', s.home.fouls, s.away.fouls)}${bar('Kırmızı kart', s.home.red, s.away.red)}
      <div class="muted" style="margin-top:6px">Model (kalan süre): Ev %${((pb.home || 0) * 100).toFixed(0)} • Ber %${((pb.draw || 0) * 100).toFixed(0)} • Dep %${((pb.away || 0) * 100).toFixed(0)}</div>
      ${evs ? `<div class="ev">${evs}</div>` : ''}
    </div></div>`;
}
window.tog = id => { open.has(id) ? open.delete(id) : open.add(id); render(); };
window.watch = async (id, on) => { await fetch('/api/watch', { method: 'POST', body: JSON.stringify({ id, on }) }); const m = DATA.ms.find(x => x.id === id); if (m) m.watched = on; if (on) open.add(id); render(); };

function sigCard(s) {
  const strong = s.strength >= STRONG && !s.result;
  return `<div class="sg ${s.type} ${strong ? 'strong' : ''} ${s.result ? 'done' : ''}">
    <span class="tag ${strong ? 'g' : ''}">${icons[s.type]} ${s.type}${strong ? ' • GÜÇLÜ' : ''}</span><span class="meta">${s.minute}' (${s.score}) • ${new Date(s.ts).toLocaleTimeString().slice(0, 5)}</span>
    <div><b>${s.match}</b></div><div class="mk">${s.market}${s.odds ? ' @' + s.odds : ''}</div><div class="why">${s.reason}</div>
    <div class="res">${s.result ? (s.result === 'won' ? '✅ Kazandı' : '❌ Kaybetti') : `<button class="w" onclick="res(${s.id},'won')">Kazandı</button><button class="l" onclick="res(${s.id},'lost')">Kaybetti</button>`}</div></div>`;
}

let DATA = { ms: [], sg: [] };
function render() {
  const sigMatch = new Set(DATA.sg.filter(s => s.strength >= STRONG && !s.result && Date.now() - s.ts < 15 * 60e3).map(s => s.matchId));
  $('mCount').textContent = `(${DATA.ms.length})`;
  $('matches').innerHTML = DATA.ms.length ? [...DATA.ms].sort((a, b) => b.watched - a.watched).map(m => matchCard(m, sigMatch.has(m.id))).join('') : '<div class="muted">Şu an top 10 ligde canlı maç yok.</div>';
  const list = [...DATA.sg].sort((a, b) => (b.strength >= STRONG && !b.result) - (a.strength >= STRONG && !a.result) || b.ts - a.ts).slice(0, 40);
  $('signals').innerHTML = list.map(sigCard).join('') || '<div class="muted">Henüz sinyal yok, sistem maçları izliyor…</div>';
}
window.res = async (id, result) => { await fetch(`/api/signals/${id}/result`, { method: 'POST', body: JSON.stringify({ result, stake: 1, odds: 0 }) }); load(); };

async function load() {
  const [st, ms, sg] = await Promise.all([j('/api/status'), j('/api/matches'), j('/api/signals')]);
  const p = st.performance;
  $('status').textContent = `${st.mode === 'demo' ? 'DEMO MODU' : 'CANLI'} • Son tarama: ${st.lastPoll ? new Date(st.lastPoll).toLocaleTimeString() : '-'} • İstek: ${st.requests}/95${st.error ? ' • ⚠ ' + st.error : ''}`;
  $('perf').innerHTML = `<span>Sinyal ${p.total}</span><span>Sonuç ${p.settled}</span><span>İsabet %${(p.hitRate * 100).toFixed(0)}</span>`;
  sg.forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); if (!first && s.strength >= STRONG) beep(); } });
  first = false; DATA = { ms, sg }; render();
}
load(); setInterval(load, 5000);
