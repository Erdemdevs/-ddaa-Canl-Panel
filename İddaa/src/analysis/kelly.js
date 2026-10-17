const { T } = require('../config');

// p: olasılık, odds: ondalık oran. Yarım Kelly + %5 tavan
function kellyStake(p, odds, bankroll) {
  const b = odds - 1;
  if (b <= 0) return 0;
  const k = (b * p - (1 - p)) / b;
  if (k <= 0) return 0;
  const frac = Math.min(k * T.KELLY_FRACTION, T.MAX_STAKE_PCT);
  return Math.round(frac * bankroll);
}

module.exports = { kellyStake };
