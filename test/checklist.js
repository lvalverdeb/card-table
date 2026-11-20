// Drives index.html through the BUILD_GUIDE.md test checklist in headless Chrome.
// Usage: cd test && npm install && npm test
// Needs Google Chrome installed (or run `npx playwright install chromium` and drop the channel option).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..'), SHOTS = path.join(__dirname, 'screenshots'), KEY = 'klondike-v1';
const results = [], errors = [];
const ok = (name, pass, note = '') => { results.push(pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (note ? '  -- ' + note : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const f = path.normalize(path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]));
      if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' }); res.end(data);
      });
    }).listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/index.html' }));
  });
}
// Build a game state from explicit piles; every unlisted card goes face down into the stock.
const mkState = (tab, found, waste, upIds) => {
  const used = new Set([...tab.flat(), ...found.flat(), ...waste]);
  const stock = []; for (let i = 0; i < 52; i++) if (!used.has(i)) stock.push(i);
  const up = Array(52).fill(false); [...upIds, ...waste, ...found.flat()].forEach(i => up[i] = true);
  return { stock, waste, found, tab, up, score: 0, moves: 0 };
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { srv, url: URL } = await serve();
  const KLONDIKE = URL + '#klondike';     /* the page boots to the menu; the hash opens a game directly */
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  let page = await ctx.newPage();
  const watch = pg => { pg.on('pageerror', e => errors.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); }); };
  watch(page);
  const external = []; page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1')) external.push(r.url()); });
  await page.addInitScript(() => {
    window.__nopes = [];
    new MutationObserver(ms => ms.forEach(m => { if (m.target.classList.contains('nope')) window.__nopes.push(+m.target.dataset.id); }))
      .observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
  });

  const state = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  const S = async () => (await state()).S;
  const rect = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
  const cardSel = id => `.card[data-id="${id}"]`;
  const stripPoint = async id => { const r = await rect(cardSel(id)); return { x: r.x + r.w / 2, y: r.y + r.h * 0.12 }; };
  const centre = async sel => { const r = await rect(sel); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
  const tap = async id => { const p = await stripPoint(id); await page.mouse.click(p.x, p.y); await sleep(120); };
  const dragTo = async (id, targetSel) => {
    const from = await stripPoint(id), cr = await rect(cardSel(id)), to = await centre(targetSel);
    const dx = to.x - (cr.x + cr.w / 2), dy = to.y - (cr.y + cr.h / 2);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 });
    await page.mouse.up(); await sleep(150);
  };
  const loadFixture = async (Sx, extra = {}) => {
    const snap = { S: Sx, first: JSON.stringify(Sx), history: [], drawCount: 1, seconds: 0, won: false, ...extra };
    await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, snap]);
    await page.reload(); await page.waitForSelector('.card'); await sleep(300);
  };
  const shot = name => page.screenshot({ path: path.join(SHOTS, name) });

  // 1. fresh deal
  await page.goto(KLONDIKE); await page.evaluate(k => { localStorage.clear(); }, KEY);
  await page.reload(); await page.waitForSelector('.card'); await sleep(1400);
  await page.click('#s-klondike [data-act="about"]');
  const aboutTop = await page.evaluate(() => document.querySelector('#about .panel').scrollTop);
  const aboutCredit = await page.evaluate(() => document.querySelector('#about .credit').textContent);
  ok('0c About opens from the footer, scrolled to its title', await page.isVisible('#about') && aboutTop === 0 && aboutCredit === 'Luis Valverde Badilla, San José, Costa Rica', `scrollTop=${aboutTop} credit=${aboutCredit}`);
  await shot('00-about.png');
  await page.keyboard.press('Escape');
  ok('0d Escape closes About', !(await page.isVisible('#about')));
  await shot('01-desktop-deal.png');
  let s = await S();
  const perCol = s.tab.map(c => c.length);
  const lastUpOnly = s.tab.every(c => c.every((id, i) => s.up[id] === (i === c.length - 1)));
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight); });
  ok('0f both fonts load from the local files', fonts.some(f => f.startsWith('Instrument Sans')) && fonts.some(f => f.startsWith('Young Serif')), fonts.join(', '));
  ok('0g no requests leave the device', external.length === 0, external.join(' '));
  // 0h. the whole app runs with networking switched off: a separate offline context opens index.html from disk and plays every game
  {
    const octx = await browser.newContext({ offline: true, viewport: { width: 1200, height: 800 } });
    const op = await octx.newPage(); const oerrs = []; op.on('pageerror', e => oerrs.push(e.message));
    const netFails = await op.evaluate(() => fetch('https://example.com/').then(() => false, () => true)).catch(() => true);   /* proves the context is offline */
    const seen = []; op.on('request', r => seen.push(r.url()));
    await op.goto('file://' + path.join(ROOT, 'index.html') + '#klondike'); await op.waitForSelector('.card'); await sleep(1400);
    const oc = await op.evaluate(() => { const r = document.querySelector('#slot-stock').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await op.mouse.click(oc.x, oc.y); await sleep(300);
    const odrew = await op.evaluate(() => JSON.parse(localStorage.getItem('klondike-v1')).S.waste.length === 1);
    const ofonts = await op.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').length; });
    const played = {};
    for (const g of ['freecell', 'rummy', 'sevens', 'eights', 'hearts']) {
      await op.evaluate(h => { location.hash = h; }, g); await sleep(400);
      if (g === 'freecell') { await op.evaluate(() => { const c = document.querySelectorAll('#s-freecell [data-col="0"][data-idx]'); c[c.length - 1].click(); }); }
      else if (g === 'rummy') { const b = await op.$('#s-rummy [data-act="stock"]'); if (b) await b.click(); }
      else if (g === 'hearts') { await op.evaluate(() => { const c = document.querySelectorAll('#s-hearts [data-el="hand"] [data-id]'); if (c.length !== 13) throw new Error('hearts dealt ' + c.length); }); }
      await sleep(1200);
      played[g] = await op.evaluate(id => !document.querySelector('#s-' + id).hidden && document.querySelector('#s-' + id).querySelectorAll('.pc, .card').length > 0, g);
    }
    const nonLocal = seen.filter(u => !u.startsWith('file://'));
    ok('0h every game runs with the network switched off', netFails && odrew && ofonts >= 2 && Object.values(played).every(Boolean) && nonLocal.length === 0 && oerrs.length === 0,
      `networkBlocked=${netFails} drew=${odrew} fonts=${ofonts} played=${JSON.stringify(played)} nonLocalRequests=${nonLocal.join(' ')} errors=${oerrs.join(' | ')}`);
    await octx.close();
  }
  ok('1 new deal: 1..7 per column, only last face up, 24 in stock', eq(perCol, [1,2,3,4,5,6,7]) && lastUpOnly && s.stock.length === 24 && s.stock.every(id => !s.up[id]), `cols=${perCol} stock=${s.stock.length}`);

  // 13. sound button (audible output cannot be checked here)
  await page.mouse.click(600, 60);
  const lbl1 = await page.textContent('#s-klondike .sound-btn');
  await page.click('#s-klondike .sound-btn'); const lbl2 = await page.textContent('#s-klondike .sound-btn');
  await page.click('#s-klondike .sound-btn'); const lbl3 = await page.textContent('#s-klondike .sound-btn');
  ok('13 sound button toggles', lbl2.trim() === 'Sound off' && lbl3.trim() !== 'Sound off', `after gesture="${lbl1.trim()}" muted="${lbl2.trim()}" unmuted="${lbl3.trim()}"`);

  // 5. draw 1 / draw 3 / recycle, 6. undo of draws
  const stockC = await centre('#slot-stock');
  await page.mouse.click(stockC.x, stockC.y); await sleep(120);
  s = await S(); ok('5a draw 1 moves one card to waste, face up', s.waste.length === 1 && s.stock.length === 23 && s.up[s.waste[0]]);
  await page.click('#d3'); await page.mouse.click(stockC.x, stockC.y); await sleep(120);
  s = await S(); ok('5b draw 3 moves three cards', s.waste.length === 4 && s.stock.length === 20);
  for (let i = 0; i < 7; i++) { await page.mouse.click(stockC.x, stockC.y); await sleep(200); }
  s = await S(); ok('5c stock empties after repeated draws', s.stock.length === 0 && s.waste.length === 24, `stock=${s.stock.length} waste=${s.waste.length}`);
  await page.mouse.click(stockC.x, stockC.y); await sleep(120);
  s = await S(); ok('5d tapping empty stock recycles waste face down', s.stock.length === 24 && s.waste.length === 0 && s.stock.every(id => !s.up[id]));
  await page.click('#undo'); await sleep(120);
  s = await S(); ok('6a undo reverses the recycle', s.stock.length === 0 && s.waste.length === 24);
  await page.click('#undo'); await sleep(120);
  s = await S(); ok('6b undo reverses the last (partial) draw', s.stock.length === 2 && s.waste.length === 22, `stock=${s.stock.length} waste=${s.waste.length}`);
  await page.click('#d1');

  // 7. restart / new deal
  let snap = await state(); const firstBefore = snap.first;
  await page.click('#restart'); await sleep(200);
  snap = await state(); ok('7a restart replays the same deal', eq(snap.S, JSON.parse(firstBefore)) && snap.first === firstBefore && snap.S.moves === 0);
  await page.click('#new'); await sleep(1400);
  snap = await state(); ok('7b new deal gives a different deal', snap.first !== firstBefore);

  // 2, 3, 4: rules fixture. ids: K♠12 Q♥24 7♦32 6♠5 5♣43 8♣46 A♥13 3♠2
  const F1 = mkState([[12], [], [24], [43, 32, 5], [46], [13], [2]], [[],[],[],[]], [], [12, 24, 32, 5, 46, 13, 2]);
  await loadFixture(F1);
  s = await S(); ok('10a fixture loaded through localStorage restore', eq(s.tab, F1.tab) && s.stock.length === 44);
  await shot('02-rules-fixture.png');
  await tap(13); s = await S();
  ok('2a tapping an Ace sends it to a foundation', s.found.some(p => eq(p, [13])) && s.tab[5].length === 0 && s.score === 10, `score=${s.score}`);
  await page.evaluate(() => window.__nopes.length = 0);
  const before = JSON.stringify(s);
  await tap(2); s = await S(); const nopes = await page.evaluate(() => window.__nopes.slice());
  ok('2b tapping a card with no legal move shakes it and changes nothing', nopes.includes(2) && JSON.stringify(s) === before);
  await dragTo(32, cardSel(46)); s = await S();
  ok('3a dragging a 2-card run onto a legal column moves both and flips the card beneath', eq(s.tab[4], [46, 32, 5]) && eq(s.tab[3], [43]) && s.up[43] === true && s.score === 15, `score=${s.score}`);
  const tBefore = await page.evaluate(sel => document.querySelector(sel).style.transform, cardSel(24));
  const sBefore = JSON.stringify(s);
  await dragTo(24, cardSel(2)); s = await S();
  const tAfter = await page.evaluate(sel => document.querySelector(sel).style.transform, cardSel(24));
  ok('3b illegal drop returns the card and changes nothing', JSON.stringify(s) === sBefore && tBefore === tAfter);
  await dragTo(24, '#slot-t1'); s = await S();
  ok('4a a Queen cannot be dropped on an empty column', s.tab[1].length === 0 && eq(s.tab[2], [24]));
  await tap(24); s = await S();
  ok('4b tapping the Queen auto-moves it onto the King in column 0', eq(s.tab[0], [12, 24]) && s.tab[2].length === 0);
  await dragTo(12, '#slot-t1'); s = await S();
  ok('4c a King-led run can be dropped on an empty column', eq(s.tab[1], [12, 24]) && s.tab[0].length === 0);
  await dragTo(24, '#slot-t0'); s = await S();
  ok('4d the Queen alone cannot be dropped back on the now-empty column 0', eq(s.tab[1], [12, 24]) && s.tab[0].length === 0);

  // 6. undo chain restores positions, flip and score
  await page.click('#undo'); await sleep(100); await page.click('#undo'); await sleep(100);
  s = await S(); ok('6c undo twice restores positions', eq(s.tab[0], [12]) && eq(s.tab[2], [24]) && s.tab[1].length === 0);
  await page.click('#undo'); await sleep(100); s = await S();
  ok('6d undo restores flipped card and score', eq(s.tab[3], [43, 32, 5]) && s.up[43] === false && s.score === 10, `score=${s.score}`);

  // 10. reload restores progress
  const beforeReload = await state();
  await page.reload(); await page.waitForSelector('.card'); await sleep(300);
  const afterReload = await state();
  ok('10b reload restores game in progress', eq(beforeReload.S, afterReload.S) && beforeReload.history.length === afterReload.history.length);

  // 8, 9. finish for me, cascade, win screen
  const F2 = mkState(
    [[12, 24, 10], [25, 11, 23], [38, 50, 36], [51, 37, 49], [], [], []],
    [[0,1,2,3,4,5,6,7,8,9], [13,14,15,16,17,18,19,20,21,22], [26,27,28,29,30,31,32,33,34,35], [39,40,41,42,43,44,45,46,47,48]],
    [], [12,24,10,25,11,23,38,50,36,51,37,49]);
  F2.moves = 100; F2.score = 400;
  await loadFixture(F2, { seconds: 125 });
  ok('8a Finish for me appears when stock and waste are empty and all cards face up', await page.isVisible('#finish'));
  await page.click('#finish');
  await page.waitForFunction(() => !document.querySelector('#fx').hidden, { timeout: 10000 });
  await sleep(1800); await shot('03-cascade.png');
  await page.waitForSelector('#win:not([hidden])', { timeout: 20000 });
  s = await S(); const snapW = await state();
  ok('8b Finish completes the game', s.found.every(p => p.length === 13) && snapW.won === true, `moves=${s.moves} score=${s.score}`);
  await shot('04-win.png');
  const w = await page.evaluate(() => ({ t: document.querySelector('#w-time').textContent, m: document.querySelector('#w-moves').textContent, s: document.querySelector('#w-score').textContent }));
  ok('9 win screen shows time, moves and score', (w.t === '2:05' || w.t === '2:06') && w.m === '112' && w.s === '520', JSON.stringify(w));
  const F3 = JSON.parse(JSON.stringify(F2)); F3.waste = [F3.tab[0].pop()];
  await loadFixture(F3);
  ok('8c Finish stays hidden while a card remains in the waste', !(await page.isVisible('#finish')));

  // 11. resize re-fits
  await loadFixture(F1);
  const cwDesk = await page.evaluate(() => getComputedStyle(document.querySelector('#board')).getPropertyValue('--cw'));
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
  const cwPhone = await page.evaluate(() => getComputedStyle(document.querySelector('#board')).getPropertyValue('--cw'));
  const fits = await page.evaluate(() => { const b = document.querySelector('#board').getBoundingClientRect(); return b.right <= innerWidth && b.left >= 0; });
  await shot('05-phone.png');
  ok('11 resize re-fits the cards', cwDesk !== cwPhone && fits, `cw desktop=${cwDesk.trim()} phone=${cwPhone.trim()}`);
  const footerRows = await page.evaluate(() => new Set([...document.querySelectorAll('#s-klondike footer .group > *')].filter(b => !b.hidden && b.offsetParent).map(b => Math.round(b.getBoundingClientRect().top))).size);
  ok('11b footer fits in two rows at phone width', footerRows <= 2, `rows=${footerRows}`);
  await page.close();

  // 12. touch drag does not scroll (real touch events through CDP on a short, scrollable viewport)
  const mctx = await browser.newContext({ viewport: { width: 390, height: 420 }, hasTouch: true, isMobile: true });
  const mp = await mctx.newPage();
  mp.on('pageerror', e => errors.push('pageerror(mobile): ' + e.message));
  const tall = mkState([[12,24,10,22,8,20,6,18,4,16,2,14], [], [], [], [], [], [41]], [[],[],[],[]], [], [12,24,10,22,8,20,6,18,4,16,2,14,41]);
  await mp.goto(KLONDIKE);
  await mp.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, { S: tall, first: JSON.stringify(tall), history: [], drawCount: 1, seconds: 0, won: false }]);
  await mp.reload(); await mp.waitForSelector('.card'); await sleep(400);
  const scrollable = await mp.evaluate(() => { const a = document.querySelector('#area'); return a.scrollHeight > a.clientHeight; });
  const cdp = await mctx.newCDPSession(mp);
  const pt = sel => mp.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  await mp.evaluate(() => document.querySelector('.card[data-id="14"]').scrollIntoView({ block: 'center' }));
  const scroll0 = await mp.evaluate(() => document.querySelector('#area').scrollTop);
  const from = await pt(cardSel(14)), to = await pt(cardSel(41));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= 15; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 15, y: from.y + (to.y - from.y) * i / 15 }] });
  const scrollMid = await mp.evaluate(() => document.querySelector('#area').scrollTop);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  const ms = await mp.evaluate(k => JSON.parse(localStorage.getItem(k)).S, KEY);
  ok('12 touch drag moves the card and does not scroll the felt', scrollable && scrollMid === scroll0 && eq(ms.tab[6], [41, 14]), `scrollable=${scrollable} scrollTop during drag ${scroll0}->${scrollMid} tab6=${ms.tab[6]}`);
  await mp.screenshot({ path: path.join(SHOTS, '06-touch.png') });
  await mctx.close();

  // 14. menu opens every game; 15. Crazy Eights can pass when nothing can be drawn
  const sctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const sp = await sctx.newPage(); const serrs = []; sp.on('pageerror', e => serrs.push(e.message));
  await sp.goto(URL); await sp.evaluate(() => localStorage.clear()); await sp.reload(); await sleep(300);
  await sp.screenshot({ path: path.join(SHOTS, '07-menu.png') });
  const opened = [];
  for (const g of ['klondike', 'freecell', 'rummy', 'eights', 'hearts', 'sevens']) {
    await sp.click(`.tile[data-go="${g}"]`); await sleep(600);
    opened.push(await sp.evaluate(g => !document.querySelector('#s-' + g).hidden, g));
    await sp.click('#home'); await sleep(200);
  }
  ok('14 menu opens every game and Games returns to the menu', opened.every(Boolean) && serrs.length === 0, `opened=${opened.join(',')} errors=${serrs.join(' | ')}`);
  const E = { n: 2, names: ['You', 'North'], hands: [[17, 34, 51], [15]], stock: [], discard: [1], suit: 0, turn: 0, drew: false, choosing: -1, passes: 0, over: false, winner: -1, won: 0, matchOver: false, msg: '', totals: [0, 0], rounds: 0 };
  await sp.evaluate(v => localStorage.setItem('eights-v1', JSON.stringify({ S: v })), E);
  await sp.goto(URL + '#eights'); await sp.reload(); await sleep(500);
  const passOn = await sp.evaluate(() => !document.querySelector('#s-eights [data-act="pass"]').disabled);
  const stockGhost = await sp.evaluate(() => !document.querySelector('#s-eights [data-act="stock"]'));
  if (passOn) await sp.click('#s-eights [data-act="pass"]'); await sleep(1500);
  const E2 = await sp.evaluate(() => JSON.parse(localStorage.getItem('eights-v1')).S);
  ok('15 Crazy Eights: Pass is enabled when nothing can be drawn, and the round resolves', passOn && stockGhost && (E2.passes >= 1 || E2.over), `passEnabled=${passOn} noStockButton=${stockGhost} passes=${E2.passes} over=${E2.over}`);
  // 16. Rummy and Sevens result panels come from the shared helper
  const RU = { n: 2, names: ['You', 'North'], hands: [[0, 1], [2, 3, 4]], stock: [5, 6, 7], discard: [8], melds: [], phase: 'draw', taken: -1, turn: 0, over: true, winner: 0, won: 9, recycles: 0, matchOver: false, msg: '', totals: [9, 0], rounds: 1 };
  await sp.evaluate(v => localStorage.setItem('rummy-v1', JSON.stringify({ S: v, sortMode: 'rank' })), RU);
  await sp.goto(URL + '#rummy'); await sp.reload(); await sleep(500);
  const ruPanel = await sp.evaluate(() => { const o = document.querySelector('#s-rummy [data-el="over"]'); return !o.hidden && o.textContent.includes('You went out') && !!o.querySelector('[data-act="next"]') && o.querySelectorAll('tbody tr').length === 2; });
  const SV = { n: 2, names: ['You', 'North'], hands: [[], [1, 2, 3]], lo: [0, 0, 0, 0], hi: [0, 0, 0, 0], empty: true, turn: 0, over: true, winner: 0, totals: [0, 3], rounds: 1, msg: '' };
  await sp.evaluate(v => localStorage.setItem('sevens-v1', JSON.stringify({ S: v })), SV);
  await sp.goto(URL + '#sevens'); await sp.reload(); await sleep(500);
  const svPanel = await sp.evaluate(() => { const o = document.querySelector('#s-sevens [data-el="over"]'); return !o.hidden && o.textContent.includes('You won the round') && !!o.querySelector('[data-act="next"]') && o.querySelectorAll('tbody tr').length === 2; });
  ok('16 Rummy and Sevens show their round result through the shared panel', ruPanel && svPanel && serrs.length === 0, `rummy=${ruPanel} sevens=${svPanel} errors=${serrs.join(' | ')}`);
  // 17. FreeCell keeps a selection when the Sound button is pressed
  await sp.goto(URL + '#freecell'); await sp.reload(); await sleep(500);
  await sp.evaluate(() => { const cards = document.querySelectorAll('#s-freecell [data-col="0"][data-idx]'); cards[cards.length - 1].click(); });
  await sleep(100);
  const picked = await sp.evaluate(() => document.querySelectorAll('#s-freecell .pick').length);
  await sp.click('#s-freecell .sound-btn'); await sleep(100);
  const stillPicked = await sp.evaluate(() => document.querySelectorAll('#s-freecell .pick').length);
  await sp.evaluate(() => document.querySelector('#s-freecell [data-el="fc"]').click()); await sleep(100);
  const cleared = await sp.evaluate(() => document.querySelectorAll('#s-freecell .pick').length);
  ok('17 FreeCell keeps its selection across a Sound press and clears it on a felt tap', picked > 0 && stillPicked === picked && cleared === 0, `picked=${picked} afterSound=${stillPicked} afterFeltTap=${cleared}`);
  // 18. card designs: the picker restyles every card, and the choice survives a reload
  await sp.goto(URL + '#menu'); await sp.reload(); await sleep(300);
  const backOf = () => sp.evaluate(() => getComputedStyle(document.querySelector('.tile .fan .pc .face')).backgroundColor + '|' + getComputedStyle(document.documentElement).getPropertyValue('--back').trim());
  const before18 = await backOf();
  await sp.click('button[data-deck="midnight"]'); await sleep(100);
  const after18 = await backOf();
  const checked = await sp.evaluate(() => [...document.querySelectorAll('button[data-deck]')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.dataset.deck).join(','));
  await sp.screenshot({ path: path.join(SHOTS, '08-designs.png') });
  await sp.goto(URL + '#klondike'); await sp.reload(); await sleep(1600);
  const kept = await sp.evaluate(() => document.documentElement.dataset.deck);
  const klondikeBack = await sp.evaluate(() => getComputedStyle(document.querySelector('#s-klondike .card .back')).backgroundColor);
  await sp.screenshot({ path: path.join(SHOTS, '09-klondike-midnight.png') });
  ok('18 card design picker restyles the cards and persists', before18 !== after18 && checked === 'midnight' && kept === 'midnight' && klondikeBack === 'rgb(30, 58, 99)', `deck=${kept} back=${klondikeBack}`);
  await sp.goto(URL + '#menu'); await sp.reload(); await sleep(300);
  await sp.click('button[data-deck="cascade"]'); await sleep(100);
  const cascadeBack = await sp.evaluate(() => { const b = document.querySelector('.deck[data-deck="cascade"] .back'); const cs = getComputedStyle(b); return cs.backgroundColor + ' border=' + cs.borderTopColor; });
  await sp.screenshot({ path: path.join(SHOTS, '10-cascade-design.png') });
  ok('18b Cascade design uses the felt green back with a brass border', cascadeBack === 'rgb(29, 74, 60) border=rgb(212, 173, 90)', cascadeBack);
  await sp.click('button[data-deck="large"]'); await sleep(100);
  const previews = await sp.evaluate(() => {
    const q = (d, s) => getComputedStyle(document.querySelector('.deck[data-deck="' + d + '"] ' + s));
    return { classicBack: q('classic', '.back').backgroundColor, classicBorder: q('classic', '.back').borderTopColor, classicIdx: q('classic', '.idx').fontSize, largeIdx: q('large', '.idx').fontSize, pageIdx: getComputedStyle(document.querySelector('.tile .fan .idx')).getPropertyValue('--idx-size').trim(), largeVar: q('large', '.idx').getPropertyValue('--idx-size').trim() };
  });
  ok('18c previews keep their own design while the page uses another', previews.classicBack === 'rgb(123, 32, 48)' && previews.classicBorder === 'rgb(245, 239, 224)' && previews.classicIdx !== previews.largeIdx && previews.pageIdx === previews.largeVar, JSON.stringify(previews));
  await sp.evaluate(() => localStorage.removeItem('cardtable-deck'));
  // 19. language picker: translates the menu and a game's status, persists, and the browser language picks the default
  await sp.goto(URL + '#menu'); await sp.reload(); await sleep(300);
  await sp.click('button[data-lang="es"]'); await sleep(100);
  const es = await sp.evaluate(() => ({ lang: document.documentElement.lang, lede: document.querySelector('.lede').textContent, deck: document.querySelector('.deck[data-deck="large"] [data-i18n]').textContent, fans: document.querySelectorAll('.deck[data-deck] .fan .pc').length }));
  await sp.evaluate(() => localStorage.removeItem('rummy-v1'));
  await sp.goto(URL + '#rummy'); await sp.reload(); await sleep(400);
  const esRummy = await sp.evaluate(() => ({ title: document.querySelector('#title').textContent, status: document.querySelector('#s-rummy [data-el="status"]').textContent, seat: document.querySelector('#s-rummy .seat b').textContent, sound: document.querySelector('#s-rummy .sound-btn').textContent }));
  await sp.goto(URL + '#menu'); await sleep(100); await sp.click('button[data-lang="en"]'); await sleep(100);
  const back = await sp.evaluate(() => document.documentElement.lang + '|' + document.querySelector('.lede').textContent.slice(0, 9));
  const fctx = await browser.newContext({ locale: 'fr-CA', viewport: { width: 1200, height: 800 } });
  const fp = await fctx.newPage(); await fp.goto(URL + '#menu'); await sleep(300);
  const fr = await fp.evaluate(() => document.documentElement.lang + '|' + document.querySelector('#title').textContent);
  await fctx.close();
  ok('19 language picker translates the menu and games, persists, and follows the browser language',
    es.lang === 'es-419' && es.lede.startsWith('Seis juegos') && es.deck === 'Letra grande' && es.fans === 15 &&
    esRummy.title === 'Rummy' && /^Nueva ronda\. Empiezas tú\. Tu turno/.test(esRummy.status) && esRummy.seat === 'Tú' && /^Sonido (activado|apagado)$/.test(esRummy.sound) &&
    back === 'en|Six games' && fr === 'fr|Table de cartes' && serrs.length === 0,
    `es=${JSON.stringify(es)} rummy=${JSON.stringify(esRummy)} back=${back} fr=${fr} errors=${serrs.join(' | ')}`);
  await sp.evaluate(() => { localStorage.removeItem('cardtable-lang'); localStorage.removeItem('rummy-v1'); });
  await sctx.close();

  // 20. Vegas mode: $52 ante, $5 a foundation card, limited stock passes, a bank that carries across deals and resets only by its button
  page = await ctx.newPage(); watch(page);      /* the first page was closed after the resize test */
  await page.goto(KLONDIKE); await sleep(200);
  const V = mkState([[12], [25], [38], [], [], [], []],
    [[0,1,2,3,4,5,6,7,8,9,10,11], [13,14,15,16,17,18,19,20,21,22,23,24], [26,27,28,29,30,31,32,33,34,35,36,37], [39,40,41,42,43,44,45,46,47,48,49]],
    [], [12, 25, 38]);                                   /* 47 cards home, kings in play, Q♣ 50 and K♣ 51 in the stock */
  V.score = 5 * 47 - 52;
  await loadFixture(V, { vegas: true, bank: 100 });
  const hdr = () => page.evaluate(() => ({ label: document.querySelector('#score-label').textContent, score: document.querySelector('#score').textContent, reset: !document.querySelector('#bank-reset').hidden, vegasPressed: document.querySelector('#mv').getAttribute('aria-pressed') }));
  let h = await hdr();
  ok('20a Vegas shows the running bank as money', h.label === 'Bank' && h.score === '+$283' && h.reset && h.vegasPressed === 'true', JSON.stringify(h));
  const stockV = await centre('#slot-stock');
  for (let i = 0; i < 3; i++) { await page.mouse.click(stockV.x, stockV.y); await sleep(150); }
  s = await S(); ok('20b Draw 1 allows no second pass: the empty stock refuses to recycle', s.stock.length === 0 && s.waste.length === 2 && (s.passes | 0) === 0, `stock=${s.stock.length} waste=${s.waste.length} passes=${s.passes}`);
  await page.click('#d3');
  for (let i = 0; i < 5; i++) { await page.mouse.click(stockV.x, stockV.y); await sleep(150); }   /* recycle, draw, recycle, draw, refused */
  s = await S(); ok('20c Draw 3 allows three passes, then the stock stays empty', s.stock.length === 0 && s.waste.length === 2 && s.passes === 2, `stock=${s.stock.length} waste=${s.waste.length} passes=${s.passes}`);
  const dead = await page.evaluate(() => { const e = document.querySelector('#slot-stock'); return { x: e.textContent, cls: e.classList.contains('dead'), aria: e.getAttribute('aria-disabled') + '|' + e.getAttribute('aria-label') }; });
  ok('20c2 the spent stock shows a crossed, disabled card', dead.x === '✕' && dead.cls && dead.aria === 'true|No passes left through the stock', JSON.stringify(dead));
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(300); await shot('17-vegas-spent-stock.png'); await page.setViewportSize({ width: 1200, height: 800 }); await sleep(300);
  await tap(s.waste[1]); await tap(s.waste[0]); s = await S();
  h = await hdr();
  ok('20d each foundation card pays $5', s.found[3].length === 13 && s.score === 193 && h.score === '+$293', `score=${s.score} ${JSON.stringify(h)}`);
  await page.click('#new'); await sleep(1400);
  let snapV = await state(); h = await hdr();
  ok('20e New deal banks the result and the next deal starts at −$52', snapV.bank === 293 && snapV.S.score === -52 && h.score === '+$241', `bank=${snapV.bank} ${JSON.stringify(h)}`);
  await page.click('#new'); await sleep(1400); snapV = await state();
  ok('20f an untouched deal is free', snapV.bank === 293, `bank=${snapV.bank}`);
  await page.reload(); await page.waitForSelector('.card'); await sleep(300);
  snapV = await state(); h = await hdr();
  ok('20g Vegas mode and the bank survive a reload', snapV.vegas === true && snapV.bank === 293 && h.vegasPressed === 'true', JSON.stringify(h));
  await page.click('#bank-reset'); await sleep(100); snapV = await state(); h = await hdr();
  ok('20h Reset bank returns the bank to $0 and keeps the deal', snapV.bank === 0 && h.score === '−$52' && snapV.S.score === -52, `bank=${snapV.bank} ${JSON.stringify(h)}`);
  await page.setViewportSize({ width: 390, height: 844 }); await sleep(300);
  const vegasRows = await page.evaluate(() => new Set([...document.querySelectorAll('#s-klondike footer .group > *')].filter(b => !b.hidden && b.offsetParent).map(b => Math.round(b.getBoundingClientRect().top))).size);
  ok('20i the Vegas footer still fits in two rows at phone width', vegasRows <= 2, `rows=${vegasRows}`);
  await page.setViewportSize({ width: 1200, height: 800 }); await sleep(300);
  await page.click('#mv'); await sleep(1400); snapV = await state(); h = await hdr();
  ok('20j pressing Vegas again restores plain scoring and hides the bank', snapV.vegas === false && snapV.S.score === 0 && h.label === 'Score' && h.score === '0' && !h.reset, JSON.stringify(h));
  await page.evaluate(k => localStorage.removeItem(k), KEY);

  await browser.close(); srv.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (errors.length) { console.log('BROWSER ERRORS:'); errors.forEach(e => console.log('  ' + e)); } else console.log('no console or page errors');
  process.exit(passed === results.length && !errors.length ? 0 : 1);
})().catch(e => { console.error('DRIVER CRASH', e); process.exit(2); });
