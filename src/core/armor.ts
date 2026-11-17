/**
 * 烬海纪元 · 护甲系统
 * ====================
 * 泰拉瑞亚式三件套护甲 — 头盔 / 胸甲 / 腿甲
 * 每件提供防御（固定减伤）+ 属性加成，集齐三件触发套装加成
 * 按 O 键装备当前选中的护甲
 */

export type ArmorSlot = 'head' | 'chest' | 'legs';

export interface ArmorBuff {
  maxHpBonus?: number;      // 生命上限加成
  moveSpeedBonus?: number;  // 移速倍率（1.1 = +10%）
  jumpBonus?: number;       // 跳跃倍率
  damageMult?: number;      // 攻击伤害倍率
  critBonus?: number;       // 额外暴击率
  miningBonus?: number;     // 挖掘速度倍率
  damageReduction?: number; // 额外减伤比例（0-1）
}

export interface ArmorDef {
  id: string;
  name: string;
  slot: ArmorSlot;
  setId: string;        // 所属套装
  paletteId: string;
  iconChar: string;
  defense: number;      // 防御值（damage - defense*0.5）
  buff?: ArmorBuff;
}

export interface ArmorSetDef {
  id: string;
  name: string;
  pieces: [string, string, string];      // head, chest, legs
  setBonusDesc: string;
  setBonus: ArmorBuff & { defense?: number };
}

/** 4 套护甲 × 3 部位 = 12 件 */
export const ARMOR_DEFS: Record<string, ArmorDef> = {
  // === 铜护甲（残骸带入门）===
  copper_helm: {
    id: 'copper_helm', name: '铜头盔', slot: 'head', setId: 'copper',
    paletteId: 'rust02', iconChar: '⌂', defense: 2,
  },
  copper_chest: {
    id: 'copper_chest', name: '铜胸甲', slot: 'chest', setId: 'copper',
    paletteId: 'rust02', iconChar: '▣', defense: 3,
  },
  copper_greaves: {
    id: 'copper_greaves', name: '铜腿甲', slot: 'legs', setId: 'copper',
    paletteId: 'rust02', iconChar: '⌄', defense: 2,
  },

  // === 铁护甲（戈壁矿脉）===
  iron_helm: {
    id: 'iron_helm', name: '铁头盔', slot: 'head', setId: 'iron',
    paletteId: 'iron01', iconChar: '⌂', defense: 4,
  },
  iron_chest: {
    id: 'iron_chest', name: '铁胸甲', slot: 'chest', setId: 'iron',
    paletteId: 'iron01', iconChar: '▣', defense: 6,
    buff: { maxHpBonus: 10 },
  },
  iron_greaves: {
    id: 'iron_greaves', name: '铁腿甲', slot: 'legs', setId: 'iron',
    paletteId: 'iron01', iconChar: '⌄', defense: 4,
  },

  // === 余金护甲（熔岩核心）===
  ember_helm: {
    id: 'ember_helm', name: '余金头盔', slot: 'head', setId: 'ember',
    paletteId: 'ember02', iconChar: '⌂', defense: 6,
    buff: { critBonus: 0.03 },
  },
  ember_chest: {
    id: 'ember_chest', name: '余金胸甲', slot: 'chest', setId: 'ember',
    paletteId: 'ember02', iconChar: '▣', defense: 8,
    buff: { damageMult: 1.10 },
  },
  ember_greaves: {
    id: 'ember_greaves', name: '余金腿甲', slot: 'legs', setId: 'ember',
    paletteId: 'ember02', iconChar: '⌄', defense: 6,
    buff: { moveSpeedBonus: 1.08 },
  },

  // === 虚空护甲（终局）===
  void_helm: {
    id: 'void_helm', name: '虚空头盔', slot: 'head', setId: 'void',
    paletteId: 'void01', iconChar: '⌂', defense: 9,
    buff: { critBonus: 0.05 },
  },
  void_chest: {
    id: 'void_chest', name: '虚空胸甲', slot: 'chest', setId: 'void',
    paletteId: 'void01', iconChar: '▣', defense: 12,
    buff: { maxHpBonus: 25, damageMult: 1.10 },
  },
  void_greaves: {
    id: 'void_greaves', name: '虚空腿甲', slot: 'legs', setId: 'void',
    paletteId: 'void01', iconChar: '⌄', defense: 9,
    buff: { moveSpeedBonus: 1.10, jumpBonus: 1.10 },
  },
};

