/**
 * 烬海纪元 · 坐骑系统
 * ====================
 * 泰拉瑞亚式快速移动层 — 提供移速/跳跃/飞行能力
 * 按 J 键上下马
 */

export interface MountDef {
  id: string;
  name: string;
  emoji: string;
  paletteId: string;
  speedMult: number;       // 移速倍率
  jumpMult: number;        // 跳跃倍率
  canFly: boolean;         // 是否能飞行（按住跳跃键滞空）
  flyFallSpeed: number;    // 飞行时下落速度
  gravityMult: number;     // 骑乘时重力倍率
}

export const MOUNT_DEFS: Record<string, MountDef> = {
  // 残骸战马 — 高速地面移动
  wreck_horse: {
    id: 'wreck_horse', name: '残骸战马', emoji: '🐴',
    paletteId: 'rust02',
    speedMult: 1.8, jumpMult: 1.2,
    canFly: false, flyFallSpeed: 0, gravityMult: 1,
  },
  // 史莱姆坐骑 — 超高跳跃
  slime_mount: {
    id: 'slime_mount', name: '史莱姆坐骑', emoji: '🟢',
    paletteId: 'bio01',
    speedMult: 1.3, jumpMult: 1.8,
    canFly: false, flyFallSpeed: 0, gravityMult: 0.8,
  },
  // 虚空飞龙 — 飞行能力
  void_drake: {
    id: 'void_drake', name: '虚空飞龙', emoji: '🐉',
    paletteId: 'void01',
    speedMult: 1.5, jumpMult: 1.3,
    canFly: true, flyFallSpeed: 40, gravityMult: 0.5,
  },
};
