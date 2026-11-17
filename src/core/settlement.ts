/**
 * 烬海纪元 · NPC 城镇入驻系统
 * ====================
 * 泰拉瑞亚式城镇：放置「定居旗」后，随阶段推进定居者陆续搬迁到旗子附近
 * 每 30 秒入驻 1 位（医师 → 工程师），靠近后按 B 打开其专属商店
 * 定居者以不可破坏的特殊方块形式存在于世界中
 */

export const SETTLE_INTERVAL = 30;   // 入驻间隔（秒）
export const SETTLER_DEFS = [
  { id: 'medic', name: '医师', blockId: 'settler_medic', requiredStage: 1 },
  { id: 'engineer', name: '工程师', blockId: 'settler_engineer', requiredStage: 3 },
] as const;

export const MAX_SETTLERS = SETTLER_DEFS.length;

export interface SettlerInstance {
  typeId: string;
  tx: number;
  ty: number;
}

export interface SettlementSave {
  flagTx: number;
  flagTy: number;
  settlers: SettlerInstance[];
  timer: number;
}

export class SettlementManager {
  flagTx = -1;
  flagTy = -1;
  settlers: SettlerInstance[] = [];
  timer = 0;

  get hasFlag(): boolean {
    return this.flagTx >= 0;
  }

  placeFlag(tx: number, ty: number) {
    this.flagTx = tx;
    this.flagTy = ty;
    this.timer = 0;
  }

  removeFlag() {
    this.flagTx = -1;
    this.flagTy = -1;
    this.timer = 0;
  }

  /** 由定居者方块 id 反查 NPC 类型 id */
  static typeByBlock(blockId: string): string | null {
    for (const d of SETTLER_DEFS) {
      if (d.blockId === blockId) return d.id;
    }
    return null;
  }

  /**
   * 推进入驻流程
   * @param stageIndex 当前阶段索引，用于按进度解锁定居者（医师需阶段 2，工程师需阶段 4）
   * @returns 新入驻的定居者类型 id（没有则 null）
   */
  update(
    dt: number,
    getBlock: (x: number, y: number) => string,
    setBlock: (x: number, y: number, id: string) => void,
    stageIndex = 99,
  ): string | null {
    if (!this.hasFlag) return null;
    const unlocked = SETTLER_DEFS.filter(d => stageIndex >= d.requiredStage);
    if (this.settlers.length >= unlocked.length) return null;
    this.timer += dt;
    if (this.timer < SETTLE_INTERVAL) return null;
    this.timer = 0;
    const def = unlocked[this.settlers.length];
    if (!def) return null;
    const spot = this.findSpot(getBlock);
    if (!spot) return null;
    setBlock(spot.tx, spot.ty, def.blockId);
    this.settlers.push({ typeId: def.id, tx: spot.tx, ty: spot.ty });
    return def.id;
  }

  /** 在旗子周围寻找可站立空位（本身空 + 下方有支撑） */
  private findSpot(getBlock: (x: number, y: number) => string): { tx: number; ty: number } | null {
    for (let r = 2; r <= 7; r++) {
      for (const dir of [1, -1]) {
        for (let up = 1; up <= 3; up++) {
          const tx = this.flagTx + dir * r;
          const ty = this.flagTy - up;
          if (getBlock(tx, ty) === 'empty' && getBlock(tx, ty + 1) !== 'empty') {
            return { tx, ty };
          }
        }
      }
    }
    return null;
  }

  serialize(): SettlementSave {
    return {
      flagTx: this.flagTx,
      flagTy: this.flagTy,
      settlers: this.settlers.map(s => ({ ...s })),
      timer: this.timer,
    };
  }

  restore(save: SettlementSave | undefined) {
    if (!save) return;
    this.flagTx = save.flagTx ?? -1;
    this.flagTy = save.flagTy ?? -1;
    this.settlers = (save.settlers ?? []).map(s => ({ ...s }));
    this.timer = save.timer ?? 0;
  }
}
