/**
 * 烬海纪元 · 躯壳系统
 * =============
 * 方案核心创新：切躯壳 = 换身体 = 换属性 + 换被动
 * 区别泰拉瑞亚"靠装备换职业"——我们是**身体本身**不同
 * 同一套背包共用，后续可接 AI 队友
 */

export type ShellPalette = 'rust' | 'iron' | 'ember' | 'bone';

export interface ShellDef {
  id: string;
  name: string;
  palette: ShellPalette;
  // 属性
  baseHp: number;
  speed: number;        // 移动速度
  jumpSpeed: number;     // 跳跃力度
  pickaxePower: number;  // 镐等级（0-4）
  miningSpeed: number;   // 挖掘能量/秒
  damage: number;        // 徒手攻击伤害
  // 被动技能
  passive: string;
  passiveKey: 'burn' | 'pickaxe' | 'glow' | 'doublejump';
}

/** 4 种躯壳，对应 4 组主色调 */
export const SHELLS: ShellDef[] = [
  {
    id: 'rust_shell', name: '锈躯壳', palette: 'rust',
    baseHp: 140, speed: 160, jumpSpeed: 360,
    pickaxePower: 1, miningSpeed: 10, damage: 12,
    passive: '灼烧反击：被敌攻击时对攻击者造成 3 点伤害',
    passiveKey: 'burn',
  },
  {
    id: 'iron_shell', name: '铁躯壳', palette: 'iron',
    baseHp: 100, speed: 180, jumpSpeed: 380,
    pickaxePower: 2, miningSpeed: 22, damage: 8,
    passive: '强化镐：镐等级 +1（自动解锁中层矿脉）',
    passiveKey: 'pickaxe',
  },
  {
    id: 'ember_shell', name: '金躯壳', palette: 'ember',
    baseHp: 80, speed: 220, jumpSpeed: 400,
    pickaxePower: 1, miningSpeed: 14, damage: 10,
    passive: '荧光光环：身上带 15 tile 照明（吸引怪物）',
    passiveKey: 'glow',
  },
  {
    id: 'bone_shell', name: '骨躯壳', palette: 'bone',
    baseHp: 70, speed: 260, jumpSpeed: 460,
    pickaxePower: 0, miningSpeed: 6, damage: 6,
    passive: '二段跳：可在空中再跳一次',
    passiveKey: 'doublejump',
  },
];

/** 每个 palette 对应的头/身体/眼颜色 */
export interface ShellPaletteColors {
  head: string; body: string; eye: string; glow?: string;
}

export const SHELL_COLORS: Record<ShellPalette, ShellPaletteColors> = {
  rust:  { head: '#e88a4a', body: '#c4603a', eye: '#ffc85a', glow: '#e89430' },
  iron:  { head: '#c8ccd0', body: '#5a6066', eye: '#ff7a3a' },
  ember: { head: '#fff4c2', body: '#e89430', eye: '#ffc85a', glow: '#ffc85a' },
  bone:  { head: '#fff8e8', body: '#b8a888', eye: '#e8c547' },
};

export interface ShellState {
  shell: ShellDef;
  hp: number;
  unlocked: boolean;
}

export class ShellManager {
  shells: ShellState[];
  currentIdx = 0;
  switchCooldown = 0;   // 切换冷却
  transitioning = false; // 切换动画进行中
  transitionProgress = 0; // 0 → 1 淡出，1 → 2 淡入

  constructor() {
    this.shells = SHELLS.map(s => ({ shell: s, hp: s.baseHp, unlocked: true }));
  }

  get current(): ShellDef { return this.shells[this.currentIdx].shell; }
  get currentState(): ShellState { return this.shells[this.currentIdx]; }

  switchTo(idx: number): boolean {
    if (this.switchCooldown > 0 || this.transitioning) return false;
    if (idx < 0 || idx >= this.shells.length) return false;
    if (idx === this.currentIdx) return false;
    if (!this.shells[idx].unlocked) return false;

    this.currentIdx = idx;
    this.switchCooldown = 1.5;
    this.transitioning = true;
    this.transitionProgress = 0;
    return true;
  }

  next(): boolean { return this.switchTo((this.currentIdx + 1) % this.shells.length); }
  prev(): boolean { return this.switchTo((this.currentIdx - 1 + this.shells.length) % this.shells.length); }

  update(dt: number) {
    if (this.switchCooldown > 0) this.switchCooldown -= dt;
    if (this.transitioning) {
      this.transitionProgress += dt * 2; // 0.5s 淡出 + 0.5s 淡入
      if (this.transitionProgress >= 2) {
        this.transitioning = false;
        this.transitionProgress = 0;
      }
    }
  }

  /** 当前躯壳的全局不透明度（切换动画用） */
  get alpha(): number {
    if (!this.transitioning) return 1;
    if (this.transitionProgress < 1) return 1 - this.transitionProgress;     // 淡出
    return this.transitionProgress - 1;                                      // 淡入（0 → 1）
  }
}
