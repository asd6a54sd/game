/**
 * 烬海纪元 · 成就系统
 * ===================
 * 长期目标追踪 — 每个成就解锁永久小 buff，叠加形成角色成长
 * 与 M17 任务系统互补：任务=短期引导，成就=长期全收集驱动
 */

export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  goal: number;            // 目标值
  reward: AchievementBuff; // 解锁后的永久 buff
}

/** 永久 buff（各成就叠加）*/
export interface AchievementBuff {
  damageMult?: number;        // 全伤害倍率（1.05 = +5%）
  rangedDamageMult?: number;  // 远程伤害额外倍率
  nightDamageMult?: number;   // 夜间伤害额外倍率
  maxHpBonus?: number;        // 最大 HP 加成
  moveSpeedMult?: number;     // 移速倍率
  miningSpeedMult?: number;   // 挖矿速度倍率
  critBonus?: number;         // 暴击率加成
  dropChanceBonus?: number;   // 掉落率加成（0-1）
}

export interface AchievementState {
  def: AchievementDef;
  progress: number;
  unlocked: boolean;
}

export class AchievementManager {
  achievements: AchievementState[] = [];
  onUnlock?: (a: AchievementState) => void;

  constructor() {
    this.achievements = ACHIEVEMENT_DEFS.map(def => ({
      def, progress: 0, unlocked: false,
    }));
  }

  /** 获取所有已解锁成就的 buff 叠加 */
  getAggregatedBuff(): AchievementBuff {
    const result: AchievementBuff = {};
    for (const a of this.achievements) {
      if (!a.unlocked) continue;
      const r = a.def.reward;
      if (r.damageMult) result.damageMult = (result.damageMult ?? 1) * r.damageMult;
      if (r.rangedDamageMult) result.rangedDamageMult = (result.rangedDamageMult ?? 1) * r.rangedDamageMult;
      if (r.nightDamageMult) result.nightDamageMult = (result.nightDamageMult ?? 1) * r.nightDamageMult;
      if (r.maxHpBonus) result.maxHpBonus = (result.maxHpBonus ?? 0) + r.maxHpBonus;
      if (r.moveSpeedMult) result.moveSpeedMult = (result.moveSpeedMult ?? 1) * r.moveSpeedMult;
      if (r.miningSpeedMult) result.miningSpeedMult = (result.miningSpeedMult ?? 1) * r.miningSpeedMult;
      if (r.critBonus) result.critBonus = (result.critBonus ?? 0) + r.critBonus;
      if (r.dropChanceBonus) result.dropChanceBonus = (result.dropChanceBonus ?? 0) + r.dropChanceBonus;
    }
    return result;
  }

  /** 通用进度增加 */
  addProgress(id: string, n = 1) {
    const a = this.achievements.find(x => x.def.id === id);
    if (!a || a.unlocked) return;
    a.progress = Math.min(a.def.goal, a.progress + n);
    if (a.progress >= a.def.goal) this.unlock(a);
  }

  /** 设置进度（用于收集类成就需要精确值）*/
  setProgress(id: string, value: number) {
    const a = this.achievements.find(x => x.def.id === id);
    if (!a || a.unlocked) return;
    a.progress = Math.min(a.def.goal, value);
    if (a.progress >= a.def.goal) this.unlock(a);
  }

  private unlock(a: AchievementState) {
    a.unlocked = true;
    this.onUnlock?.(a);
  }

  /** 已解锁数量 */
  get unlockedCount(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'first_tool', name: '初探者', emoji: '🏗',
    desc: '合成第一把工具（镐/剑/弓）',
    goal: 1,
    reward: { miningSpeedMult: 1.05 },
  },
  {
    id: 'kill_50', name: '战士', emoji: '⚔',
    desc: '击败 50 个敌人',
    goal: 50,
    reward: { damageMult: 1.05 },
  },
  {
    id: 'kill_boss_1', name: 'Boss 猎人', emoji: '☠',
    desc: '击败 1 个 Boss',
    goal: 1,
    reward: { maxHpBonus: 10 },
  },
  {
    id: 'kill_night_boss_1', name: '夜间猎手', emoji: '🌙',
    desc: '击败 1 个夜间精英 Boss',
    goal: 1,
    reward: { nightDamageMult: 1.10 },
  },
  {
    id: 'ranged_kill_20', name: '神射手', emoji: '🎯',
    desc: '使用远程武器击败 20 个敌人',
    goal: 20,
    reward: { rangedDamageMult: 1.10 },
  },
  {
    id: 'collect_10', name: '收藏家', emoji: '💎',
    desc: '背包中拥有 10 种不同方块',
    goal: 10,
    reward: { dropChanceBonus: 0.05 },
  },
  {
    id: 'explore_all', name: '探险家', emoji: '🗺',
    desc: '探索所有 6 个区块',
    goal: 6,
    reward: { moveSpeedMult: 1.10 },
  },
  {
    id: 'survive_3_events', name: '事件幸存者', emoji: '✨',
    desc: '经历 3 种不同世界事件',
    goal: 3,
    reward: { critBonus: 0.05 },
  },
  {
    id: 'all_bosses', name: '全 Boss 征服者', emoji: '👑',
    desc: '击败所有 9 个 Boss',
    goal: 9,
    reward: { damageMult: 1.20 },
  },
  {
    id: 'all_achievements', name: '烬海之王', emoji: '🏆',
    desc: '完成所有其他成就',
    goal: 9,
    reward: { maxHpBonus: 30 },
  },
];
