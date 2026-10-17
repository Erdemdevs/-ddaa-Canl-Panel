function pois(k, l) {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}

// Kalan süre için gol beklentisiyle son skor olasılıkları (1X2, Üst/Alt)
function liveProbs(scoreH, scoreA, lamH, lamA, line = 2.5) {
  let h = 0, d = 0, a = 0, over = 0;
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = pois(i, lamH) * pois(j, lamA);
      const fh = scoreH + i, fa = scoreA + j;
      if (fh > fa) h += p; else if (fh === fa) d += p; else a += p;
      if (fh + fa > line) over += p;
    }
  }
  const s = h + d + a;
  return { home: h / s, draw: d / s, away: a / s, over: over / s, under: 1 - over / s };
}

// Kalan sürede en az 1 gol olasılığı
const pAtLeastOne = lam => 1 - Math.exp(-lam);

module.exports = { pois, liveProbs, pAtLeastOne };
