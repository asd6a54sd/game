/**
 * 烬海纪元 · 种植系统
 * ====================
 * 泰拉瑞亚式作物种植 — 种下种子后随时间分阶段生长，成熟后挖掘收获
 * 简化实现：作物以方块形式存在（阶段 0/1/2），由 CropManager 定时推进阶段
 * 成熟方块 drops 配置好种子与产物，挖掘即收获
 */

export interface CropDef {
  id: string;
  name: string;
  stages: string[];       // 各阶段对应方块 id（0=幼苗 … 末位=成熟）
  stageDuration: number;  // 每阶段生长秒数
  seedId: string;         // 种子物品 id
}

export const CROP_DEFS: Record<string, CropDef> = {
  ember_wheat: {
    id: 'ember_wheat',
    name: '余烬小麦',
    stages: ['wheat_stage0', 'wheat_stage1', 'wheat_stage2'],
    stageDuration: 20,
    seedId: 'wheat_seed',
  },
};

export interface CropInstance {
  cropId: string;
  stage: number;
  timer: number;
}

export interface CropSave {
  tx: number;
  ty: number;
  cropId: string;
  stage: number;
  timer: number;
}

export class CropManager {
  private crops = new Map<string, CropInstance>();

  private key(tx: number, ty: number): string {
    return `${tx},${ty}`;
  }

  /** 由种子 id 反查作物定义 */
  cropBySeed(seedId: string): CropDef | null {
    for (const c of Object.values(CROP_DEFS)) {
      if (c.seedId === seedId) return c;
    }
    return null;
  }

  /** 由阶段方块反查作物定义 */
  cropByStageBlock(blockId: string): CropDef | null {
    for (const c of Object.values(CROP_DEFS)) {
      if (c.stages.includes(blockId)) return c;
    }
    return null;
  }

  /** 记录一次种植（方块由调用方设置） */
  plant(tx: number, ty: number, cropId: string) {
    this.crops.set(this.key(tx, ty), { cropId, stage: 0, timer: 0 });
  }

  get count(): number {
    return this.crops.size;
  }

  /**
   * 推进生长
   * - 到时间自动升阶并替换世界方块
   * - 若该位置方块已被玩家挖掉/替换，则清除记录
   */
  update(
    dt: number,
    getBlock: (x: number, y: number) => string,
    setBlock: (x: number, y: number, id: string) => void,
  ) {
    for (const [key, inst] of [...this.crops.entries()]) {
      const def = CROP_DEFS[inst.cropId];
      if (!def) { this.crops.delete(key); continue; }
      const [txStr, tyStr] = key.split(',');
      const tx = Number(txStr), ty = Number(tyStr);
      // 与地形同步校验
      if (getBlock(tx, ty) !== def.stages[inst.stage]) {
        this.crops.delete(key);
        continue;
      }
      // 已成熟
      if (inst.stage >= def.stages.length - 1) continue;
      inst.timer += dt;
      if (inst.timer >= def.stageDuration) {
        inst.timer = 0;
        inst.stage++;
        setBlock(tx, ty, def.stages[inst.stage]);
      }
    }
  }

  serialize(): CropSave[] {
    return [...this.crops.entries()].map(([key, inst]) => {
      const [tx, ty] = key.split(',').map(Number);
      return { tx, ty, cropId: inst.cropId, stage: inst.stage, timer: inst.timer };
    });
  }

  restore(list: CropSave[] | undefined) {
    this.crops.clear();
    if (!list) return;
    for (const c of list) {
      this.crops.set(this.key(c.tx, c.ty), { cropId: c.cropId, stage: c.stage, timer: c.timer });
    }
  }
}
