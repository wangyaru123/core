import puppeteer from 'puppeteer'

// 完整运行 E7 真实场景验证实验（6 场景），等待全部完成后打印结果
const URL = 'http://localhost:5173/'
const log = (...a) => console.log(...a)

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1280, height: 1200 },
})

try {
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2000))

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('运行全部场景'))
    btn.click()
  })

  // 等待 6 行结果（上限 10 分钟）
  const deadline = Date.now() + 10 * 60000
  let done = false
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10000))
    const state = await page.evaluate(() => ({
      rows: document.querySelectorAll('.result-group tbody tr').length,
    }))
    log(`... 已渲染结果行 ${state.rows}/6`)
    if (state.rows >= 6) { done = true; break }
  }

  if (!done) log('!!! 10 分钟内未完成全部 6 场景')

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.result-group tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())
    )
  )

  log('\n===== E7 六场景墙钟耗时 =====')
  for (const row of rows) {
    log(row.join(' | '))
  }

  log('\n控制台错误数:', errors.length)
  errors.slice(0, 10).forEach((e) => log('  ERR:', e.slice(0, 200)))
} catch (e) {
  log('!!! 异常:', e.message)
} finally {
  await browser.close()
}
