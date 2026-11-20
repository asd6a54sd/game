/**
 * 烬海纪元 · 任务系统
 * ====================
 * 泰拉瑞亚式进度驱动 — 给玩家明确目标 + 阶段性奖励
 * 6 个初始任务串联主线：初探残骸带 → 第一道防线 → 黑暗黎明 → 净化祭坛 → 夜色猎手 → 踏遍烬海
 */

export type QuestType =
  | 'mine'          // 挖 N 个指定方块
  | 'kill'          // 击败 N 个敌人
  | 'craft'         // 合成 N 个指定物品
  | 'kill_boss'     // 击败 N 个 Boss（含夜间 Boss）
  | 'explore';      // 探索 N 个不同区块

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  type: QuestType;
  target?: string;   // 目标方块/物品/敌人 id（mine/craft 用）
  targetCount: number;
  reward: { blockId: string; count: number }[];
  completedDesc: string;
}

export interface QuestState {
  def: QuestDef;
  progress: number;
  completed: boolean;
  claimed: boolean;  // 奖励是否已领取
}

export class QuestManager {
  quests: QuestState[] = [];
  onComplete?: (q: QuestState) => void;
  onClaim?: (q: QuestState) => void;
  private exploredRegions: Set<string> = new Set();

  constructor() {
    this.quests = QUEST_DEFS.map(def => ({
      def, progress: 0, completed: false, claimed: false,
    }));
  }

  /** 初始化已探索区块（从 terrain.structures 自动推断）*/
  setExploredRegions(regions: string[]) {
    for (const r of regions) this.exploredRegions.add(r);
    this.recomputeExplore();
  }

  /** 触发：挖方块 */
  onMine(blockId: string) {
    for (const q of this.quests) {
      if (q.completed || q.def.type !== 'mine') continue;
      if (!q.def.target || q.def.target === blockId) {
        this.incProgress(q, 1);
      }
    }
  }

  /** 触发：击败敌人（isBoss 区分普通敌人和 Boss）*/
  onKill(isBoss = false, _isNightBoss = false) {
    for (const q of this.quests) {
      if (q.completed) continue;
      if (q.def.type === 'kill' && !isBoss) this.incProgress(q, 1);
      if (q.def.type === 'kill_boss' && isBoss) this.incProgress(q, 1);
    }
  }

  /** 触发：合成物品 */
  onCraft(itemId: string, count: number) {
    for (const q of this.quests) {
      if (q.completed || q.def.type !== 'craft') continue;
      if (!q.def.target || q.def.target === itemId) {
        this.incProgress(q, count);
      }
    }
  }

  /** 触发：玩家进入新区块 */
  onEnterRegion(region: string) {
    if (this.exploredRegions.has(region)) return;
    this.exploredRegions.add(region);
    this.recomputeExplore();
  }

  private recomputeExplore() {
    for (const q of this.quests) {
      if (q.def.type === 'explore') {
        q.progress = this.exploredRegions.size;
        this.checkComplete(q);
      }
    }
  }

  private incProgress(q: QuestState, n: number) {
    q.progress = Math.min(q.def.targetCount, q.progress + n);
    this.checkComplete(q);
  }

  private checkComplete(q: QuestState) {
    if (!q.completed && q.progress >= q.def.targetCount) {
      q.completed = true;
      this.onComplete?.(q);
    }
  }

  /** 领取奖励（返回奖励数组，由 main.ts 加入背包）*/
  claimReward(q: QuestState): { blockId: string; count: number }[] {
    if (!q.completed || q.claimed) return [];
    q.claimed = true;
    this.onClaim?.(q);
    return q.def.reward.map(r => ({ ...r }));
  }

  /** 获取未领取的已完成任务（用于 HUD 闪烁提示）*/
  getUnclaimed(): QuestState[] {
    return this.quests.filter(q => q.completed && !q.claimed);
  }
}

export const QUEST_DEFS: QuestDef[] = [
  {
    id: 'mine_wreck',
    name: '初探残骸带',
    desc: '挖 5 块残骸碎片',
    type: 'mine', target: 'wreck_scrap', targetCount: 5,
    reward: [{ blockId: 'ore_iron', count: 3 }],
    completedDesc: '获得 铁矿×3',
  },
  {
    id: 'kill_enemies',
    name: '第一道防线',
    desc: '击败 10 个敌人',
    type: 'kill', targetCount: 10,
    reward: [{ blockId: 'ore_copper', count: 3 }, { blockId: 'wreck_scrap', count: 2 }],
    completedDesc: '获得 铜矿×3 + 残骸碎片×2',
  },
  {
    id: 'craft_void_pickaxe',
    name: '黑暗黎明',
    desc: '合成 1 把虚空镐',
    type: 'craft', target: 'void_pickaxe', targetCount: 1,
    reward: [{ blockId: 'dark_seed', count: 3 }],
    completedDesc: '获得 暗种×3',
  },
  {
    id: 'kill_boss',
    name: '净化祭坛',
    desc: '击败 1 个 Boss',
    type: 'kill_boss', targetCount: 1,
    reward: [{ blockId: 'void_crystal', count: 1 }, { blockId: 'dark_filament', count: 1 }],
    completedDesc: '获得 虚空晶体×1 + 暗能丝×1',
  },
  {
    id: 'kill_night_boss',
    name: '夜色猎手',
    desc: '击败 1 个夜间精英 Boss',
    type: 'kill_boss', targetCount: 1,
    reward: [{ blockId: 'ore_gold', count: 3 }],
    completedDesc: '获得 金矿×3',
  },
  {
    id: 'explore_all',
    name: '踏遍烬海',
    desc: '探索所有 14 个区块',
    type: 'explore', targetCount: 14,
    reward: [{ blockId: 'ore_gold', count: 5 }, { blockId: 'void_crystal', count: 1 }],
    completedDesc: '获得 金矿×5 + 虚空晶体×1',
  },
];
