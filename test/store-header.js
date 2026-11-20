// Renders the App Store "universal" creative asset (product page header + search results), 16:9, 5244x2950 PNG.
// Apple crops it to 21:9 for the header and 3:2 for search; the key artwork is kept inside the area both crops keep.
// Usage: cd test && node store-header.js   (output: store/apple/graphics/universal-header-5244x2950.png)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'store', 'apple', 'graphics', 'universal-header-5244x2950.png');
const W = 5244, H = 2950;
/* safe box shared by both crops, in universal-image pixels (derived from Apple's safe areas: header 1646x661 at 1097,493 of 3840x1646; search 2168x1030 at 836,765 of 3840x2560) */
const SAFE = { x: 1498, y: 1024, w: 2248, h: 903 };
const serve = () => new Promise(res => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); fs.readFile(path.join(ROOT, u === '/' ? 'index.html' : u), (e, d) => { if (e) { r.writeHead(404); r.end(); } else r.end(d); }); });
  srv.listen(0, () => res({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
});
(async () => {
  const { srv, url } = await serve();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto(url + '#menu'); await new Promise(r => setTimeout(r, 300));
  await p.evaluate(({ SAFE, guides }) => {
    const card = (r, suit, red, rot, dx) => `<div style="position:absolute;left:${dx}px;top:0;width:340px;height:486px;border-radius:28px;background:#f3ecd8;box-shadow:0 30px 70px rgba(0,0,0,.45);transform:rotate(${rot}deg);transform-origin:50% 120%;color:${red ? '#b3202a' : '#1c1c1c'};font-family:var(--body)">
        <div style="position:absolute;left:28px;top:20px;font-weight:700;font-size:68px;line-height:1">${r}<br><span style="font-size:58px">${suit}</span></div>
        <div style="position:absolute;inset:0;display:grid;place-items:center;font-family:var(--display);font-size:236px">${r}</div>
        <div style="position:absolute;right:28px;bottom:20px;font-weight:700;font-size:68px;line-height:1;transform:rotate(180deg)">${r}<br><span style="font-size:58px">${suit}</span></div></div>`;
    document.body.innerHTML = `<div style="position:fixed;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 35%,#2a5f4d,#1d4a3c 50%,#102c24);font-family:var(--body)">
      <div style="position:absolute;left:${SAFE.x}px;top:${SAFE.y}px;width:${SAFE.w}px;height:${SAFE.h}px;display:flex;align-items:center;justify-content:space-between;${guides ? 'outline:4px dashed #fff' : ''}">
        <div style="color:var(--chalk)">
          <div style="font-family:var(--display);font-size:184px;color:var(--brass);line-height:1;letter-spacing:.01em">Card Table</div>
          <div style="font-family:var(--display);font-size:72px;margin-top:28px;opacity:.95">Six games, one deck.</div>
          <div style="font-size:38px;margin-top:34px;opacity:.7;letter-spacing:.12em;text-transform:uppercase;line-height:1.6">Klondike · FreeCell · Rummy<br>Hearts · Crazy Eights · Sevens</div>
        </div>
        <div style="position:relative;width:760px;height:580px;margin-top:60px;flex:none">${card('K', '♠', false, -14, 0)}${card('Q', '♥', true, 0, 190)}${card('J', '♣', false, 14, 380)}</div>
      </div></div>`;
  }, { SAFE, guides: process.argv.includes('--guides') });
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: OUT, type: 'png' });
  await browser.close(); srv.close();
  console.log('written', OUT);
})().catch(e => { console.error(e); process.exit(1); });
