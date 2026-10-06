// usage: node shot.mjs <relative-url> <out.png> [width height] [waitMs] [evalScript]
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs'; import path from 'path';
const SP = process.env.SP || process.cwd(); // three 를 npm i 한 폴더
const ROOT = process.env.ROOT || new URL('../..', import.meta.url).pathname;
const [,, url, out, w = 1280, h = 800, wait = 3000, ev = ''] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await page.route('**/*', async route => {
  const u = new URL(route.request().url());
  if (u.hostname === 'cdn.jsdelivr.net') {
    const m = u.pathname.match(/\/npm\/three@[^/]+\/(.*)$/);
    const f = path.join(SP, 'node_modules/three', m[1]);
    return route.fulfill({ body: fs.readFileSync(f), contentType: 'application/javascript' });
  }
  if (u.hostname === 'game.local') {
    let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    const ct = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream';
    return route.fulfill({ body: fs.readFileSync(f), contentType: ct });
  }
  return route.abort();
});
await page.goto('http://game.local/' + url);
await page.waitForTimeout(+wait);
if (ev) { try { const r = await page.evaluate(ev); if (r !== undefined) console.log('EVAL:', JSON.stringify(r)); } catch (e) { console.log('EVALERR', e.message); } await page.waitForTimeout(+(process.env.AFTER ?? 1500)); }
await page.screenshot({ path: path.join(SP, 'shots', out) });
console.log(logs.filter(l => !l.includes('GPU stall')).slice(0, 30).map(l=>l.slice(0,400)).join('\n'));
await browser.close();
