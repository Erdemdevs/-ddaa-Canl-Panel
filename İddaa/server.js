const http = require('http');
const fs = require('fs');
const path = require('path');
const C = require('./src/config');
const { store, save, performance } = require('./src/store');
const engine = require('./src/engine');

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
const json = (res, d, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); };
const body = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); });

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/status') return json(res, { ...store.status, bankroll: store.bankroll, performance: performance() });
  if (url === '/api/matches') return json(res, store.matches);
  if (url === '/api/watch' && req.method === 'POST') { const b = await body(req); const id = String(b.id); b.on ? store.watched.add(id) : store.watched.delete(id); save(); clearTimeout(global.wt); global.wt = setTimeout(engine.poll, 3000); return json(res, { ok: true }); }
  if (url === '/api/signals') return json(res, store.signals.slice(-100).reverse());
  if (url === '/api/bankroll' && req.method === 'POST') { const b = await body(req); if (b.bankroll > 0) { store.bankroll = +b.bankroll; save(); } return json(res, { ok: true });}
  const m = url.match(/^\/api\/signals\/(\d+)\/result$/);
  if (m && req.method === 'POST') {
    const b = await body(req), s = store.signals.find(x => x.id === +m[1]);
    if (!s) return json(res, { error: 'yok' }, 404);
    s.result = b.result; s.stake = +b.stake || 0; s.betOdds = +b.odds || 0;
    if (b.result === 'won') store.bankroll += s.stake * (s.betOdds - 1); else if (b.result === 'lost') store.bankroll -= s.stake;
    save(); return json(res, { ok: true });
  }
  const f = path.join(__dirname, 'public', url === '/' ? 'index.html' : url);
  if (!f.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain' });
  fs.createReadStream(f).pipe(res);
}).listen(C.PORT, () => { console.log(`Dashboard: http://localhost:${C.PORT} (mod: ${store.status.mode})`); engine.start(); });
