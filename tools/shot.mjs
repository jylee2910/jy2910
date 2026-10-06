// usage: node tools/shot.mjs <url> <out.png> [waitMs] [w] [h] [js-to-eval-before-shot]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [url, out, wait = '6000', w = '1600', h = '900', js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto(url);
await page.waitForTimeout(+wait);
if (js) { await page.evaluate(js); await page.waitForTimeout(1500); }
await page.screenshot({ path: out });
console.log(logs.filter(l => !l.includes('GPU stall')).slice(0, 30).join('\n'));
await browser.close();
