export interface DiffStrategy {
  name: string
  beforeUpdate?: () => void
  execute: (updateFn: Function) => void
  afterUpdate?: () => void
}

export class StrategyPool {
  private strategies: Map<string, DiffStrategy> = new Map()

  registerStrategy(name: string, strategy: DiffStrategy): void {
    this.strategies.set(name, strategy)
  }

  getStrategy(name: string): DiffStrategy {
    return this.strategies.get(name) || this.strategies.get('fast')!
  }
}

// 朴素Diff策略
export class SimpleDiffStrategy implements DiffStrategy {
  name = 'simple'

  beforeUpdate(): void {
    // 可选：记录开始时间
  }

  execute(updateFn: Function): void {
    // 调用Vue的朴素Diff实现
    updateFn()
  }

  afterUpdate(): void {
    // 可选：清理工作
  }
}

// 双端Diff策略
export class DoubleEndDiffStrategy implements DiffStrategy {
  name = 'doubleEnd'

  beforeUpdate(): void {
    // 可能切换到双端模式
  }

  execute(updateFn: Function): void {
    updateFn()
  }

  afterUpdate(): void {}
}

// 快速Diff+LIS策略
export class FastDiffStrategy implements DiffStrategy {
  name = 'fast'

  beforeUpdate(): void {
    // 可能启用LIS优化
  }

  execute(updateFn: Function): void {
    updateFn()
  }

  afterUpdate(): void {}
}
