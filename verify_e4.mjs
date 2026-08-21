import puppeteer from 'puppeteer'

// 运行 E3/E4 阈值校准（真实 Diff 计时测试集 + 逐维搜索），等待最终结果
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
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始校准'))
    btn.click()
  })

  // 等待 .final-result 出现（上限 8 分钟）
  const deadline = Date.now() + 8 * 60000
  let done = false
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15000))
    const state = await page.evaluate(() => ({
      final: !!document.querySelector('.final-result'),
      info: document.querySelector('.info')?.textContent?.trim() || null,
      progress: document.querySelector('.progress')?.textContent?.trim() || null,
    }))
    log(`... ${state.info || ''} ${state.progress || ''}`)
    if (state.final) { done = true; break }
  }
  if (!done) log('!!! 8 分钟内未完成校准')

  const info = await page.evaluate(() => document.querySelector('.info')?.textContent?.trim() || '')
  log('\n===== E3 测试集 =====')
  log(info)

  const bests = await page.evaluate(() =>
    [...document.querySelectorAll('.param-result')].map((p) => {
      const h = p.querySelector('h3')?.textContent || ''
      const best = p.querySelector('p')?.textContent?.trim() || ''
      return { h, best }
    })
  )
  log('\n===== E4 各阈值校准结果 =====')
  for (const b of bests) log(b.h + ' → ' + b.best)

  const final = await page.evaluate(() => document.querySelector('.final-result')?.textContent?.trim() || '')
  log('\n===== E4 最终结果 =====')
  log(final)

  log('\n控制台错误数:', errors.length)
  errors.slice(0, 10).forEach((e) => log('  ERR:', e.slice(0, 200)))
} catch (e) {
  log('!!! 异常:', e.message)
} finally {
  await browser.close()
}
