/**
 * 烬海纪元 · 世界事件系统
 * =====================
 * 随机事件让"下次进游戏会发生什么"充满变数
 * 4 个事件 × 6 区块 × 日夜循环 → 每次进入游戏体验都不同
 */

export type WorldEventType =
  | 'blood_moon'      // 血月（全区块，夜间）
  | 'sandstorm'       // 戈壁沙暴（gobi_mine，白天）
  | 'glow_tide'       // 幽光潮（silent_sea，夜晚）
  | 'void_rift';      // 虚空裂隙（underground_valley，夜晚）

export interface WorldEvent {
  type: WorldEventType;
  name: string;
  emoji: string;
  desc: string;
  duration: number;      // 总持续秒数
  remaining: number;     // 剩余秒数
  region?: string;       // 影响的区块（undefined = 全区块）
  timeOfDay: 'day' | 'night' | 'any';
}

export interface WorldEventDef {
  type: WorldEventType;
  name: string;
  emoji: string;
  desc: string;
  region?: string;
  timeOfDay: 'day' | 'night' | 'any';
  duration: number;      // 秒
  triggerChance: number; // 每 10 秒检查一次时的几率（0-1）
}

export const WORLD_EVENT_DEFS: WorldEventDef[] = [
  {
    type: 'blood_moon', name: '血月', emoji: '🌙',
    desc: '全区块 · 夜间 Boss 刷新几率 ×2 · 精英敌人强制出现',
    timeOfDay: 'night', duration: 60, triggerChance: 0.15,
  },
  {
    type: 'sandstorm', name: '戈壁沙暴', emoji: '🌪',
    desc: 'gobi_mine · 视野缩小 50% · 岩石傀儡刷新翻倍',
    region: 'gobi_mine', timeOfDay: 'day', duration: 45, triggerChance: 0.20,
  },
  {
    type: 'glow_tide', name: '幽光潮', emoji: '💎',
    desc: 'silent_sea · 发光晶体大量刷新 · 冷海猎手成群',
    region: 'silent_sea', timeOfDay: 'night', duration: 50, triggerChance: 0.25,
  },
  {
    type: 'void_rift', name: '虚空裂隙', emoji: '⚠',
    desc: 'underground_valley · 黑雾同化加速 3× · void_flyer 成群',
    region: 'underground_valley', timeOfDay: 'night', duration: 55, triggerChance: 0.20,
  },
];

export class WorldEventManager {
  current: WorldEvent | null = null;
  cooldownTimer = 20;      // 事件结束后 20s 冷却才能再次触发
  checkTimer = 0;          // 每 10s 检查一次是否触发
  onEventStart?: (e: WorldEvent) => void;
  onEventEnd?: (e: WorldEvent) => void;

  update(dt: number, timeOfDay: number, playerCol: number) {
    // 持续中：倒计时
    if (this.current) {
      this.current.remaining -= dt;
      if (this.current.remaining <= 0) {
        const ended = this.current;
        this.current = null;
        this.cooldownTimer = 25;
        this.onEventEnd?.(ended);
      }
      return;
    }
    // 冷却中
    if (this.cooldownTimer > 0) { this.cooldownTimer -= dt; return; }
    // 每 10s 检查一次
    this.checkTimer -= dt;
    if (this.checkTimer > 0) return;
    this.checkTimer = 10;

    // 判断日夜
    const isNight = timeOfDay > 0.55 || timeOfDay < 0.1;
    const time: 'day' | 'night' = isNight ? 'night' : 'day';

    // 映射玩家区块
    let region = 'wreck_zone';
    if (playerCol < 60) region = 'wreck_zone';
    else if (playerCol < 120) region = 'crack_waste';
    else if (playerCol < 180) region = 'gobi_mine';
    else if (playerCol < 240) region = 'silent_sea';
    else if (playerCol < 300) region = 'beast_hive';
    else if (playerCol < 360) region = 'underground_valley';
    else if (playerCol < 420) region = 'frozen_waste';
    else if (playerCol < 480) region = 'ash_volcano';
    else if (playerCol < 540) region = 'rot_mire';
    else if (playerCol < 600) region = 'ashen_court';
    else if (playerCol < 660) region = 'storm_rift';
    else region = 'ember_sanctum';

    // 筛选当前时刻 + 区块匹配的事件
    const candidates = WORLD_EVENT_DEFS.filter(def => {
      if (def.timeOfDay !== 'any' && def.timeOfDay !== time) return false;
      if (def.region && def.region !== region) return false;
      return true;
    });

    if (candidates.length === 0) return;
    // 血月（全区块夜间）额外允许
    const pool = candidates;
    const def = pool[Math.floor(Math.random() * pool.length)];

    if (Math.random() < def.triggerChance) {
      this.current = {
        type: def.type, name: def.name, emoji: def.emoji,
        desc: def.desc, duration: def.duration, remaining: def.duration,
        region: def.region, timeOfDay: def.timeOfDay,
      };
      this.onEventStart?.(this.current);
    }
  }

  /** 事件是否正在某区块生效 */
  isActiveInRegion(region: string): boolean {
    if (!this.current) return false;
    if (!this.current.region) return true; // 全区块事件（血月）
    return this.current.region === region;
  }

  /** 是否是指定类型事件 */
  isEvent(type: WorldEventType): boolean {
    return this.current?.type === type;
  }
}
