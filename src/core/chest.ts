/**
 * 烬海纪元 · 宝箱储物系统
 * ====================
 * 泰拉瑞亚式储物箱 — 放置后可存入物品，挖掉时内容物掉落回地面
 * 每个宝箱 20 格，按 K 键打开附近宝箱
 */
import { ItemStack, EMPTY_SLOT } from './inventory.js';
import { TILE_SIZE } from './terrain.js';

export const CHEST_SIZE = 20;
export const STACK_MAX = 99;

export interface ChestData {
  tx: number;
  ty: number;
  slots: ItemStack[];
}

/**
 * 向一组格子中存入物品（先合并堆叠，再找空格）
 * @returns 未存入的剩余数量
 */
export function addToSlots(slots: ItemStack[], blockId: string, count: number): number {
  if (!blockId || count <= 0) return count;
  let remaining = count;
  // 合并已有堆
  for (const s of slots) {
    if (remaining <= 0) break;
    if (s.blockId === blockId && s.count > 0 && s.count < STACK_MAX) {
      const add = Math.min(STACK_MAX - s.count, remaining);
      s.count += add;
      remaining -= add;
    }
  }
  // 找空格
  for (const s of slots) {
    if (remaining <= 0) break;
    if (s.count === 0) {
      s.blockId = blockId;
      s.count = Math.min(STACK_MAX, remaining);
      remaining -= s.count;
    }
  }
  return remaining;
}

export class ChestManager {
  private chests = new Map<string, ChestData>();

  private key(tx: number, ty: number): string {
    return `${tx},${ty}`;
  }

  /** 在指定 tile 创建宝箱（已存在则直接返回） */
  create(tx: number, ty: number): ChestData {
    const k = this.key(tx, ty);
    const existing = this.chests.get(k);
    if (existing) return existing;
    const chest: ChestData = {
      tx, ty,
      slots: Array.from({ length: CHEST_SIZE }, () => ({ ...EMPTY_SLOT })),
    };
    this.chests.set(k, chest);
    return chest;
  }

  get(tx: number, ty: number): ChestData | null {
    return this.chests.get(this.key(tx, ty)) ?? null;
  }

  /** 移除宝箱记录（挖掉时调用），返回原数据 */
  remove(tx: number, ty: number): ChestData | null {
    const k = this.key(tx, ty);
    const c = this.chests.get(k);
    if (c) this.chests.delete(k);
    return c ?? null;
  }

  get count(): number {
    return this.chests.size;
  }

  /** 查找玩家附近最近的宝箱（世界坐标） */
  findNear(worldX: number, worldY: number, rangeTiles = 3): ChestData | null {
    const ptx = Math.floor(worldX / TILE_SIZE);
    const pty = Math.floor(worldY / TILE_SIZE);
    let best: ChestData | null = null;
    let bestD = rangeTiles * rangeTiles;
    for (const c of this.chests.values()) {
      const d = (c.tx - ptx) ** 2 + (c.ty - pty) ** 2;
      if (d <= bestD) { bestD = d; best = c; }
    }
    return best;
  }
}
