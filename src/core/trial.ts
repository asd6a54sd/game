/**
 * 烬海纪元 · 试炼场系统
 * =====================
 * 泰拉瑞亚式 Boss Rush — 玩家激活试炼坛后连续挑战递增波次
 * 全部通关获得稀有奖励
 */

export interface TrialWave {
  enemies: string[];   // 敌人 defType 列表（按数量生成）
  boss?: string;       // 该波 Boss defType（可选）
  delayMs: number;     // 波次开始延迟
}

export interface TrialDef {
  id: string;
  name: string;
  emoji: string;
  waves: TrialWave[];
  cost: { blockId: string; count: number }[];  // 激活消耗
  reward: { blockId: string; count: number }[];  // 通关奖励
}

export const TRIAL_DEFS: Record<string, TrialDef> = {
  // 残骸带试炼 — 中等难度
  wreck_trial: {
    id: 'wreck_trial',
    name: '残骸试炼',
    emoji: '🔩',
    cost: [{ blockId: 'wreck_scrap', count: 10 }],
    reward: [
      { blockId: 'ore_iron', count: 5 },
      { blockId: 'ore_gold', count: 1 },
      { blockId: 'dark_seed', count: 1 },
    ],
    waves: [
      { enemies: ['alloy_slime', 'alloy_slime', 'wreck_drone'], delayMs: 1500 },
      { enemies: ['wreck_soldier', 'wreck_soldier', 'alloy_slime'], delayMs: 2000 },
      { enemies: ['wreck_soldier', 'wreck_drone', 'wreck_drone', 'alloy_slime'], boss: 'night_wreck_chief', delayMs: 2500 },
    ],
  },
  // 虚空试炼 — 高难度，奖励饰品
  void_trial: {
    id: 'void_trial',
    name: '虚空试炼',
    emoji: '☠',
    cost: [{ blockId: 'void_crystal', count: 2 }, { blockId: 'dark_seed', count: 3 }],
    reward: [
      { blockId: 'void_crystal', count: 2 },
      { blockId: 'dark_filament', count: 2 },
      { blockId: 'ore_gold', count: 3 },
      { blockId: 'crystal_glow', count: 3 },
    ],
    waves: [
      { enemies: ['void_flyer', 'void_wraith'], delayMs: 2000 },
      { enemies: ['void_wraith', 'void_flyer', 'rebel_ghost'], delayMs: 2500 },
      { enemies: ['void_flyer', 'void_flyer', 'rebel_ghost', 'void_wraith'], delayMs: 3000 },
      { enemies: ['rebel_ghost', 'void_wraith', 'void_wraith'], boss: 'shadow_lich', delayMs: 3500 },
    ],
  },
  // 野兽试炼 — 中等难度
  beast_trial: {
    id: 'beast_trial',
    name: '野兽试炼',
    emoji: '🐛',
    cost: [{ blockId: 'chitin', count: 8 }, { blockId: 'bio_glow', count: 3 }],
    reward: [
      { blockId: 'chitin', count: 4 },
      { blockId: 'ore_gold', count: 2 },
      { blockId: 'bio_glow', count: 2 },
    ],
    waves: [
      { enemies: ['chitin_beetle', 'chitin_beetle'], delayMs: 1500 },
      { enemies: ['hive_stalker', 'chitin_beetle', 'hive_stalker'], delayMs: 2000 },
      { enemies: ['hive_stalker', 'hive_stalker', 'chitin_beetle', 'chitin_beetle'], boss: 'hive_overlord', delayMs: 2500 },
    ],
  },
};

/** 试炼运行时状态 */
export class TrialManager {
  active = false;
  currentTrial: TrialDef | null = null;
  waveIndex = 0;
  waveTimer = 0;        // 波次倒计时（秒）
  waveStarted = false;  // 当前波是否已生成
  enemiesRemaining = 0; // 当前波剩余敌人
  bossesRemaining = 0;  // 当前波剩余 Boss
  onComplete?: () => void;
  onFail?: () => void;
  onWaveStart?: (waveIndex: number, total: number) => void;

  /** 激活试炼 */
  start(trial: TrialDef): boolean {
    if (this.active) return false;
    this.active = true;
    this.currentTrial = trial;
    this.waveIndex = 0;
    this.waveTimer = trial.waves[0].delayMs / 1000;
    this.waveStarted = false;
    this.enemiesRemaining = 0;
    this.bossesRemaining = 0;
    return true;
  }

  /** 每帧更新，返回当前波是否该生成 */
  update(dt: number): 'spawn_wave' | 'check_complete' | 'waiting' {
    if (!this.active || !this.currentTrial) return 'waiting';
    if (!this.waveStarted) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveStarted = true;
        return 'spawn_wave';
      }
    }
    // 检查当前波是否清空
    if (this.waveStarted && this.enemiesRemaining <= 0 && this.bossesRemaining <= 0) {
      this.waveIndex++;
      if (this.waveIndex >= this.currentTrial.waves.length) {
        // 通关
        this.active = false;
        this.onComplete?.();
        return 'waiting';
      }
      // 下一波
      this.waveStarted = false;
      this.waveTimer = this.currentTrial.waves[this.waveIndex].delayMs / 1000;
      this.onWaveStart?.(this.waveIndex, this.currentTrial.waves.length);
    }
    return 'check_complete';
  }

  /** 注册当前波的敌人/Boss 数量 */
  setWaveCounts(enemies: number, bosses: number) {
    this.enemiesRemaining = enemies;
    this.bossesRemaining = bosses;
  }

  enemyDied() { if (this.enemiesRemaining > 0) this.enemiesRemaining--; }
  bossDied() { if (this.bossesRemaining > 0) this.bossesRemaining--; }

  /** 玩家死亡 → 试炼失败 */
  fail() {
    if (!this.active) return;
    this.active = false;
    this.onFail?.();
  }

  reset() {
    this.active = false;
    this.currentTrial = null;
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.waveStarted = false;
    this.enemiesRemaining = 0;
    this.bossesRemaining = 0;
  }
}
