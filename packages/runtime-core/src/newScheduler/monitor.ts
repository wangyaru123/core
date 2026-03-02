/* eslint-disable no-console */
import type { VNode } from 'vue'
import type { FeatureVector } from './types'
import type { ComponentInternalInstance } from '../component'
export class FeatureMonitor {
  private lastKeyMap: Map<string, string> = new Map() // 用于key稳定性历史记录
  private readonly SAMPLE_SIZE = 20 // 节点复杂度采样数

  collect(instance: any): FeatureVector {
    // 获取当前正在更新的组件及其子节点
    const currentChildren = this.getCurrentChildren(instance)

    // 1. 列表长度特征 - 直接读取 O(1)
    const n = currentChildren.length

    // 2. 移动比例估算 - 基于三节点采样 O(1)
    const m_est = this.estimateMoveRatio(currentChildren)

    // 3. 节点复杂度 - 固定采样检测 O(20)
    const c = this.detectNodeComplexity(currentChildren)

    // 4. key稳定性 - 综合系数计算
    const k = this.computeKeyStability(currentChildren)

    return { n, m_est, c, k }
  }

  private estimateMoveRatio(newChildren: VNode[]): number {
    // 获取旧节点列表（从Vue内部获取，此处简化）
    const oldChildren = this.getOldChildren()
    if (oldChildren.length < 3) return 0.0

    // 选取头、中、尾三个锚点
    const headIdx = 0
    const midIdx = Math.floor((oldChildren.length - 1) / 2)
    const tailIdx = oldChildren.length - 1

    const anchors = [
      { node: oldChildren[headIdx], oldIdx: headIdx },
      { node: oldChildren[midIdx], oldIdx: midIdx },
      { node: oldChildren[tailIdx], oldIdx: tailIdx },
    ]

    let movedCount = 0
    anchors.forEach(({ node, oldIdx }) => {
      if (!node.key) {
        movedCount++ // 无key节点视为需要移动
        return
      }

      // 在新列表中查找该节点（通过key映射）
      const newIdx = this.findIndexByKey(newChildren, node.key)
      if (newIdx === -1) {
        movedCount++ // 节点不存在，视为移动（删除）
      } else if (newIdx !== oldIdx) {
        movedCount++ // 位置变化
      }
      // 位置相同则不计入移动
    })

    return movedCount / 3
  }

  private detectNodeComplexity(children: VNode[]): number {
    const total = Math.min(children.length, this.SAMPLE_SIZE)
    if (total === 0) return 0

    let heavyCount = 0
    for (let i = 0; i < total; i++) {
      if (this.isHeavyNode(children[i])) {
        heavyCount++
      }
    }
    return heavyCount / total
  }

  private isHeavyNode(vnode: VNode): boolean {
    // 明确指定 children 为数组类型
    const children = vnode.children as Array<any> | undefined
    // eslint-disable-next-line no-restricted-syntax
    const childCount = children?.length ?? 0

    if (childCount > 10) return true

    const type = vnode.type as any
    // eslint-disable-next-line no-restricted-syntax
    if (type?.__isClassComponent) return true

    // 检测嵌套深度（简化实现）
    if (childCount > 3 && this.hasNestedComponents(vnode)) return true

    return false
  }

  private computeKeyStability(children: VNode[]): number {
    console.log('computeKeyStability--start')
    console.log('传参--children', children)
    // 来源权重 (25%)
    let srcWeight = 0
    // 从0开始，递增+1数组
    const arr = Array.from({ length: children.length }, (_, i) => i)
    console.log('arr', arr)

    children.forEach((vnode, index) => {
      console.log('vnode', vnode)
      console.log('typeof vnode.key', typeof vnode.key)
      console.log('index === arr[index]', index === arr[index])

      if (!vnode.key) {
        srcWeight += 0
      } else if (typeof vnode.key === 'number' && index === arr[index]) {
        srcWeight += 0.3 // 数组索引
      } else {
        srcWeight += 1.0 // 其他-业务数据
      }
    })
    srcWeight = srcWeight / children.length
    console.log('srcWeight', srcWeight)

    // 唯一性因子 (50%)
    const keySet = new Set()
    let duplicateCount = 0
    children.forEach(vnode => {
      if (vnode.key) {
        if (keySet.has(vnode.key)) duplicateCount++
        else keySet.add(vnode.key)
      }
    })
    const uniqFactor = 1 - duplicateCount / children.length

    // 历史稳定性 (25%) - 基于滑动窗口
    let historyStability = 0
    children.forEach(vnode => {
      if (!vnode.key) return
      const lastKey = this.lastKeyMap.get(this.getNodeId(vnode))
      if (lastKey === vnode.key) historyStability++
      this.lastKeyMap.set(this.getNodeId(vnode), vnode.key as string)
    })
    console.log('historyStability', historyStability)
    historyStability = historyStability / children.length

    // 加权合成
    return 0.25 * srcWeight + 0.5 * uniqFactor + 0.25 * historyStability
  }

  private findListContainer(vnode: VNode): VNode | null {
    // 检查当前节点是否有标记属性
    if (vnode.props && vnode.props['data-monitor-list'] !== undefined) {
      return vnode
    }
    // 递归遍历子节点
    if (vnode.children && Array.isArray(vnode.children)) {
      for (const child of vnode.children) {
        const found = this.findListContainer(child as VNode)
        if (found) return (found.children as VNode[])[0]
      }
    }
    return null
  }

  private getCurrentChildren(instance: ComponentInternalInstance): VNode[] {
    const subTree = instance.subTree
    const container = this.findListContainer(subTree)
    console.log('container', container)
    console.log(
      'container && container.children && Array.isArray(container.children)',
      container && container.children && Array.isArray(container.children),
    )
    if (container && container.children && Array.isArray(container.children)) {
      return container.children as VNode[]
    }
    // 降级：如果没有找到标记，返回空数组
    return []
  }
  private getOldChildren(): VNode[] {
    /* 从Vue内部获取 */ return []
  }
  private findIndexByKey(children: VNode[], key: any): number {
    return children.findIndex(v => v.key === key)
  }
  private getNodeId(vnode: VNode): string {
    return vnode.key ? String(vnode.key) : `node_${Math.random()}`
  }
  private hasNestedComponents(vnode: VNode): boolean {
    // eslint-disable-next-line no-restricted-syntax
    return !!vnode.component?.subTree?.children?.length
  }
}
