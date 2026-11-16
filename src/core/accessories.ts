/**
 * 烬海纪元 · 饰品系统
 * ==================
 * 泰拉瑞亚深度来源之一 —— 饰品是独立于躯壳的叠加 Buff 层
 * 区别：最多 3 槽，按 Q 切换第 1 槽（简化操作）
 * Buff 类型：冲刺、再生、减伤、磁力、速度、滑翔
 */

export interface AccessoryDef {
  id: string;
  name: string;
  paletteId: string;   // 调色板色
  iconChar: string;    // HUD 图标
  desc: string;
  buff: AccessoryBuff;
}

export interface AccessoryBuff {
  dashSpeed?: number;       // 冲刺速度 (px/s)
  dashDuration?: number;    // 冲刺持续 (秒)
  dashCooldown?: number;    // 冲刺冷却 (秒)
  regenAmount?: number;     // 每次回血量
  regenInterval?: number;   // 回血间隔 (秒)
  damageReduction?: number; // 减伤比例 (0-1)
  magnetBonus?: number;     // 拾取范围倍率加成
  moveSpeedBonus?: number;  // 移速倍率加成
  glideFallSpeed?: number;  // 滑翔下落速度上限 (px/s)
}

export const ACCESSORY_DEFS: Record<string, AccessoryDef> = {
  dash_boots: {
    id: 'dash_boots',
    name: '疾行靴',
    paletteId: 'ember03',
    iconChar: '»',
    desc: '按住 Ctrl 可短暂冲刺一段距离',
    buff: { dashSpeed: 520, dashDuration: 0.25, dashCooldown: 1.2 },
  },
  regen_ring: {
    id: 'regen_ring',
    name: '再生之戒',
    paletteId: 'cold02',
    iconChar: '♥',
    desc: '每 2 秒自动恢复 1 点生命',
    buff: { regenAmount: 1, regenInterval: 2 },
  },
  defense_charm: {
    id: 'defense_charm',
    name: '守护护符',
    paletteId: 'iron03',
    iconChar: '◆',
    desc: '受到伤害降低 25%',
    buff: { damageReduction: 0.25 },
  },
  magnet_crystal: {
    id: 'magnet_crystal',
    name: '拾荒水晶',
    paletteId: 'void01',
    iconChar: '✦',
    desc: '掉落物拾取范围与磁力范围大幅提升',
    buff: { magnetBonus: 2.0 },
  },
  speed_glove: {
    id: 'speed_glove',
    name: '疾风手套',
    paletteId: 'rust02',
    iconChar: '»',
    desc: '移动速度提升 20%',
    buff: { moveSpeedBonus: 1.2 },
  },
  wing_charm: {
    id: 'wing_charm',
    name: '幽光翅符',
    paletteId: 'cold01',
    iconChar: '^',
    desc: '在空中按住跳跃键可缓慢滑翔',
    buff: { glideFallSpeed: 90 },
  },
};

export const ACCESSORY_IDS = Object.keys(ACCESSORY_DEFS);
export const MAX_ACCESSORY_SLOTS = 3;

export interface AccessorySlot {
  accessoryId: string;
}

/** 玩家饰品管理器 */
export class AccessoryManager {
  slots: AccessorySlot[] = []; // 最多 3 槽
  slotIndex = 0;               // 当前激活槽（按 Q 切换）

  // 冲刺状态
  dashTimer = 0;       // 当前冲刺剩余时间
  dashCooldownTimer = 0; // 冲刺冷却
  isDashing = false;
  dashDir: 1 | -1 = 1;

  // 再生计时
  regenTimer = 0;

  /** 从背包物品直接装备（按 accessoryId） */
  equip(accessoryId: string): boolean {
    if (!ACCESSORY_DEFS[accessoryId]) return false;
    // 不允许重复装备同类
    if (this.slots.some(s => s.accessoryId === accessoryId)) return false;
    if (this.slots.length >= MAX_ACCESSORY_SLOTS) {
      // 槽满：替换当前激活槽
      this.slots[this.slotIndex] = { accessoryId };
    } else {
      this.slots.push({ accessoryId });
    }
    return true;
  }

  /** 卸下当前槽饰品 */
  unequip(): string | null {
    if (this.slots.length === 0) return null;
    const removed = this.slots[this.slotIndex];
    this.slots.splice(this.slotIndex, 1);
    if (this.slotIndex >= this.slots.length) this.slotIndex = Math.max(0, this.slots.length - 1);
    return removed.accessoryId;
  }

  /** 按 Q 切换激活槽 */
  nextSlot() {
    if (this.slots.length <= 1) return;
    this.slotIndex = (this.slotIndex + 1) % this.slots.length;
  }

  /** 当前激活槽饰品 ID（可空） */
  get currentId(): string | null {
    return this.slots.length > 0 ? this.slots[this.slotIndex].accessoryId : null;
  }

  /** 聚合所有装备饰品的 Buff */
  getAggregatedBuff(): AccessoryBuff {
    const result: AccessoryBuff = {};
    for (const s of this.slots) {
      const b = ACCESSORY_DEFS[s.accessoryId].buff;
      if (b.dashSpeed) result.dashSpeed = b.dashSpeed;
      if (b.dashDuration) result.dashDuration = b.dashDuration;
      if (b.dashCooldown) result.dashCooldown = b.dashCooldown;
      if (b.regenAmount) result.regenAmount = b.regenAmount;
      if (b.regenInterval) result.regenInterval = b.regenInterval;
      if (b.damageReduction) {
        result.damageReduction = Math.max(result.damageReduction ?? 0, b.damageReduction);
      }
      if (b.magnetBonus) {
        result.magnetBonus = Math.max(result.magnetBonus ?? 1, b.magnetBonus);
      }
      if (b.moveSpeedBonus) {
        result.moveSpeedBonus = Math.max(result.moveSpeedBonus ?? 1, b.moveSpeedBonus);
      }
      if (b.glideFallSpeed) {
        result.glideFallSpeed = Math.min(result.glideFallSpeed ?? Infinity, b.glideFallSpeed);
      }
    }
    return result;
  }

  /** 冲刺激活（返回实际冲刺速度，0 表示不能冲刺） */
  tryDash(facing: 1 | -1): number {
    const buff = this.getAggregatedBuff();
    if (this.dashCooldownTimer > 0 || this.isDashing) return 0;
    if (!buff.dashSpeed) return 0;
    this.isDashing = true;
    this.dashTimer = buff.dashDuration ?? 0.25;
    this.dashCooldownTimer = buff.dashCooldown ?? 1.2;
    this.dashDir = facing;
    return buff.dashSpeed;
  }

  update(dt: number) {
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) { this.isDashing = false; this.dashTimer = 0; }
    }
  }

  /** 再生：返回本帧应恢复的血量（每 N 秒 +1） */
  updateRegen(dt: number): number {
    const buff = this.getAggregatedBuff();
    if (!buff.regenAmount || !buff.regenInterval) return 0;
    this.regenTimer += dt;
    if (this.regenTimer >= buff.regenInterval) {
      this.regenTimer = 0;
      return buff.regenAmount;
    }
    return 0;
  }
}
