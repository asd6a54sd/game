/**
 * 烬海纪元 · 物品 & 背包系统
 * 对齐泰拉瑞亚：50 格主背包 + 9 格快捷栏
 */

export interface ItemStack {
  blockId: string;       // 方块 id（对应 blocks.ts）
  count: number;
}

export const EMPTY_SLOT: ItemStack = { blockId: '', count: 0 };

export class Inventory {
  // 主背包 (4×13 = 52 格，留2格给快捷栏来源)
  slots: ItemStack[];
  // 快捷栏 (9 格，与泰拉瑞亚一致)
  hotbar: ItemStack[];
  selectedHotbar: number = 0;

  constructor() {
    this.slots = Array.from({ length: 4 * 13 }, () => ({ ...EMPTY_SLOT }));
    this.hotbar = Array.from({ length: 9 }, () => ({ ...EMPTY_SLOT }));
  }

  /** 添加物品到背包（优先合并已有堆） */
  add(blockId: string, count = 1): number {
    if (!blockId) return 0;
    let remaining = count;

    // 先合并已有堆
    for (const slot of [...this.hotbar, ...this.slots]) {
      if (remaining <= 0) break;
      if (slot.blockId === blockId && slot.count > 0 && slot.count < 99) {
        const add = Math.min(99 - slot.count, remaining);
        slot.count += add;
        remaining -= add;
      }
    }

    // 再找空格
    if (remaining > 0) {
      for (const slot of [...this.hotbar, ...this.slots]) {
        if (remaining <= 0) break;
        if (slot.count === 0) {
          const add = Math.min(99, remaining);
          slot.blockId = blockId;
          slot.count = add;
          remaining -= add;
        }
      }
    }

    return count - remaining;
  }

  /** 从选中的快捷栏消耗物品 */
  consumeSelected(count = 1): boolean {
    const slot = this.hotbar[this.selectedHotbar];
    if (slot.count < count) return false;
    slot.count -= count;
    if (slot.count === 0) slot.blockId = '';
    return true;
  }

  /** 选中快捷栏格子（0-8） */
  selectHotbar(idx: number) {
    this.selectedHotbar = Math.max(0, Math.min(8, idx));
  }

  /** 快捷栏滚轮切换 */
  scrollHotbar(delta: number) {
    this.selectedHotbar = (this.selectedHotbar + delta + 9) % 9;
  }

  /** 当前选中的物品 */
  getSelected(): ItemStack {
    return this.hotbar[this.selectedHotbar];
  }

  /** 是否持有某物品 */
  has(blockId: string): boolean {
    for (const s of [...this.hotbar, ...this.slots]) {
      if (s.blockId === blockId && s.count > 0) return true;
    }
    return false;
  }

  /** 数量查询 */
  count(blockId: string): number {
    let c = 0;
    for (const s of [...this.hotbar, ...this.slots]) {
      if (s.blockId === blockId) c += s.count;
    }
    return c;
  }
}
