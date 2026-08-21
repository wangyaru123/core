import puppeteer from 'puppeteer'

const URL = 'http://localhost:5173/'
const log = (...a) => console.log(...a)

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: 1280, height: 900 },
})

try {
  const page = await browser.newPage()

  const consoleErrors = []
  const consoleWarns = []
  const consoleLogs = []
  page.on('console', (msg) => {
    const type = msg.type()
    const text = msg.text()
    if (type === 'error') consoleErrors.push(text)
    else if (type === 'warning') consoleWarns.push(text)
    else consoleLogs.push(text)
  })
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message))
  page.on('requestfailed', (req) => consoleErrors.push('REQFAIL: ' + req.url()))

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 3000))

  // 1. 页面基础检查
  const title = await page.title()
  const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 400)
  log('=== 页面标题 ===', title)
  log('=== body 前 400 字 ===\n', bodyText)

  const hasStartBtn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    return btns.map((b) => b.textContent.trim()).filter(Boolean)
  })
  log('=== 按钮 ===', JSON.stringify(hasStartBtn))

  // 2. 检查是否有 data-monitor-list 容器
  const monitorListCount = await page.evaluate(
    () => document.querySelectorAll('[data-monitor-list]').length
  )
  log('=== data-monitor-list 容器数 ===', monitorListCount)

  // 3. 点击开始实验
  log('\n=== 点击「开始实验」 ===')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.includes('开始实验')
    )
    if (btn) btn.click()
    else throw new Error('未找到开始按钮')
  })

  // 4. 观察运行 25 秒
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const progress = await page.evaluate(() => {
      const prog = document.querySelector('.progress-area')
      return prog ? prog.innerText.slice(0, 200) : null
    })
    log(`[${(i + 1) * 5}s] 进度:\n`, progress ? progress : '(无进度区域)')
  }

  log('\n=== 控制台错误 ===', consoleErrors.length)
  consoleErrors.slice(0, 20).forEach((e) => log('  ERR:', e.slice(0, 300)))
  log('=== 控制台警告 ===', consoleWarns.length)
  consoleWarns.slice(0, 10).forEach((e) => log('  WARN:', e.slice(0, 200)))
  log('=== 控制台 log 数 ===', consoleLogs.length)
  consoleLogs.slice(0, 15).forEach((e) => log('  LOG:', e.slice(0, 150)))

  // 5. 抓取已生成的结果表格（若有）
  const resultSummary = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.result-group')]
    return groups.map((g) => {
      const h = g.querySelector('h2')?.textContent
      const rows = [...g.querySelectorAll('tbody tr')].map((tr) => tr.innerText)
      return { h, rows }
    })
  })
  log('\n=== 结果表格 ===')
  resultSummary.forEach((g) => {
    log(' 组:', g.h)
    g.rows.slice(0, 3).forEach((r) => log('   ', r))
  })
} catch (e) {
  log('!!! 测试脚本异常:', e.message)
} finally {
  await browser.close()
}