export const ARMOR_SETS: Record<string, ArmorSetDef> = {
  copper: {
    id: 'copper', name: '铜套装',
    pieces: ['copper_helm', 'copper_chest', 'copper_greaves'],
    setBonusDesc: '移速 +12%',
    setBonus: { moveSpeedBonus: 1.12 },
  },
  iron: {
    id: 'iron', name: '铁套装',
    pieces: ['iron_helm', 'iron_chest', 'iron_greaves'],
    setBonusDesc: '额外减伤 10% · 生命 +15',
    setBonus: { damageReduction: 0.10, maxHpBonus: 15 },
  },
  ember: {
    id: 'ember', name: '余金套装',
    pieces: ['ember_helm', 'ember_chest', 'ember_greaves'],
    setBonusDesc: '伤害 +20% · 暴击伤害提升',
    setBonus: { damageMult: 1.20, critBonus: 0.05 },
  },
  void: {
    id: 'void', name: '虚空套装',
    pieces: ['void_helm', 'void_chest', 'void_greaves'],
    setBonusDesc: '伤害 +25% · 防御 +5 · 生命 +20',
    setBonus: { damageMult: 1.25, defense: 5, maxHpBonus: 20 },
  },
};

export const ARMOR_IDS = Object.keys(ARMOR_DEFS);

/** 玩家护甲管理器：3 个固定槽位 */
export class ArmorManager {
  head: string | null = null;
  chest: string | null = null;
  legs: string | null = null;

  /** 装备一件护甲到对应槽位（返回被替换的旧护甲 id 或 null） */
  equip(armorId: string): { ok: boolean; replaced: string | null } {
    const def = ARMOR_DEFS[armorId];
    if (!def) return { ok: false, replaced: null };
    const old = this[def.slot];
    this[def.slot] = armorId;
    return { ok: true, replaced: old };
  }

  /** 卸下指定槽位护甲 */
  unequip(slot: ArmorSlot): string | null {
    const old = this[slot];
    if (!old) return null;
    this[slot] = null;
    return old;
  }

  /** 已激活的套装 id 列表（集齐三件才激活） */
  getActiveSets(): string[] {
    const sets: string[] = [];
    for (const set of Object.values(ARMOR_SETS)) {
      const [h, c, l] = set.pieces;
      if (this.head === h && this.chest === c && this.legs === l) sets.push(set.id);
    }
    return sets;
  }

  /** 总防御值（含套装防御加成） */
  getTotalDefense(): number {
    let def = 0;
    if (this.head) def += ARMOR_DEFS[this.head].defense;
    if (this.chest) def += ARMOR_DEFS[this.chest].defense;
    if (this.legs) def += ARMOR_DEFS[this.legs].defense;
    for (const setId of this.getActiveSets()) {
      def += ARMOR_SETS[setId].setBonus.defense ?? 0;
    }
    return def;
  }

  /** 聚合所有护甲 + 套装 Buff */
  getAggregatedBuff(): ArmorBuff {
    const result: ArmorBuff = {};
    const pieces = [this.head, this.chest, this.legs];
    for (const id of pieces) {
      if (!id) continue;
      const b = ARMOR_DEFS[id].buff;
      if (!b) continue;
      this.merge(result, b);
    }
    // 套装加成
    for (const setId of this.getActiveSets()) {
      this.merge(result, ARMOR_SETS[setId].setBonus);
    }
    return result;
  }

  private merge(result: ArmorBuff, b: ArmorBuff) {
    if (b.maxHpBonus) result.maxHpBonus = (result.maxHpBonus ?? 0) + b.maxHpBonus;
    if (b.moveSpeedBonus) result.moveSpeedBonus = (result.moveSpeedBonus ?? 1) * b.moveSpeedBonus;
    if (b.jumpBonus) result.jumpBonus = (result.jumpBonus ?? 1) * b.jumpBonus;
    if (b.damageMult) result.damageMult = (result.damageMult ?? 1) * b.damageMult;
    if (b.critBonus) result.critBonus = (result.critBonus ?? 0) + b.critBonus;
    if (b.miningBonus) result.miningBonus = (result.miningBonus ?? 1) * b.miningBonus;
    if (b.damageReduction) result.damageReduction = (result.damageReduction ?? 0) + b.damageReduction;
  }
}
