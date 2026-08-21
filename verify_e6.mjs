import puppeteer from 'puppeteer'

// 运行 E6 消融实验（真实 Diff 计时测试集 + 5 变体评估），等待结果
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
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始实验'))
    btn.click()
  })

  // 等待 .result-group 出现（上限 8 分钟）
  const deadline = Date.now() + 8 * 60000
  let done = false
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15000))
    const state = await page.evaluate(() => ({
      rows: document.querySelectorAll('.result-group tbody tr').length,
      progress: document.querySelector('.progress-area')?.textContent?.trim() || null,
    }))
    log(`... 结果行 ${state.rows}/5 ${state.progress || ''}`)
    if (state.rows >= 5) { done = true; break }
  }
  if (!done) log('!!! 8 分钟内未完成消融实验')

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.result-group tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())
    )
  )
  log('\n===== E6 消融结果（真实计时） =====')
  log('变体 | 准确率 | 准确率下降 | 平均耗时 | 损失率 | 损失率上升')
  for (const row of rows) log(row.join(' | '))

  const ranking = await page.evaluate(() =>
    [...document.querySelectorAll('.importance-section tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()).join(' | ')
    )
  )
  log('\n===== 特征重要性排序 =====')
  for (const r of ranking) log(r)

  log('\n控制台错误数:', errors.length)
  errors.slice(0, 10).forEach((e) => log('  ERR:', e.slice(0, 200)))
} catch (e) {
  log('!!! 异常:', e.message)
} finally {
  await browser.close()
}
