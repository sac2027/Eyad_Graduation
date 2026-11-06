const { chromium } = require('playwright')
;(async () => {
  const [, , url, out, w = '1100', h = '900', sel] = process.argv
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] })
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
  await p.goto('http://localhost:5199' + url); await p.waitForTimeout(1500)
  if (sel) await p.locator(sel).screenshot({ path: out }); else await p.screenshot({ path: out })
  await b.close()
})()
