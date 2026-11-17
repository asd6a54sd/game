/**
 * 烬海纪元 · 阶段进度系统
 * ====================
 * 大框架主线：用计数/布尔推导当前阶段，避免状态漂移
 * 阶段推进顺序与地牢解锁条件串联整条玩法链路
 */

export interface StageReward {
  blockId: string;
  count: number;
}

export interface StageDef {
  id: string;
  name: string;
  goal: string;
  /** 阶段推进奖励（发放到背包 + 回满生命/魔力） */
  reward: StageReward[];
}

export const STAGES: StageDef[] = [
  { id: 'awaken', name: '苏醒', goal: '挖掘 10 个方块', reward: [{ blockId: 'gold_coin', count: 5 }] },
  { id: 'foothold', name: '立足', goal: '合成 3 次物品', reward: [{ blockId: 'gold_coin', count: 8 }, { blockId: 'purify_torch', count: 3 }] },
  { id: 'long_night', name: '长夜', goal: '击败 5 个敌人', reward: [{ blockId: 'gold_coin', count: 12 }, { blockId: 'health_potion', count: 2 }] },
  { id: 'overlord', name: '霸主', goal: '击败任意 Boss', reward: [{ blockId: 'gold_coin', count: 20 }, { blockId: 'life_crystal', count: 1 }] },
  { id: 'curse', name: '诅咒', goal: '击败骷髅王，解开地牢之门', reward: [{ blockId: 'gold_coin', count: 30 }, { blockId: 'mana_crystal', count: 1 }] },
  { id: 'dungeon', name: '地牢', goal: '深入深渊，挑战更深处', reward: [{ blockId: 'gold_coin', count: 50 }, { blockId: 'life_crystal', count: 1 }, { blockId: 'mana_crystal', count: 1 }] },
];

export interface ProgressionSave {
  mined: number;
  crafted: number;
  kills: number;
  bossKills: number;
  skeletonDefeated: boolean;
  dungeonEntered: boolean;
  stageIndex: number;
}

export class ProgressionManager {
  mined = 0;
  crafted = 0;
  kills = 0;
  bossKills = 0;
  skeletonDefeated = false;
  dungeonEntered = false;
  stageIndex = 0;
  /** 阶段推进回调（仅在真正变化时触发） */
  onStageChange?: (stage: StageDef, index: number) => void;

  get stage(): StageDef {
    return STAGES[Math.min(this.stageIndex, STAGES.length - 1)];
  }

  get total(): number {
    return STAGES.length;
  }

  /** HUD 文案：阶段 n/N · 名称 · 目标 */
  get hudText(): string {
    return `🚩 阶段 ${this.stageIndex + 1}/${STAGES.length} · ${this.stage.name} · 目标: ${this.stage.goal}`;
  }

  /** 按条件从高到低推导阶段 */
  private computeStage(): number {
    if (this.skeletonDefeated && this.dungeonEntered) return 5;
    if (this.skeletonDefeated) return 4;
    if (this.bossKills > 0) return 3;
    if (this.kills >= 5) return 2;
    if (this.crafted >= 3) return 1;
    return 0;
  }

  /** 重新计算阶段，变化时触发回调 */
  sync() {
    const next = this.computeStage();
    if (next === this.stageIndex) return;
    this.stageIndex = next;
    this.onStageChange?.(this.stage, next);
  }

  onMine(count = 1) {
    this.mined += count;
    this.sync();
  }

  onCraft(count = 1) {
    this.crafted += count;
    this.sync();
  }

  onKill() {
    this.kills++;
    this.sync();
  }

  onBossKill(id: string) {
    this.bossKills++;
    if (id === 'skeleton_king') this.skeletonDefeated = true;
    this.sync();
  }

  enterDungeon() {
    if (this.dungeonEntered) return;
    this.dungeonEntered = true;
    this.sync();
  }

  serialize(): ProgressionSave {
    return {
      mined: this.mined,
      crafted: this.crafted,
      kills: this.kills,
      bossKills: this.bossKills,
      skeletonDefeated: this.skeletonDefeated,
      dungeonEntered: this.dungeonEntered,
      stageIndex: this.stageIndex,
    };
  }

  restore(save: ProgressionSave | undefined) {
    if (!save) return;
    this.mined = Math.max(0, save.mined | 0);
    this.crafted = Math.max(0, save.crafted | 0);
    this.kills = Math.max(0, save.kills | 0);
    this.bossKills = Math.max(0, save.bossKills | 0);
    this.skeletonDefeated = !!save.skeletonDefeated;
    this.dungeonEntered = !!save.dungeonEntered;
    this.stageIndex = Math.max(0, Math.min(STAGES.length - 1, save.stageIndex | 0));
    this.sync();
  }
}
