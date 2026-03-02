import type { ComponentInternalInstance } from '../component'
import type { DiffStrategy } from './types'

/**
 * 策略池：管理所有可用的 Diff 策略
 */
export class StrategyPool {
  private strategies = new Map<string, DiffStrategy>()

  registerStrategy(name: string, strategy: DiffStrategy): void {
    this.strategies.set(name, strategy)
  }

  getStrategy(name: string): DiffStrategy {
    return this.strategies.get(name) || this.strategies.get('fast')!
  }
}

/**
 * 策略基类（可选），包含通用的标记设置和清理逻辑
 */
abstract class BaseDiffStrategy implements DiffStrategy {
  abstract name: string

  beforeUpdate(instance: ComponentInternalInstance): void {
    // 将策略名称保存到组件实例的自定义属性上，patchChildren 将据此选择算法
    ;(instance as any).__diffStrategy = this.name
  }

  execute(updateFn: Function): void {
    // 触发组件重新渲染（实际更新流程会进入 patchChildren）
    updateFn()
  }

  afterUpdate(instance: ComponentInternalInstance): void {
    // 清理标记
    ;(instance as any).__diffStrategy = null
  }
}

/**
 * 朴素 Diff 策略
 */
export class SimpleDiffStrategy extends BaseDiffStrategy {
  name = 'simple'
}

/**
 * 双端 Diff 策略（Vue 2 风格）
 */
export class DoubleEndDiffStrategy extends BaseDiffStrategy {
  name = 'doubleEnd'
}

/**
 * 快速 Diff 策略（Vue 3 原生）
 */
export class FastDiffStrategy extends BaseDiffStrategy {
  name = 'fast'
}
