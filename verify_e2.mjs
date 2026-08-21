import puppeteer from 'puppeteer'

// 运行 E2 集成正确性验证（三层测试），等待汇总结果
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
  await new Promise((r) => setTimeout(r, 1500))

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('运行三层测试'))
    btn.click()
  })

  // 等待 summary 出现（上限 30s）
  const deadline = Date.now() + 30000
  let summaryText = null
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000))
    summaryText = await page.evaluate(() => document.querySelector('.summary')?.textContent?.trim() || null)
    if (summaryText) break
  }

  log('===== E2 汇总 =====')
  log(summaryText || '(未出现汇总)')

  const sections = await page.evaluate(() =>
    [...document.querySelectorAll('.section')].map((s) => {
      const h = s.querySelector('h3')?.textContent || ''
      const rows = [...s.querySelectorAll('tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())
      )
      return { h, rows }
    })
  )

  for (const s of sections) {
    log('\n【' + s.h + '】')
    for (const row of s.rows) log('  ' + row.join(' | '))
  }

  log('\n控制台错误数:', errors.length)
  errors.slice(0, 10).forEach((e) => log('  ERR:', e.slice(0, 200)))
} catch (e) {
  log('!!! 异常:', e.message)
} finally {
  await browser.close()
}
