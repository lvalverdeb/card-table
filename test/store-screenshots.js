// Renders Google Play store assets from the live page: phone and tablet screenshots in three languages,
// plus the 1024x500 feature graphic. Usage: cd test && node store-screenshots.js   (output in store/)
// With --apple it renders App Store sizes instead (iPhone 6.9-inch and iPad 13-inch) into store/apple/.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'store', process.argv.includes('--apple') ? 'apple' : '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const serve = () => new Promise(res => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); fs.readFile(path.join(ROOT, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); r.end(); } else r.end(d); }); });
  srv.listen(0, () => res({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
});
const APPLE = process.argv.includes('--apple');
/* App Store sizes, one set per App Store Connect slot, named as the console labels them. Required: "iPhone with Dynamic
   Island (medium display)" and "iPad 13-inch display". Each slot accepts only its own pixel sizes, so a file dropped in the
   wrong slot fails with "File dimensions are invalid"; the file name prefix says which slot it belongs to. */
const SIZES = APPLE
  ? { 'iphone-dynamic-island-medium': { w: 402, h: 874, scale: 3 },    /* 1206x2622, required */
      'iphone-dynamic-island-large': { w: 440, h: 956, scale: 3 },     /* 1320x2868 */
      'iphone-face-id-large': { w: 428, h: 926, scale: 3 },            /* 1284x2778 */
      'iphone-duo-inner': { w: 669, h: 951, scale: 3 },                /* 2007x2853 */
      'iphone-duo-outer': { w: 699, h: 1017, scale: 2 },               /* 1398x2034 */
      'ipad-13': { w: 1032, h: 1376, scale: 2 } }                      /* 2064x2752, required */
  : { phone: { w: 360, h: 640, scale: 3 }, tablet7: { w: 600, h: 960, scale: 2 }, tablet10: { w: 800, h: 1280, scale: 2 } };
const FULL = ['phone', 'iphone-dynamic-island-medium', 'iphone-dynamic-island-large'];   /* all seven shots; other slots get three */
const GAMES = ['menu', 'klondike', 'freecell', 'rummy', 'hearts', 'eights', 'sevens'];
(async () => {
  const { srv, url } = await serve();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const lang of ['en', 'es', 'fr']) {
    for (const [name, sz] of Object.entries(SIZES)) {
      const games = FULL.includes(name) ? GAMES : ['menu', 'klondike', 'hearts'];
      const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: sz.scale, locale: lang });
      const p = await ctx.newPage();
      await p.goto(url + '#menu'); await sleep(300);
      await p.evaluate(() => { for (const k of Object.keys(localStorage)) localStorage.removeItem(k); });
      await p.click(`button[data-lang="${lang}"]`); await sleep(100);
      for (const g of games) {
        await p.goto(url + '#' + g); await p.reload(); await sleep(g === 'menu' ? 400 : 1800);
        if (g === 'klondike') {   /* a few moves so the table looks lived in */
          const stock = await p.evaluate(() => { const r = document.querySelector('#slot-stock').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
          for (let i = 0; i < 2; i++) { await p.mouse.click(stock.x, stock.y); await sleep(250); }
        }
        const dir = path.join(OUT, 'screenshots', lang); fs.mkdirSync(dir, { recursive: true });
        await p.screenshot({ path: path.join(dir, `${name}-${String(games.indexOf(g) + 1).padStart(2, '0')}-${g}.png`) });
      }
      await ctx.close();
    }
  }
  if (APPLE) { await browser.close(); srv.close(); console.log('App Store screenshots written to', OUT); return; }
  /* feature graphic: the app's own menu styling, composed for 1024x500 */
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(url + '#menu'); await sleep(300);
  await p.evaluate(() => {
    const card = (r, suit, red, rot, dx) => `<div style="position:absolute;left:${dx}px;top:0;width:150px;height:214px;border-radius:12px;background:#f3ecd8;box-shadow:0 10px 24px rgba(0,0,0,.45);transform:rotate(${rot}deg);transform-origin:50% 120%;color:${red ? '#b3202a' : '#1c1c1c'};font-family:var(--body)">
        <div style="position:absolute;left:12px;top:8px;font-weight:700;font-size:30px;line-height:1">${r}<br><span style="font-size:26px">${suit}</span></div>
        <div style="position:absolute;inset:0;display:grid;place-items:center;font-family:var(--display);font-size:104px">${r}</div>
        <div style="position:absolute;right:12px;bottom:8px;font-weight:700;font-size:30px;line-height:1;transform:rotate(180deg)">${r}<br><span style="font-size:26px">${suit}</span></div></div>`;
    document.body.innerHTML = `<div style="position:fixed;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#2a5f4d,#1d4a3c 55%,#102c24);display:flex;align-items:center;padding:0 64px;font-family:var(--body)">
      <div style="color:var(--chalk);flex:1"><div style="font-family:var(--display);font-size:76px;color:var(--brass);line-height:1;letter-spacing:.01em">Card Table</div>
      <div style="font-family:var(--display);font-size:30px;margin-top:14px;opacity:.95">Six games, one deck.</div>
      <div style="font-size:16px;margin-top:18px;opacity:.7;letter-spacing:.12em;text-transform:uppercase;max-width:520px;line-height:1.6">Klondike · FreeCell · Rummy<br>Hearts · Crazy Eights · Sevens</div></div>
      <div style="position:relative;width:330px;height:260px;margin-top:20px">${card('K', '♠', false, -14, 0)}${card('Q', '♥', true, 0, 80)}${card('J', '♣', false, 14, 160)}</div></div>`;
  });
  await sleep(400);
  await p.screenshot({ path: path.join(OUT, 'graphics', 'feature-graphic-1024x500.png'), clip: { x: 0, y: 0, width: 1024, height: 500 } });
  await browser.close(); srv.close();
  console.log('store assets written to', OUT);
})().catch(e => { console.error(e); process.exit(1); });
