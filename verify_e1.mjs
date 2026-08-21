import puppeteer from 'puppeteer'

// 完整运行 E1 决策阈值实验（4 组），等待全部完成后对比论文表 3-1 / 阈值
const URL = 'http://localhost:5173/'
const log = (...a) => console.log(...a)

const PAPER_T31 = {
  10: [0.16, 0.21, 0.23], 50: [0.32, 0.26, 0.27], 100: [0.55, 0.36, 0.38],
  200: [1.21, 0.60, 0.70], 500: [1.68, 1.23, 1.18], 1000: [4.08, 2.54, 2.45],
  5000: [45.72, 18.21, 16.25],
}

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
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始实验'))
    btn.click()
  })

  // 等待全部 4 组完成（上限 15 分钟）
  const deadline = Date.now() + 15 * 60000
  let done = false
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10000))
    const state = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('.result-group')].length
      const total = document.querySelector('.total-time')
      return { groups, total: total ? total.textContent : null }
    })
    log(`... 已渲染结果组 ${state.groups}/4${state.total ? ' | ' + state.total : ''}`)
    if (state.groups >= 4) { done = true; break }
  }

  if (!done) {
    log('!!! 15 分钟内未完成全部 4 组实验')
  }

  // 提取所有结果表
  const groups = await page.evaluate(() => {
    return [...document.querySelectorAll('.result-group')].map((g) => {
      const h = g.querySelector('h2')?.textContent || ''
      const rows = [...g.querySelectorAll('tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())
      )
      return { h, rows }
    })
  })

  log('\n===== E1 全部结果 =====')
  for (const g of groups) {
    log('\n【' + g.h + '】')
    for (const row of g.rows) log('  ' + row.join(' | '))
  }

  // 对比实验一（列表规模）
  const scaleGroup = groups.find((g) => g.h.includes('列表规模'))
  if (scaleGroup) {
    log('\n===== 实验一 实测 vs 论文表3-1（朴素/双端/快速） =====')
    for (const row of scaleGroup.rows) {
      const n = parseInt(row[0])
      const meas = row.slice(1).map(parseFloat)
      const p = PAPER_T31[n]
      if (!p) continue
      const cmp = meas.map((v, i) => {
        const r = v / p[i]
        return r >= 0.4 && r <= 2.5 ? '同量级' : `${r.toFixed(1)}x`
      })
      log(`${n}: 实测[${meas.join(', ')}] 论文[${p.join(', ')}] → ${cmp.join('/')}`)
    }
  }

  log('\n控制台错误数:', errors.length)
  errors.slice(0, 10).forEach((e) => log('  ERR:', e.slice(0, 200)))
} catch (e) {
  log('!!! 异常:', e.message)
} finally {
  await browser.close()
}
