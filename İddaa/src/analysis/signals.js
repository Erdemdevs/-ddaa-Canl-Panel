const { T } = require('../config');
const { liveProbs, pAtLeastOne } = require('./poisson');

const BASE = { home: 1.45, away: 1.15 }; // 90 dk gol beklentisi (lig ortalaması)

// Bir tarafın [from,to] dakika aralığındaki baskı skoru (0-100), 15 dk'ya normalize
function windowPressure(snaps, side, from, to) {
  if (!snaps.length) return null;
  const end = [...snaps].reverse().find(s => s.minute <= to) || snaps[snaps.length - 1];
  const start = [...snaps].reverse().find(s => s.minute <= from) || snaps[0];
  const span = Math.max(end.minute - start.minute, 1);
  if (end.minute <= start.minute) return null;
  const d = k => Math.max(end[side][k] - start[side][k], 0);
  const sot = d('sot'), off = Math.max(d('shots') - sot, 0), cor = d('corners');
  const raw = sot * 14 + off * 5 + cor * 6;
  const poss = (end[side].possession - 50) * 0.5;
  return { score: Math.max(0, Math.min(100, (raw * 15) / span + poss)), sot, shots: d('shots'), corners: cor, span };
}

function lambdas(m, odds, pressH, pressA) {
  let h = BASE.home, a = BASE.away;
  if (odds && odds.home && odds.away) { // oran ev/dep gücünü yansıtsın
    const r = Math.log(odds.away / odds.home) * 0.35;
    h *= Math.exp(r / 2); a *= Math.exp(-r / 2);
  }
  const frac = Math.max(90 - m.minute, 0) / 90;
  const mult = p => Math.max(0.7, Math.min(1.8, 1 + (p - 30) / 100));
  return { h: h * frac * mult(pressH), a: a * frac * mult(pressA), hFull: h, aFull: a };
}

