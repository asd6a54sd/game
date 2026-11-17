/**
 * 烬海纪元 · 生命/魔力水晶永久成长系统
 * ====================
 * 泰拉瑞亚式永久成长：使用生命水晶永久 +20 生命上限，魔力水晶永久 +20 魔力上限
 * 有使用次数上限，防止无限成长
 */

export const LIFE_CRYSTAL_MAX_USES = 15;  // 最多使用 15 次（+300 HP）
export const MANA_CRYSTAL_MAX_USES = 10;  // 最多使用 10 次（+200 MP）
export const LIFE_CRYSTAL_GAIN = 20;      // 每次 +20 生命上限
export const MANA_CRYSTAL_GAIN = 20;      // 每次 +20 魔力上限

export interface GrowthSave {
  hpUses: number;
  mpUses: number;
}

export class GrowthManager {
  hpUses = 0;   // 已使用生命水晶次数
  mpUses = 0;   // 已使用魔力水晶次数

  /** 永久生命上限加成 */
  get hpBonus(): number {
    return this.hpUses * LIFE_CRYSTAL_GAIN;
  }

  /** 永久魔力上限加成 */
  get mpBonus(): number {
    return this.mpUses * MANA_CRYSTAL_GAIN;
  }

  get hpUsesLeft(): number {
    return Math.max(0, LIFE_CRYSTAL_MAX_USES - this.hpUses);
  }

  get mpUsesLeft(): number {
    return Math.max(0, MANA_CRYSTAL_MAX_USES - this.mpUses);
  }

  /** 使用生命水晶：返回是否成功 */
  useLifeCrystal(): boolean {
    if (this.hpUses >= LIFE_CRYSTAL_MAX_USES) return false;
    this.hpUses++;
    return true;
  }

  /** 使用魔力水晶：返回是否成功 */
  useManaCrystal(): boolean {
    if (this.mpUses >= MANA_CRYSTAL_MAX_USES) return false;
    this.mpUses++;
    return true;
  }

  serialize(): GrowthSave {
    return { hpUses: this.hpUses, mpUses: this.mpUses };
  }

  restore(save: GrowthSave | undefined) {
    if (!save) return;
    this.hpUses = Math.max(0, Math.min(LIFE_CRYSTAL_MAX_USES, save.hpUses | 0));
    this.mpUses = Math.max(0, Math.min(MANA_CRYSTAL_MAX_USES, save.mpUses | 0));
  }
}
