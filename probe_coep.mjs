/**
 * probe_coep.mjs — 确认开启 COOP/COEP 跨源隔离后实验页面仍能正常加载
 * （COEP: require-corp 会阻断未声明 CORP 的跨源子资源，需验证无副作用）
 */
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()

const errors = []
const failed = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('requestfailed', r => failed.push(`${r.failure()?.errorText} ${r.url()}`))

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 20000 })
await new Promise(r => setTimeout(r, 5000))

const state = await page.evaluate(() => ({
  isolated: globalThis.crossOriginIsolated,
  rootHasContent: (document.querySelector('#app')?.children.length ?? 0) > 0,
  monitorLists: document.querySelectorAll('[data-monitor-list]').length,
  bodyText: (document.body.innerText || '').slice(0, 120).replace(/\s+/g, ' '),
}))

console.log('crossOriginIsolated :', state.isolated)
console.log('#app 已渲染         :', state.rootHasContent)
console.log('data-monitor-list   :', state.monitorLists)
console.log('页面文本片段        :', state.bodyText)
console.log('console error       :', errors.length, errors.slice(0, 5))
console.log('资源加载失败        :', failed.length, failed.slice(0, 5))

await browser.close()
