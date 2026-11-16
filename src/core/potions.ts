/**
 * 烬海纪元 · 药水系统
 * ====================
 * 泰拉瑞亚式消耗品 buff — 提供临时增益（回血/减伤/加速/加伤/夜视）
 * 与饰品永久 buff 叠加
 */

export type PotionBuffType =
  | 'heal'           // 立即回血
  | 'defense'        // 减伤百分比
  | 'speed'          // 移速倍率
  | 'damage'         // 伤害倍率
  | 'night_vision';  // 夜间视野

export interface PotionDef {
  id: string;
  name: string;
  emoji: string;
  buffType: PotionBuffType;
  value: number;       // 数值（回血量/减伤%/倍率等）
  duration: number;    // 持续秒数（0 = 立即生效）
  paletteId: string;
}

export const POTION_DEFS: Record<string, PotionDef> = {
  health_potion: {
    id: 'health_potion', name: '生命药水', emoji: '❤',
    buffType: 'heal', value: 50, duration: 0, paletteId: 'red01',
  },
  iron_potion: {
    id: 'iron_potion', name: '铁皮药水', emoji: '🛡',
    buffType: 'defense', value: 0.25, duration: 30, paletteId: 'iron01',
  },
  swift_potion: {
    id: 'swift_potion', name: '敏捷药水', emoji: '💨',
    buffType: 'speed', value: 1.30, duration: 30, paletteId: 'water01',
  },
  strength_potion: {
    id: 'strength_potion', name: '力量药水', emoji: '💪',
    buffType: 'damage', value: 1.25, duration: 30, paletteId: 'orange01',
  },
  night_vision_potion: {
    id: 'night_vision_potion', name: '夜视药水', emoji: '👁',
    buffType: 'night_vision', value: 1.5, duration: 60, paletteId: 'glow01',
  },
};

/** 运行时 buff 状态 */
export interface ActiveBuff {
  type: PotionBuffType;
  value: number;
  remaining: number;  // 剩余秒数
}

/** 玩家当前所有临时 buff 聚合 */
export interface PotionBuffAggregate {
  defenseReduction: number;  // 减伤百分比（0-1）
  speedMult: number;         // 移速倍率
  damageMult: number;        // 伤害倍率
  nightVisionMult: number;   // 夜视倍率
}

export function aggregateBuffs(buffs: ActiveBuff[]): PotionBuffAggregate {
  const result: PotionBuffAggregate = {
    defenseReduction: 0,
    speedMult: 1,
    damageMult: 1,
    nightVisionMult: 1,
  };
  for (const b of buffs) {
    switch (b.type) {
      case 'defense': result.defenseReduction += b.value; break;
      case 'speed': result.speedMult *= b.value; break;
      case 'damage': result.damageMult *= b.value; break;
      case 'night_vision': result.nightVisionMult = Math.max(result.nightVisionMult, b.value); break;
    }
  }
  return result;
}
