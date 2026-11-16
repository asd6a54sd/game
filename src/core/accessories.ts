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
  // Boss 专属 Buff
  jumpBonus?: number;       // 跳跃倍率加成
  gravityReduction?: number; // 重力减轻比例 (0-1)
  critBonus?: number;       // 额外暴击率 (0-1)
  critDamageMult?: number;  // 暴击伤害倍率
  voidResistance?: number;  // 黑雾同化抗性 (0-1)
  nightVisionBonus?: number; // 夜间视野加成 (0-1)
  // M15: 实装的夜间 Boss Buff
  attackSpeedBonus?: number; // 攻击速度倍率（伤害/秒）
  dashCooldownMult?: number; // 冲刺冷却倍率（0.6 = -40%）
  dashSpeedMult?: number;    // 冲刺速度倍率（1.25 = +25% 距离）
  poisonDps?: number;        // 持续伤害 dps
  poisonDuration?: number;   // 持续伤害时长（秒）
  jumpSplashDamage?: number; // 落地震伤半径
  jumpSplashRadius?: number; // 落地震伤半径
  dodgeChance?: number;      // 受击几率豁免（0.25 = 25% 几率无伤害）
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

  // === M13: Boss 专属饰品（100% 掉落）===
  rock_titan_crown: {
    id: 'rock_titan_crown',
    name: '岩石泰坦王冠',
    paletteId: 'iron04',
    iconChar: '♔',
    desc: '重力减轻 40% · 跳跃力 +25%',
    buff: { jumpBonus: 1.25, gravityReduction: 0.4 },
  },
  crystal_warden_core: {
    id: 'crystal_warden_core',
    name: '晶守核心',
    paletteId: 'void01',
    iconChar: '✧',
    desc: '额外 15% 暴击率 · 暴击伤害 × 1.5',
    buff: { critBonus: 0.15, critDamageMult: 1.5 },
  },
  void_assimilator_heart: {
    id: 'void_assimilator_heart',
    name: '同化之心',
    paletteId: 'void03',
    iconChar: '☠',
    desc: '黑雾同化抗性 30% · 夜间视野 +30%',
    buff: { voidResistance: 0.3, nightVisionBonus: 0.3 },
  },

  // === M14: 夜间精英 Boss 专属饰品（M15 实装）===
  wreck_warlord_medal: {
    id: 'wreck_warlord_medal',
    name: '残骸战勋',
    paletteId: 'iron02',
    iconChar: '⚔',
    desc: '攻击速度 +25%（伤害/秒）',
    buff: { attackSpeedBonus: 1.25 },
  },
  storm_banner: {
    id: 'storm_banner',
    name: '风暴战旗',
    paletteId: 'rust01',
    iconChar: '⚡',
    desc: '冲刺冷却 -40% · 冲刺速度 +25%',
    buff: { dashCooldownMult: 0.6, dashSpeedMult: 1.25 },
  },
  magma_core: {
    id: 'magma_core',
    name: '熔岩核心',
    paletteId: 'ember02',
    iconChar: '☀',
    desc: '落地时 50 px 范围震伤 10 点',
    buff: { jumpSplashDamage: 10, jumpSplashRadius: 50 },
  },
  frost_veil: {
    id: 'frost_veil',
    name: '冰霜披纱',
    paletteId: 'cold02',
    iconChar: '❄',
    desc: '滑翔下落速度 -30% · 空中控制 +30%',
    buff: { glideFallSpeed: 70 },
  },
  hive_stinger: {
    id: 'hive_stinger',
    name: '毒刺护符',
    paletteId: 'bone03',
    iconChar: '♚',
    desc: '剑击附带 5 dps × 3 秒持续伤害',
    buff: { poisonDps: 5, poisonDuration: 3 },
  },
  shadow_cowl: {
    id: 'shadow_cowl',
    name: '暗影兜帽',
    paletteId: 'void04',
    iconChar: '⌘',
    desc: '25% 几率闪避伤害（无伤害、无受击硬直）',
    buff: { dodgeChance: 0.25 },
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
      if (b.jumpBonus) {
        result.jumpBonus = Math.max(result.jumpBonus ?? 1, b.jumpBonus);
      }
      if (b.gravityReduction) {
        result.gravityReduction = Math.max(result.gravityReduction ?? 0, b.gravityReduction);
      }
      if (b.critBonus) {
        result.critBonus = Math.max(result.critBonus ?? 0, b.critBonus);
      }
      if (b.critDamageMult) {
        result.critDamageMult = Math.max(result.critDamageMult ?? 1, b.critDamageMult);
      }
      if (b.voidResistance) {
        result.voidResistance = Math.max(result.voidResistance ?? 0, b.voidResistance);
      }
      if (b.nightVisionBonus) {
        result.nightVisionBonus = Math.max(result.nightVisionBonus ?? 0, b.nightVisionBonus);
      }
      // M15: 新增 buff
      if (b.attackSpeedBonus) {
        result.attackSpeedBonus = Math.max(result.attackSpeedBonus ?? 1, b.attackSpeedBonus);
      }
      if (b.dashCooldownMult) {
        result.dashCooldownMult = Math.min(result.dashCooldownMult ?? 1, b.dashCooldownMult);
      }
      if (b.dashSpeedMult) {
        result.dashSpeedMult = Math.max(result.dashSpeedMult ?? 1, b.dashSpeedMult);
      }
      if (b.poisonDps) {
        result.poisonDps = Math.max(result.poisonDps ?? 0, b.poisonDps);
      }
      if (b.poisonDuration) {
        result.poisonDuration = Math.max(result.poisonDuration ?? 0, b.poisonDuration);
      }
      if (b.jumpSplashDamage) {
        result.jumpSplashDamage = Math.max(result.jumpSplashDamage ?? 0, b.jumpSplashDamage);
      }
      if (b.jumpSplashRadius) {
        result.jumpSplashRadius = Math.max(result.jumpSplashRadius ?? 0, b.jumpSplashRadius);
      }
      if (b.dodgeChance) {
        result.dodgeChance = Math.max(result.dodgeChance ?? 0, b.dodgeChance);
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
    // M15: dashCooldownMult 实装（风暴战旗 -40%）
    const baseCd = buff.dashCooldown ?? 1.2;
    this.dashCooldownTimer = baseCd * (buff.dashCooldownMult ?? 1);
    this.dashDir = facing;
    // M15: dashSpeedMult 实装（风暴战旗 +25%）
    return (buff.dashSpeed ?? 520) * (buff.dashSpeedMult ?? 1);
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
