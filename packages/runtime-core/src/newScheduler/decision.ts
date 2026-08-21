/* eslint-disable no-console */
import type { FeatureVector } from './types'
interface FeedbackRecord {
  strategy: string
  avgTime: number
  count: number
  lastUpdate: number
}

export class DecisionEngine {
  private ruleEngine: RuleEngine
  private feedbackStore: FeedbackStore
  private thresholds: ThresholdConfig

  constructor() {
    this.ruleEngine = new RuleEngine()
    this.feedbackStore = new FeedbackStore()
    this.thresholds = {
      n1: 50, // 小规模阈值（论文表3-1）
      n2: 500, // 大规模阈值（论文表3-1）
      m_th: 0.3, // 移动比例阈值（论文图3-6）
      c_th: 0.5, // 节点复杂度阈值（论文图3-7）
      k_th: 0.65, // key稳定性阈值（论文图3-8）
    }
  }

  decide(features: FeatureVector): string {
    // 1. 优先查询历史反馈（若存在且置信度足够）
    // const feedbackStrategy = this.feedbackStore.lookup(features)
    // if (feedbackStrategy) {
    //   return feedbackStrategy
    // }

    // 2. 无可靠反馈，使用规则引擎进行启发式决策
    return this.ruleEngine.match(features)
  }

  // 反馈记录：更新历史性能数据
  recordFeedback(
    features: FeatureVector,
    strategy: string,
    updateTime: number,
  ): void {
    this.feedbackStore.update(features, strategy, updateTime)

    // 每隔一定次数重新评估阈值
    if (this.feedbackStore.shouldAdjustThresholds()) {
      this.adjustThresholds()
    }
  }

  // 阈值动态调整算法
  private adjustThresholds() {
    // 基于边界附近的历史记录计算最优阈值
    const boundaryData = this.feedbackStore.getBoundarySamples()
    if (boundaryData.length < 10) return

    // 简化实现：计算移动比例阈值的最优值
    let optimalMth = 0.3
    let minLoss = Infinity

    // 在0.2~0.4范围内搜索
    for (let testMth = 0.2; testMth <= 0.4; testMth += 0.02) {
      const loss = this.calculateLoss(boundaryData, testMth)
      if (loss < minLoss) {
        minLoss = loss
        optimalMth = testMth
      }
    }

    // 平滑更新阈值
    this.thresholds.m_th = 0.9 * this.thresholds.m_th + 0.1 * optimalMth
    console.log(
      `[DecisionEngine] 阈值已更新: m_th=${this.thresholds.m_th.toFixed(3)}`,
    )
  }

  private calculateLoss(samples: any[], testMth: number): number {
    // 计算使用testMth时的理论性能损失
    let totalLoss = 0
    samples.forEach(s => {
      const correctStrategy = s.bestStrategy
      const chosenStrategy = this.simulateDecision(s.features, testMth)
      if (chosenStrategy !== correctStrategy) {
        totalLoss += s.lossFactor
      }
    })
    return totalLoss
  }

  private simulateDecision(features: FeatureVector, testMth: number): string {
    const { n, m_est, k } = features
    if (n < this.thresholds.n1) return 'simple'
    if (n >= this.thresholds.n2) return 'fast'
    if (m_est < testMth) return 'doubleEnd'

    return k < this.thresholds.k_th ? 'doubleEnd' : 'fast'
  }
}

// 反馈存储（简化版）
class FeedbackStore {
  private records: Map<string, FeedbackRecord> = new Map()
  private updateCount = 0

  lookup(features: FeatureVector): string | null {
    const key = this.encodeFeatures(features)
    const record = this.records.get(key)
    if (record && record.count > 5) {
      return record.strategy
    }
    return null
  }

  update(features: FeatureVector, strategy: string, time: number) {
    const key = this.encodeFeatures(features)
    const existing = this.records.get(key)

    if (existing) {
      // 指数加权移动平均
      const alpha = 0.3
      existing.avgTime = alpha * time + (1 - alpha) * existing.avgTime
      existing.count++
      existing.lastUpdate = Date.now()

      // 如果新策略平均耗时显著更低，考虑切换
      const currentBest = this.findBestStrategy(key)
      if (currentBest && currentBest !== strategy) {
        existing.strategy = currentBest
      }
    } else {
      this.records.set(key, {
        strategy,
        avgTime: time,
        count: 1,
        lastUpdate: Date.now(),
      })
    }

    this.updateCount++
  }

  shouldAdjustThresholds(): boolean {
    return this.updateCount % 100 === 0 // 每100次更新调整一次
  }

  getBoundarySamples(): any[] {
    // 返回决策边界附近的样本
    return Array.from(this.records.entries())
      .filter(([_, r]) => r.count > 3)
      .map(([key, r]) => ({
        features: this.decodeFeatures(key),
        bestStrategy: r.strategy,
        lossFactor: 1 / r.count,
      }))
  }

  private findBestStrategy(key: string): string | null {
    // 简化实现
    return null
  }

  private encodeFeatures(f: FeatureVector): string {
    return `${Math.round(f.n)}_${f.m_est.toFixed(2)}_${f.c.toFixed(2)}_${f.k.toFixed(2)}`
  }

  private decodeFeatures(str: string): FeatureVector {
    const parts = str.split('_').map(Number)
    return { n: parts[0], m_est: parts[1], c: parts[2], k: parts[3] }
  }
}

interface ThresholdConfig {
  n1: number
  n2: number
  m_th: number
  k_th: number
  c_th: number
}

export class RuleEngine {
  private thresholds = {
    n1: 50, // 小规模阈值（论文表3-1）
    n2: 500, // 大规模阈值（论文表3-1）
    m_th: 0.3, // 移动比例阈值（论文图3-6）
    k_th: 0.65, // key 稳定性阈值（论文图3-8）
    c_th: 0.5, // 节点复杂度阈值（论文图3-7）
  }

  /**
   * 根据特征向量匹配规则，返回策略名称
   * 对应论文表3-2的决策规则表
   * @param features 特征向量
   * @returns 策略名称：'simple' | 'doubleEnd' | 'fast'
   */
  match(features: FeatureVector): string {
    const { n, m_est, c, k } = features

    // 规则 R1：n < 50，使用朴素 Diff
    if (n < this.thresholds.n1) {
      return 'simple'
    }

    // 规则 R2：n ≥ 500，使用快速 Diff
    if (n >= this.thresholds.n2) {
      return 'fast'
    }

    // 中等规模（50 ≤ n < 500）
    if (m_est < this.thresholds.m_th) {
      // 规则 R3：50≤n<500 且 m<0.3，使用双端 Diff
      return 'doubleEnd'
    } else {
      // 高移动比例（m_est ≥ 0.3）
      if (c > this.thresholds.c_th) {
        // 规则 R4：50≤n<500 且 m≥0.3 且 c>0.5，使用双端 Diff
        return 'doubleEnd'
      } else {
        // 节点复杂度低或中（c ≤ 0.5），依赖 key 稳定性
        if (k >= this.thresholds.k_th) {
          // 规则 R6：50≤n<500 且 m≥0.3 且 c≤0.5 且 k≥0.65，使用快速 Diff
          return 'fast'
        } else {
          // 规则 R5：50≤n<500 且 m≥0.3 且 c≤0.5 且 k<0.65，使用双端 Diff
          return 'doubleEnd'
        }
      }
    }
  }
}
