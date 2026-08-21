/**
 * probe_timer.mjs — 探测 performance.now() 在当前实验环境下的实际分辨率
 *
 * 背景：Chrome 对非跨源隔离（crossOriginIsolated === false）的页面，
 * 将 performance.now() 钳制到 100µs（0.1ms）粒度。E1 在 n=10 时测得的
 * 0.09~0.2ms 处于该量级，需确认这些数字是真实测量还是量化噪声。
 */
import puppeteer from 'puppeteer'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const probe = () => {
  // 1. 跨源隔离状态（决定钳制粒度：隔离 5µs / 未隔离 100µs）
  const isolated = globalThis.crossOriginIsolated

  // 2. 经验分辨率：紧循环采样，统计相邻不同值之间的最小步长
  const samples = []
  for (let i = 0; i < 200000; i++) samples.push(performance.now())
  const steps = new Set()
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i] - samples[i - 1]
    if (d > 0) steps.add(Number(d.toFixed(6)))
  }
  const sortedSteps = [...steps].sort((a, b) => a - b)

  // 3. 模拟 renderer.ts 的计时口径：对一段已知极短的工作逐次计时并累加
  //    对照组：把同样的工作放进单个计时窗口整体计时
  const work = () => {
    let s = 0
    for (let i = 0; i < 300; i++) s += i * i
    return s
  }
  const BATCH = 20
  let perCallSum = 0
  for (let r = 0; r < BATCH; r++) {
    const t0 = performance.now()
    work()
    perCallSum += performance.now() - t0 // ← renderer.ts 当前的口径
  }
  const tOuter0 = performance.now()
  for (let r = 0; r < BATCH; r++) work()
  const outerTotal = performance.now() - tOuter0 // ← 单窗口口径

  return {
    isolated,
    distinctStepCount: sortedSteps.length,
    minStep: sortedSteps[0],
    firstSteps: sortedSteps.slice(0, 5),
    perCallAvg: perCallSum / BATCH,
    outerAvg: outerTotal / BATCH,
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
  ],
})

for (const url of ['about:blank', 'http://localhost:5173/']) {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const r = await page.evaluate(probe)
    console.log(`\n=== ${url} ===`)
    console.log(`crossOriginIsolated : ${r.isolated}`)
    console.log(`最小非零步长        : ${r.minStep} ms`)
    console.log(`最小的几个步长      : ${r.firstSteps.join(', ')}`)
    console.log(`不同步长取值个数    : ${r.distinctStepCount}`)
    console.log(`逐次计时累加/次     : ${r.perCallAvg.toFixed(6)} ms  ← renderer.ts 口径`)
    console.log(`单窗口整体计时/次   : ${r.outerAvg.toFixed(6)} ms  ← 对照`)
  } catch (e) {
    console.log(`\n=== ${url} ===\n跳过：${e.message.split('\n')[0]}`)
  } finally {
    await page.close()
  }
}

await browser.close()
