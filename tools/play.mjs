// usage: node tools/play.mjs <url> <outprefix> <w> <h> <script>
// script: semicolon list of steps: "wait 3000" | "key Enter" | "shot name" | "eval js"
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [url, prefix, w = '1280', h = '720', script = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (!/vite|AudioContext|cert/i.test(t)) logs.push(m.type() + ': ' + t); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
await page.goto(url);
for (const step of script.split(';').map((s) => s.trim()).filter(Boolean)) {
  const [cmd, ...rest] = step.split(' ');
  const arg = rest.join(' ');
  if (cmd === 'wait') await page.waitForTimeout(+arg);
  else if (cmd === 'key') { await page.keyboard.down(arg); await page.waitForTimeout(120); await page.keyboard.up(arg); await page.waitForTimeout(200); }
  else if (cmd === 'hold') { const [k, ms] = arg.split(' '); await page.keyboard.down(k); await page.waitForTimeout(+ms); await page.keyboard.up(k); }
  else if (cmd === 'shot') await page.screenshot({ path: prefix + arg + '.png' });
  else if (cmd === 'eval') logs.push('eval: ' + JSON.stringify(await page.evaluate(arg)));
  else if (cmd === 'waitfor') { await page.waitForFunction(arg, null, { timeout: 120000, polling: 500 }).catch(() => logs.push('waitfor timeout: ' + arg)); }
}
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
