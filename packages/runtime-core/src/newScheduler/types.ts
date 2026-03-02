/**
 * 场景特征向量
 * 由监控层采集，作为决策层的输入
 */
export interface FeatureVector {
  n: number // 列表长度（新子节点数量）
  m_est: number // 移动比例估算值 (0~1)
  c: number // 节点复杂度（重型节点比例，0~1）
  k: number // key稳定性系数 (0~1)
}

/**
 * Diff策略统一接口
 * 所有具体策略（朴素、双端、快速）必须实现此接口
 */
export interface DiffStrategy {
  /** 策略名称 */
  name: string

  /**
   * 策略执行前的钩子
   * 可用于设置标记、准备环境等
   * @param instance 当前组件实例（用于传递标记）
   */
  beforeUpdate?: (instance: any) => void

  /**
   * 执行策略的核心方法
   * @param updateFn Vue原生的组件更新函数
   */
  execute: (updateFn: Function) => void

  /**
   * 策略执行后的钩子
   * 可用于清理标记、记录统计等
   * @param instance 当前组件实例
   */
  afterUpdate?: (instance: any) => void
}

/**
 * 历史反馈记录项
 * 用于决策层的反馈学习
 */
export interface FeedbackRecord {
  strategy: string // 当前最优策略名称
  avgTime: number // 指数加权移动平均耗时 (ms)
  count: number // 累计执行次数
  lastUpdate: number // 最后更新时间戳
}

/**
 * 阈值配置
 * 用于启发式调度和动态调整
 */
export interface ThresholdConfig {
  n1: number // 小规模阈值 (默认50)
  n2: number // 大规模阈值 (默认500)
  m_th: number // 移动比例阈值 (默认0.3)
  k_th: number // key稳定性阈值 (默认0.6)
  c_th: number // 节点复杂度阈值 (默认0.5)
}

/**
 * 边界样本数据
 * 用于阈值动态调整的决策边界附近样本
 */
export interface BoundarySample {
  features: FeatureVector // 特征向量
  bestStrategy: string // 理论最优策略
  lossFactor: number // 损失因子
}
