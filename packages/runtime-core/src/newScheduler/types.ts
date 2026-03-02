// scheduler/types.ts
/**
 * 自适应调度器类型定义文件
 */

/**
 * 场景特征向量
 * 由监控层采集，作为决策层的输入
 */
export interface FeatureVector {
  /** 列表长度（新子节点数量） */
  n: number
  /** 移动比例估算值 (0~1) */
  m_est: number
  /** 节点复杂度 (重型节点比例, 0~1) */
  c: number
  /** key稳定性系数 (0~1) */
  k: number
}

/**
 * Diff策略统一接口
 * 所有具体策略必须实现此接口
 */
export interface DiffStrategy {
  /** 策略名称 */
  name: string
  /** 策略执行前的钩子（可选） */
  beforeUpdate?: () => void
  /**
   * 执行策略
   * @param updateFn Vue原生的组件更新函数
   */
  execute: (updateFn: Function) => void
  /** 策略执行后的钩子（可选） */
  afterUpdate?: () => void
}

/**
 * 历史反馈记录项
 * 用于决策层的反馈学习
 */
export interface FeedbackRecord {
  /** 当前最优策略名称 */
  strategy: string
  /** 指数加权移动平均耗时 (ms) */
  avgTime: number
  /** 累计执行次数 */
  count: number
  /** 最后更新时间戳 */
  lastUpdate: number
}

/**
 * 阈值配置
 * 用于启发式调度和动态调整
 */
export interface ThresholdConfig {
  /** 小规模阈值 (默认50) */
  n1: number
  /** 大规模阈值 (默认500) */
  n2: number
  /** 移动比例阈值 (默认0.3) */
  m_th: number
  /** key稳定性阈值 (默认0.6) */
  k_th: number
}

/**
 * 策略池映射表
 * 键为策略名称，值为策略实例
 */
export type StrategyMap = Map<string, DiffStrategy>

/**
 * 特征编码类型
 * 用于反馈存储的键
 */
export type FeatureKey = string

/**
 * 边界样本数据
 * 用于阈值动态调整的决策边界附近样本
 */
export interface BoundarySample {
  /** 特征向量 */
  features: FeatureVector
  /** 理论最优策略 */
  bestStrategy: string
  /** 损失因子 */
  lossFactor: number
}
