import { type SchedulerJob, queueJob, queuePostFlushCb } from '../scheduler' // 引入 Vue 原生调度器
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

export function createAdaptiveScheduler(instance: any, job: SchedulerJob): any {
  return () => {
    // 如果实验代码已手动设置 __diffStrategy，则跳过自适应决策，直接入队更新
    // 这确保实验中 setStrategy() 设置的策略不会被覆盖
    // eslint-disable-next-line no-restricted-syntax
    if (instance?.proxy?.__diffStrategy) {
      queueJob(job)
      return
    }

    // 1. 采集特征
    const features = monitor.collect(instance)

    // 2. 决策策略
    const strategyName = decisionEngine.decide(features)

    // 3. 执行策略前置钩子：设置 __diffStrategy 标记
    const strategy = strategyPool.getStrategy(strategyName)
    // eslint-disable-next-line no-restricted-syntax
    strategy.beforeUpdate?.(instance)

    // 4. 入队更新（与 Vue 原生调度器一致，只入队一次）
    // 使用 job 而非 instance.update，因为 job 具有 flags/id/i 等 SchedulerJob 属性
    queueJob(job)

    // 5. 更新完成后清理策略标记
    queuePostFlushCb(() => {
      // eslint-disable-next-line no-restricted-syntax
      strategy.afterUpdate?.(instance)
    })
  }
}