function analyze(m, snaps, opening, oddsLive) {
  const out = [];
  const odds = m.odds;
  const tag = { home: m.home, away: m.away };
  const total = m.scoreH + m.scoreA;
  const pr = side => windowPressure(snaps, side, m.minute - 15, m.minute);
  const prH = pr('home'), prA = pr('away');
  const sH = prH ? prH.score : 30, sA = prA ? prA.score : 30;
  const lam = lambdas(m, odds, sH, sA);
  const probs = liveProbs(m.scoreH, m.scoreA, lam.h, lam.a, total + 0.5);

  // Güç dengesi: son 25 dk (veri yoksa maç toplamı) baskı payı -> % olarak
  const cum = s => Math.max(0, Math.min(100, ((s.sot * 14 + Math.max(s.shots - s.sot, 0) * 5 + s.corners * 6) * 15) / Math.max(m.minute, 15) + (s.possession - 50) * 0.5));
  const w25 = side => { const w = windowPressure(snaps, side, m.minute - 25, m.minute); return w ? w.score : cum(m.stats[side]); };
  const bH = w25('home'), bA = w25('away');
  const balance = { home: Math.round(((bH + 5) / (bH + bA + 10)) * 100) };

  // 1) VALUE — sadece güvenilir (canlı veya maç başı) oranlarla
  if (odds && (oddsLive || m.minute <= 10)) {
    const base = liveProbs(m.scoreH, m.scoreA, lam.h, lam.a, 2.5);
    const mk = [
      ['1 (Ev Sahibi)', base.home, odds.home, 'home'], ['X (Beraberlik)', base.draw, odds.draw, null], ['2 (Deplasman)', base.away, odds.away, 'away'],
      ['2.5 Üst', base.over, odds.over25, null], ['2.5 Alt', base.under, odds.under25, null],
    ];
    mk.forEach(([name, p, o, side]) => {
      if (!o) return;
      const edge = p - 1 / o;
      if (edge >= T.MIN_EDGE) out.push({ type: 'VALUE', side, market: name, prob: p, odds: o, strength: Math.min(100, 50 + edge * 250), reason: `Model %${(p * 100).toFixed(0)} vs oran ima ettiği %${(100 / o).toFixed(0)} (edge +%${(edge * 100).toFixed(1)})` });
    });
  }

  // 2) BASKI
  [['home', sH, prH, lam.h], ['away', sA, prA, lam.a]].forEach(([side, s, w, l]) => {
    if (s >= T.PRESSURE && m.minute >= 10 && m.minute <= 88 && w) {
      const pGoal = pAtLeastOne(l * (15 / Math.max(90 - m.minute, 15)));
      out.push({ type: 'BASKI', side, market: `${tag[side]} gol atar / ${total + 0.5} Üst`, prob: pGoal, strength: s, reason: `${tag[side]} son ${w.span}dk: ${w.shots} şut (${w.sot} isabetli), ${w.corners} korner → baskı ${s.toFixed(0)}/100` });
    }
  });

  // 3) MOMENTUM — son 10dk vs önceki 10dk
  ['home', 'away'].forEach(side => {
    const a = windowPressure(snaps, side, m.minute - 20, m.minute - 10), b = windowPressure(snaps, side, m.minute - 10, m.minute);
    if (a && b && m.minute >= 25 && b.score - a.score >= T.MOMENTUM_SHIFT && b.score >= 45)
      out.push({ type: 'MOMENTUM', side, market: `${tag[side]} sonraki gol`, strength: Math.min(100, 40 + (b.score - a.score)), reason: `${tag[side]} baskısı ${a.score.toFixed(0)} → ${b.score.toFixed(0)} yükseldi` });
  });

  // 4) OLAY
  m.events.forEach(e => {
    const age = m.minute - e.minute;
    if (e.type === 'Card' && /red/i.test(e.detail || '') && age <= 8) {
      const opp = e.side === 'home' ? 'away' : 'home';
      out.push({ type: 'OLAY', side: opp, event: `red-${e.minute}-${e.side}`, market: `${tag[opp]} gol atar / ${total + 0.5} Üst`, strength: 70, reason: `${tag[e.side]} ${e.minute}'de kırmızı kart → 10 kişi, rakibin gol şansı artar` });
    }
    if (e.type === 'Goal' && age <= 3 && m.minute >= 70 && Math.abs(m.scoreH - m.scoreA) <= 1) {
      const trailing = m.scoreH < m.scoreA ? 'home' : m.scoreA < m.scoreH ? 'away' : null;
      out.push({ type: 'OLAY', side: trailing, event: `lategoal-${e.minute}`, market: `${total + 0.5} Üst`, strength: 60, reason: `${e.minute}'de gol, fark ≤1 → geride kalan açılır, gol ihtimali yüksek` });
    }
  });

  // 5) ZAMAN
  if (m.minute >= 65 && m.minute <= 82 && total === 0 && (sH + sA) / 2 >= 35)
    out.push({ type: 'ZAMAN', side: null, market: '0.5 Üst (en az 1 gol)', prob: pAtLeastOne((lam.h + lam.a)), strength: 55 + (sH + sA) / 6, reason: `${m.minute}' 0-0 ve tempo var; kalan sürede gol olasılığı %${(pAtLeastOne(lam.h + lam.a) * 100).toFixed(0)}` });
  if (m.minute >= 38 && m.minute <= 44 && m.status === '1H' && Math.max(sH, sA) >= 50)
    out.push({ type: 'ZAMAN', side: null, market: 'İlk yarı bitmeden gol', strength: 50 + Math.max(sH, sA) / 4, reason: `İlk yarı sonu + yüksek baskı (${Math.max(sH, sA).toFixed(0)})` });

  // 6) ORAN HAREKETİ (oran ilk görülene göre düşüş)
  if (odds && opening)
    [['home', 'home', '1'], ['away', 'away', '2']].forEach(([k, side]) => {
      if (opening[k] && odds[k] && (opening[k] - odds[k]) / opening[k] >= T.ODDS_DROP)
        out.push({ type: 'ORAN', side, market: `${tag[side]} kazanır`, odds: odds[k], strength: 60, reason: `${tag[side]} oranı ${opening[k]} → ${odds[k]} (%${(((opening[k] - odds[k]) / opening[k]) * 100).toFixed(0)} düştü, piyasa yönü)` });
    });

  return { signals: out, probs, balance, pressure: { home: sH, away: sA }, lambda: lam };
}

module.exports = { analyze, windowPressure };
