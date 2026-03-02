/* eslint-disable no-console */
import { queueJob } from '../scheduler' // 引入 Vue 原生调度器
import { FeatureMonitor } from './monitor'
import { DecisionEngine } from './decision'
import {
  DoubleEndDiffStrategy as ImportedDoubleEndDiffStrategy, // 重命名导入
  FastDiffStrategy as ImportedFastDiffStrategy, // 重命名导入
  SimpleDiffStrategy as ImportedSimpleDiffStrategy, // 重命名导入
  StrategyPool,
} from './strategies'

// 为了简化，我们假设这些模块已经实现（可按论文代码实现）
let monitor: FeatureMonitor
let decisionEngine: DecisionEngine
let strategyPool: StrategyPool

export function initAdaptiveScheduler(): void {
  monitor = new FeatureMonitor()
  decisionEngine = new DecisionEngine()
  strategyPool = new StrategyPool()
  // 注册默认策略
  strategyPool.registerStrategy('simple', new ImportedSimpleDiffStrategy()) // 使用重命名后的类
  strategyPool.registerStrategy(
    'doubleEnd',
    new ImportedDoubleEndDiffStrategy(),
  ) // 使用重命名后的类
  strategyPool.registerStrategy('fast', new ImportedFastDiffStrategy()) // 使用重命名后的类
}

export function createAdaptiveScheduler(instance: any): any {
  return () => {
    console.log('createAdaptiveScheduler')
    const startTime = performance.now()
    // 1. 采集特征
    const features = monitor.collect(instance)
    console.log('features', features)

    // 2. 决策策略
    const strategyName = decisionEngine.decide(features)
    console.log('strategyName', strategyName)

    // 3. 执行策略前置钩子
    const strategy = strategyPool.getStrategy(strategyName)
    console.log('strategy', strategy)
    console.log('调度开销', performance.now() - startTime)
    // eslint-disable-next-line no-restricted-syntax
    strategy.beforeUpdate?.(instance)

    // 4. 记录开始时间（用于反馈）
    const start = performance.now()

    // 5. 调用原生调度器执行更新
    queueJob(() => {
      const componentUpdateFn = instance.update() // 执行实际的组件更新
      strategy.execute(componentUpdateFn)
      const duration = performance.now() - start
      console.log('响应时间', duration)

      // 反馈耗时
      decisionEngine.recordFeedback(features, strategyName, duration)
      // eslint-disable-next-line no-restricted-syntax
      strategy.afterUpdate?.(instance)
    })
  }
}
