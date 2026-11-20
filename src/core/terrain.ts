/**
 * 烬海纪元 · 地形生成器
 * 第一幕《特恩无人区》横向剖面 — 12 区块 × 3 地层
 */
import { BLOCKS, isSolid, isLiquid } from './blocks.js';

export type RegionId =
  | 'wreck_zone'
  | 'crack_waste'
  | 'gobi_mine'
  | 'silent_sea'
  | 'beast_hive'
  | 'underground_valley'
  | 'frozen_waste'
  | 'ash_volcano'
  | 'rot_mire'
  | 'ashen_court'
  | 'storm_rift'
  | 'ember_sanctum'
  | 'crystal_highland'
  | 'void_frontier';

export interface Region {
  id: RegionId;
  name: string;
  startCol: number;
  endCol: number;
  palette: string[];
  description: string;
}

export const MAP_WIDTH = 840;
export const MAP_HEIGHT = 180;
export const TILE_SIZE = 16;

export const REGIONS: Region[] = [
  { id: 'wreck_zone', name: '烬落残骸带', startCol: 0,   endCol: 60,  palette: ['rust', 'iron', 'ember'], description: '坠舰残骸与断口火焰' },
  { id: 'crack_waste', name: '龟裂荒原',   startCol: 60,  endCol: 120, palette: ['rust', 'bone'],          description: '风蚀岩柱、网状地裂' },
  { id: 'gobi_mine',   name: '戈壁矿脉',   startCol: 120, endCol: 180, palette: ['bone', 'iron', 'ember'], description: '高地 + 三层地下矿带剖面' },
  { id: 'silent_sea',  name: '无声海',     startCol: 180, endCol: 240, palette: ['cold', 'iron'],          description: '液态金属湖与浮游金属体' },
  { id: 'beast_hive',  name: '异兽巢穴',   startCol: 240, endCol: 300, palette: ['bone', 'void'],          description: '甲壳蜂巢与幽蓝荧光' },
  { id: 'underground_valley', name: '地底幽谷', startCol: 300, endCol: 360, palette: ['void', 'iron'], description: '叛军据点与暗能量结界' },
  { id: 'frozen_waste',  name: '霜蚀冻原',   startCol: 360, endCol: 420, palette: ['cold', 'bone', 'iron'], description: '冰层、永冻土与冷色雪原' },
  { id: 'ash_volcano',   name: '熔渣火山',   startCol: 420, endCol: 480, palette: ['ember', 'rust', 'iron'], description: '火山锥、玄武岩与岩浆湖' },
  { id: 'rot_mire',      name: '腐蚀沼泽',   startCol: 480, endCol: 540, palette: ['rust', 'bone', 'void'], description: '淤泥、毒沼与发光孢子' },
  { id: 'ashen_court',   name: '灰烬王庭',   startCol: 540, endCol: 600, palette: ['bone', 'iron', 'ember'], description: '废都地砖、断柱与王庭火盆' },
  { id: 'storm_rift',    name: '雷鸣裂谷',   startCol: 600, endCol: 660, palette: ['iron', 'cold', 'rust'], description: '焦土、导电岩与雷晶尖峰' },
  { id: 'ember_sanctum', name: '余烬圣所',   startCol: 660, endCol: 720, palette: ['bone', 'ember', 'rust'], description: '圣所地砖、青铜墙与长明圣火' },
  { id: 'crystal_highland', name: '晶簇高原', startCol: 720, endCol: 780, palette: ['cold', 'iron', 'void'], description: '棱岩台地、晶簇矿脉与镜面反光' },
  { id: 'void_frontier',    name: '黑雾边陲', startCol: 780, endCol: 840, palette: ['void', 'iron', 'cold'], description: '黑雾地表、虚空玄武岩与暗能信标' },
];

// ========== 噪声 ==========
class ValueNoise {
  private perm: number[];
  constructor(seed: number) {
    const rng = mulberry32(seed);
    this.perm = Array.from({ length: 512 }, (_, i) => i).sort(() => rng() - 0.5);
  }
  private fade(t: number) { return t * t * (3 - 2 * t); }
  private lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  /** 整数格点取值 0..1（用置换表做确定性随机） */
  private grid(ix: number, iy: number): number {
    return this.perm[(this.perm[ix & 255] + (iy & 255)) & 511] / 511;
  }
  /** 平滑值噪声 0..1 —— 相邻格点之间线性插值，保证地形/矿层成片而非逐格跳变 */
  noise2D(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = this.fade(x - xi), v = this.fade(y - yi);
    const a = this.lerp(this.grid(xi, yi), this.grid(xi + 1, yi), u);
    const b = this.lerp(this.grid(xi, yi + 1), this.grid(xi + 1, yi + 1), u);
    return this.lerp(a, b, v);
  }
  fbm(x: number, y: number, octaves = 4): number {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < octaves; i++) {
      v += a * this.noise2D(x * f, y * f);
      f *= 2; a *= 0.5;
    }
    return v;
  }
}
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ========== BlockId → 紧凑整数编码 ==========
const BLOCK_ID_LIST = Object.keys(BLOCKS);
const BLOCK_INDEX: Record<string, number> = {};
BLOCK_ID_LIST.forEach((id, i) => { BLOCK_INDEX[id] = i; });
export const BLOCK_COUNT = BLOCK_ID_LIST.length;

function bi(id: string): number {
  return BLOCK_INDEX[id] ?? 0;
}
export function biToBlock(idx: number): string {
  return BLOCK_ID_LIST[idx] ?? 'empty';
}

export interface RegionStructure {
  kind: 'hut' | 'camp' | 'crystal_altar' | 'rock_altar' | 'dungeon' | 'skeleton_altar';
  x: number; y: number; // 结构左上角 tile 坐标
  width: number; height: number;
  region: RegionId;
}

export interface TerrainData {
  width: number;
  height: number;
  tiles: Uint8Array;
  regionMap: Uint8Array;
  heightMap: Uint8Array;
  structures: RegionStructure[];
}

export function generateTerrain(seed = 20261116): TerrainData {
  const rng = mulberry32(seed);
  const n1 = new ValueNoise(seed);
  const n2 = new ValueNoise(seed + 999);
  const n3 = new ValueNoise(seed + 4242);

  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const tiles = new Uint8Array(width * height);
  const regionMap = new Uint8Array(width * height);
  const heightMap = new Uint8Array(width);

  // --- 地表高度 ---
  for (let x = 0; x < width; x++) {
    const regionIdx = regionIdxAt(x);
    const r = REGIONS[regionIdx];
    let base = 60, v = 0;

    if (r.id === 'wreck_zone') {
      // M1: 平缓丘陵 — 低频大起伏 + 少量细节，去掉二元跳变（原来会产生锯齿坑洼）
      v = Math.floor((n1.fbm(x * 0.018, 0, 2) - 0.5) * 16 + (n2.noise2D(x * 0.045, 0) - 0.5) * 5);
    } else if (r.id === 'crack_waste') {
      v = Math.floor((n1.noise2D(x * 0.03, 0) - 0.5) * 14);
    } else if (r.id === 'gobi_mine') {
      base = 52;
      v = Math.floor((n1.fbm(x * 0.02, 0, 2) - 0.5) * 22);
    } else if (r.id === 'silent_sea') {
      base = 75;
      v = Math.floor((n1.noise2D(x * 0.04, 0) - 0.5) * 4);
    } else if (r.id === 'beast_hive') {
      v = Math.floor((n1.fbm(x * 0.03, 0, 2) - 0.5) * 14);
    } else if (r.id === 'underground_valley') {
      v = Math.floor((n1.noise2D(x * 0.03, 0) - 0.5) * 8);
    } else if (r.id === 'frozen_waste') {
      base = 58;
      v = Math.floor((n1.fbm(x * 0.022, 0, 2) - 0.5) * 14);
    } else if (r.id === 'ash_volcano') {
      base = 58;
      v = Math.floor((n1.fbm(x * 0.02, 0, 2) - 0.5) * 18);
    } else if (r.id === 'rot_mire') {
      base = 66;
      v = Math.floor((n1.fbm(x * 0.03, 0, 2) - 0.5) * 8);
    } else if (r.id === 'ashen_court') {
      base = 62;
      v = Math.floor((n2.noise2D(x * 0.028, 0) - 0.5) * 10);
    } else if (r.id === 'storm_rift') {
      base = 60;
      v = Math.floor((n1.fbm(x * 0.025, 0, 2) - 0.5) * 16);
    } else if (r.id === 'ember_sanctum') {
      base = 55;
      v = Math.floor((n1.noise2D(x * 0.03, 0) - 0.5) * 6);
    } else if (r.id === 'crystal_highland') {
      base = 58;
      v = Math.floor((n1.fbm(x * 0.024, 0, 2) - 0.5) * 12);
    } else if (r.id === 'void_frontier') {
      base = 64;
      v = Math.floor((n2.noise2D(x * 0.026, 0) - 0.5) * 8);
    }

    heightMap[x] = Math.max(45, Math.min(95, base + v));
  }

  // M1: 低频山脊层 — 尖峰型噪声制造小山丘（周期约 90 格）
  for (let x = 0; x < width; x++) {
    const r = REGIONS[regionIdxAt(x)];
    const nv = n3.noise2D(x * 0.011, 13);
    const ridge = 1 - Math.abs(nv * 2 - 1);   // 0..1，尖锐山脊
    let add = Math.floor(ridge * ridge * 12);
    // 平原与谷地削弱山脊
    if (r.id === 'silent_sea') add = Math.floor(add * 0.25);
    else if (r.id === 'underground_valley') add = Math.floor(add * 0.4);
    else if (r.id === 'ash_volcano') add = Math.floor(add * 0.6);
    else if (r.id === 'frozen_waste') add = Math.floor(add * 0.5);
    else if (r.id === 'rot_mire') add = Math.floor(add * 0.15);
    else if (r.id === 'ashen_court') add = Math.floor(add * 0.35);
    else if (r.id === 'storm_rift') add = Math.floor(add * 0.75);
    else if (r.id === 'ember_sanctum') add = Math.floor(add * 0.1);
    else if (r.id === 'crystal_highland') add = Math.floor(add * 0.7);
    else if (r.id === 'void_frontier') add = Math.floor(add * 0.45);
    heightMap[x] = Math.max(45, Math.min(95, heightMap[x] + add));
  }

  // 出生点平台 — 前 16 列压平，随后 12 列过渡回自然地形
  const SPAWN_H = 62;
  for (let x = 0; x < 16; x++) heightMap[x] = SPAWN_H;
  for (let x = 16; x < 30; x++) {
    const t = (x - 16) / 14;
    heightMap[x] = Math.max(45, Math.min(95, Math.round(heightMap[x] * t + SPAWN_H * (1 - t))));
  }

  // 相邻列高差限幅 1 格 + 均值平滑 —— 地表连续可走，不会出现需要跳跃的台阶/断崖
  for (let pass = 0; pass < 3; pass++) {
    for (let x = 1; x < width; x++) {
      const d = heightMap[x] - heightMap[x - 1];
      if (d > 1) heightMap[x] = heightMap[x - 1] + 1;
      else if (d < -1) heightMap[x] = heightMap[x - 1] - 1;
    }
    for (let x = width - 2; x >= 0; x--) {
      const d = heightMap[x] - heightMap[x + 1];
      if (d > 1) heightMap[x] = heightMap[x + 1] + 1;
      else if (d < -1) heightMap[x] = heightMap[x + 1] - 1;
    }
    for (let x = 1; x < width - 1; x++) {
      heightMap[x] = Math.round((heightMap[x - 1] + heightMap[x] * 2 + heightMap[x + 1]) / 4);
    }
  }

  // 缓坡台地 — 用连续斜坡代替断崖，形成可攀爬的地貌层次
  const cliffRng = mulberry32(seed + 777);
  for (let x = 60; x < width - 40; ) {
    const total = 4 + Math.floor(cliffRng() * 4);       // 总高差 4~7 格
    const dir = cliffRng() > 0.5 ? 1 : -1;              // 抬升 / 下降
    const w = 8 + Math.floor(cliffRng() * 6);           // 斜坡宽度 8~13 格（每格 ≤1 格）
    for (let i = 0; i < w; i++) {
      const xx = x + i;
      if (xx >= width) break;
      const k = i / w;
      heightMap[xx] = Math.max(45, Math.min(95, heightMap[xx] + Math.round(dir * total * k)));
    }
    x += 70 + Math.floor(cliffRng() * 60);
  }

  // 熔渣火山：中段隆起成火山锥（宽而缓，随后限幅保证每列 ≤1 格可攀爬）
  for (let x = 424; x <= 474; x++) {
    const k = Math.abs((x - 449) / 25);       // 0 = 锥顶, 1 = 山脚
    const cone = Math.round(Math.max(0, 1 - k) * 16);
    heightMap[x] = Math.max(45, Math.min(95, heightMap[x] + cone));
  }

  // 最终再限幅一次，确保任何位置落差都不超过 2 格（可跳过）
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 1; x < width; x++) {
      const d = heightMap[x] - heightMap[x - 1];
      if (d > 1) heightMap[x] = heightMap[x - 1] + 1;
      else if (d < -1) heightMap[x] = heightMap[x - 1] - 1;
    }
    for (let x = width - 2; x >= 0; x--) {
      const d = heightMap[x] - heightMap[x + 1];
      if (d > 1) heightMap[x] = heightMap[x + 1] + 1;
      else if (d < -1) heightMap[x] = heightMap[x + 1] - 1;
    }
  }

  // --- 填充 ---
  for (let x = 0; x < width; x++) {
    const ri = regionIdxAt(x);
    const r = REGIONS[ri];
    const sy = heightMap[x];

    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      regionMap[idx] = ri;
      tiles[idx] = bi('empty');
      if (y < sy) continue;

      if (y === sy) {
        tiles[idx] = surfaceBlock(r.id, x, y, n1, n2, rng);
        // 残骸带：地表上方点缀断口火焰（非固体装饰，不影响行走）
        if (r.id === 'wreck_zone' && y - 1 >= 0 && n1.noise2D(x * 0.15, y * 0.15) > 0.82) {
          tiles[(sy - 1) * width + x] = bi('fire_crack');
        }
      } else if (y < sy + 20) {
        tiles[idx] = shallowBlock(r.id, x, y, n1, n2, n3, rng);
      } else if (y < sy + 55) {
        tiles[idx] = midBlock(r.id, x, y, n1, n2, n3, rng);
      } else {
        tiles[idx] = deepBlock(r.id, x, y, n1, n2, n3, rng);
      }
    }
  }

  // 熔渣火山：山脚岩浆湖（湖面 3 格深，可游泳穿越；湖底仍是实心岩层）
  for (let x = 446; x <= 458; x++) {
    const sy = heightMap[x];
    for (let y = sy; y < Math.min(height, sy + 3); y++) {
      tiles[y * width + x] = bi('magma_lava');
    }
  }

  // 腐蚀沼泽：两片毒沼水洼（同样 3 格深，可游泳）
  for (const [a, b] of [[492, 502], [518, 530]] as const) {
    for (let x = a; x <= b; x++) {
      const sy = heightMap[x];
      for (let y = sy; y < Math.min(height, sy + 3); y++) {
        tiles[y * width + x] = bi('murk_water');
      }
    }
  }

  carveStructures(tiles, heightMap, rng);
  buildLandmarks(tiles, heightMap);
  const structures = buildStructures(tiles, heightMap, rng);

  // 最终保险：地表必须是实心方块或液体，杜绝任何结构/装饰留下让玩家掉下去的破洞
  for (let x = 0; x < width; x++) {
    const sy = heightMap[x];
    if (sy <= 0 || sy >= height) continue;
    const id = biToBlock(tiles[sy * width + x]);
    if (id === 'empty' || (!isSolid(id) && !isLiquid(id))) {
      tiles[sy * width + x] = bi('cracked_ground');
    }
  }

  return { width, height, tiles, regionMap, heightMap, structures };
}

function regionIdxAt(x: number): number {
  for (let i = 0; i < REGIONS.length; i++) {
    if (x >= REGIONS[i].startCol && x < REGIONS[i].endCol) return i;
  }
  return 0;
}

function surfaceBlock(r: RegionId, x: number, y: number, n1: ValueNoise, n2: ValueNoise, _rng: () => number): number {
  switch (r) {
    case 'wreck_zone':
      // 断口火焰改为「地表上方」的装饰（见填充循环），地表本身必须是实心方块，
      // 否则会出现 1 格破洞让玩家掉进地下
      if (n2.noise2D(x * 0.1, y * 0.1) > 0.6) return bi('wreck_hull');
      return bi('wreck_scrap');
    case 'crack_waste':
      if (n1.noise2D(x * 0.2, y * 0.2) > 0.7) return bi('wind_rock');
      return bi('cracked_ground');
    case 'gobi_mine': return bi('desert_ground');
    case 'silent_sea': return bi('liquid_metal'); // 液态金属海面，可游泳
    case 'beast_hive':
      if (n1.noise2D(x * 0.18, y * 0.18) > 0.7) return bi('chitin_hive');
      return bi('cracked_ground');
    case 'underground_valley':
      if (y < 70) return bi('rebel_brick');
      return bi('cracked_ground');
    case 'frozen_waste':
      if (n2.noise2D(x * 0.12, y * 0.12) > 0.72) return bi('ice_layer');
      return bi('frost_snow');
    case 'ash_volcano':
      if (n2.noise2D(x * 0.1, y * 0.1) > 0.82) return bi('basalt');
      return bi('ash_ground');
    case 'rot_mire':
      if (n2.noise2D(x * 0.12, y * 0.12) > 0.8) return bi('rot_peat');
      return bi('swamp_mud');
    case 'ashen_court':
      if (n2.noise2D(x * 0.11, y * 0.11) > 0.78) return bi('court_rubble');
      return bi('court_tile');
    case 'storm_rift':
      if (n2.noise2D(x * 0.12, y * 0.12) > 0.72) return bi('charged_rock');
      return bi('storm_scorch');
    case 'ember_sanctum':
      if (n2.noise2D(x * 0.1, y * 0.1) > 0.8) return bi('sanctum_bronze');
      return bi('sanctum_tile');
    case 'crystal_highland':
      if (n2.noise2D(x * 0.12, y * 0.12) > 0.76) return bi('prism_rock');
      return bi('crystal_crust');
    case 'void_frontier':
      if (n2.noise2D(x * 0.11, y * 0.11) > 0.74) return bi('void_crust');
      return bi('void_soil');
  }
}

function shallowBlock(r: RegionId, x: number, y: number, n1: ValueNoise, n2: ValueNoise, n3: ValueNoise, _rng: () => number): number {
  const noise = n1.noise2D(x * 0.08, y * 0.08);
  switch (r) {
    case 'wreck_zone':
      // 低频噪声 → 金属残片成片分布，避免逐格跳色造成"马赛克"观感
      if (noise > 0.80) return bi('wreck_scrap');
      if (n3.noise2D(x * 0.05, y * 0.05) > 0.62) return bi('wreck_hull');
      return bi('cracked_ground');
    case 'crack_waste':
      if (noise > 0.66) return bi('cracked_ground');
      if (noise < 0.22) return bi('surface_dust');
      return bi('wind_rock');
    case 'gobi_mine': return bi('desert_ground');
    case 'silent_sea':
      if (n2.noise2D(x * 0.1, y * 0.1) > 0.78 && n3.noise2D(x * 0.15, y * 0.15) > 0.5) return bi('metal_float');
      return bi('liquid_metal');
    case 'beast_hive':
      if (noise > 0.72) return bi('chitin_hive');
      if (n2.noise2D(x * 0.15, y * 0.15) > 0.85) return bi('bio_glow');
      return bi('cracked_ground');
    case 'underground_valley': return bi('cracked_ground');
    case 'frozen_waste':
      if (noise > 0.68) return bi('ice_layer');
      if (noise < 0.3) return bi('frost_snow');
      return bi('permafrost');
    case 'ash_volcano':
      if (noise > 0.78) return bi('obsidian');
      if (noise < 0.25) return bi('ash_ground');
      return bi('basalt');
    case 'rot_mire':
      if (noise > 0.72) return bi('rot_peat');
      if (noise < 0.3) return bi('rot_bone');
      return bi('swamp_mud');
    case 'ashen_court':
      if (noise > 0.76) return bi('court_brick');
      if (noise < 0.28) return bi('court_rubble');
      return bi('court_tile');
    case 'storm_rift':
      if (noise > 0.7) return bi('charged_rock');
      if (noise < 0.25) return bi('thunder_crystal');
      return bi('storm_scorch');
    case 'ember_sanctum':
      if (noise > 0.74) return bi('sanctum_bronze');
      return bi('sanctum_tile');
    case 'crystal_highland':
      if (noise > 0.72) return bi('prism_rock');
      if (noise < 0.26) return bi('geode');
      return bi('crystal_crust');
    case 'void_frontier':
      if (noise > 0.7) return bi('void_crust');
      if (noise < 0.24) return bi('void_basalt');
      return bi('void_soil');
  }
}

function midBlock(r: RegionId, x: number, y: number, _n1: ValueNoise, n2: ValueNoise, n3: ValueNoise, _rng: () => number): number {
  const oreNoise = n2.noise2D(x * 0.2, y * 0.2);
  if (r === 'silent_sea') return bi('ore_rock');

  if (r === 'underground_valley') {
    if (n3.noise2D(x * 0.12, y * 0.12) > 0.45) return bi('rebel_brick');
    if (oreNoise > 0.85) return bi('void_crystal');
    return bi('ore_rock');
  }

  if (r === 'frozen_waste') {
    if (n3.noise2D(x * 0.12, y * 0.12) > 0.84) return bi('crystal_glow');
    return bi('permafrost');
  }

  if (r === 'ash_volcano') {
    if (oreNoise > 0.82) return bi('ember_vein');
    if (oreNoise < 0.22) return bi('obsidian');
    return bi('basalt');
  }

  if (r === 'rot_mire') {
    if (n3.noise2D(x * 0.12, y * 0.12) > 0.86) return bi('spore_glow');
    if (oreNoise > 0.8) return bi('rot_peat');
    return bi('rot_bone');
  }

  if (r === 'ashen_court') {
    if (oreNoise > 0.85) return bi('court_brick');
    return bi('court_rubble');
  }

  if (r === 'storm_rift') {
    if (n3.noise2D(x * 0.14, y * 0.14) > 0.82) return bi('thunder_crystal');
    return bi('charged_rock');
  }

  if (r === 'ember_sanctum') {
    if (oreNoise > 0.82) return bi('sanctum_bronze');
    return bi('sanctum_stone');
  }

  if (r === 'crystal_highland') {
    if (n3.noise2D(x * 0.13, y * 0.13) > 0.8) return bi('geode');
    if (oreNoise > 0.72) return bi('prism_rock');
    return bi('crystal_crust');
  }

  if (r === 'void_frontier') {
    if (n3.noise2D(x * 0.13, y * 0.13) > 0.82) return bi('void_basalt');
    return bi('void_crust');
  }

  // 三层矿带
  if (y < 85) {
    if (oreNoise > 0.78) return bi('ore_copper');
  } else if (y < 100) {
    if (oreNoise > 0.75) return bi('ore_iron');
  } else if (y < 115) {
    if (oreNoise > 0.85) return bi('ore_gold');
  }
  return bi('ore_rock');
}

function deepBlock(r: RegionId, x: number, y: number, n1: ValueNoise, n2: ValueNoise, n3: ValueNoise, _rng: () => number): number {
  const crystalNoise = n2.noise2D(x * 0.15, y * 0.15);
  const voidNoise = n3.noise2D(x * 0.08, y * 0.08);
  const noise = n1.noise2D(x * 0.04, y * 0.04);

  if (r === 'underground_valley') {
    if (voidNoise > 0.7) return bi('void_barrier');
    if (crystalNoise > 0.8) return bi('void_crystal');
    return bi('deep_rock');
  }

  if (r === 'frozen_waste') {
    if (crystalNoise > 0.82) return bi('crystal_glow');
    return bi('frost_rock');
  }

  if (r === 'ash_volcano') {
    if (voidNoise > 0.84) return bi('ember_vein');
    return bi('deep_rock');
  }

  if (r === 'rot_mire') {
    if (voidNoise > 0.82) return bi('spore_glow');
    if (crystalNoise > 0.86) return bi('crystal_glow');
    return bi('fen_rock');
  }

  if (r === 'ashen_court') {
    if (crystalNoise > 0.88) return bi('crystal_glow');
    return bi('court_deep');
  }

  if (r === 'storm_rift') {
    if (voidNoise > 0.8) return bi('thunder_crystal');
    return bi('deep_rock');
  }

  if (r === 'ember_sanctum') {
    if (crystalNoise > 0.86) return bi('crystal_glow');
    return bi('sanctum_stone');
  }

  if (r === 'crystal_highland') {
    if (crystalNoise > 0.84) return bi('crystal_glow');
    return bi('prism_rock');
  }

  if (r === 'void_frontier') {
    if (voidNoise > 0.78) return bi('void_crystal');
    return bi('void_basalt');
  }

  if (crystalNoise > 0.88) return bi('crystal_glow');
  if (noise < 0.25) return bi('crystal_glow');
  return bi('deep_rock');
}

function carveStructures(tiles: Uint8Array, heightMap: Uint8Array, rng: () => number) {
  // 1. 洞穴空洞（数量随地图宽度扩展）
  const caveCount = Math.max(18, Math.floor(MAP_WIDTH / 26));
  for (let i = 0; i < caveCount; i++) {
    const rx = 30 + Math.floor(rng() * (MAP_WIDTH - 60));
    const ry = 85 + Math.floor(rng() * 60);
    const rad = 3 + Math.floor(rng() * 6);
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dy = -rad; dy <= rad; dy++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const x = rx + dx, y = ry + dy;
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
        // 洞穴顶部至少留 6 格地表厚度，避免地表破洞把玩家漏进地下
        if (y < heightMap[x] + 6) continue;
        tiles[y * MAP_WIDTH + x] = bi('empty');
      }
    }

    // 大框架: 洞穴底部埋 1~2 簇晶簇 —— 浅层生命晶簇、深层魔力晶簇
    // 开采后掉落对应水晶，配合 U 键永久提升上限，形成「探索 → 成长」闭环
    const nodeId = ry < 108 ? 'life_crystal_node' : 'mana_crystal_node';
    const clusters = 1 + Math.floor(rng() * 2);
    for (let c = 0; c < clusters; c++) {
      const ang = Math.PI * (0.2 + rng() * 0.6); // 偏下半圈，贴近洞底
      const dist = rad * (0.45 + rng() * 0.35);
      const nx = Math.round(rx + Math.cos(ang) * dist);
      const ny = Math.round(ry + Math.sin(ang) * dist);
      if (nx < 1 || nx >= MAP_WIDTH - 1 || ny < 1 || ny >= MAP_HEIGHT - 1) continue;
      if (tiles[ny * MAP_WIDTH + nx] !== bi('empty')) continue;
      tiles[ny * MAP_WIDTH + nx] = bi(nodeId);
    }
  }

  // 2. 地底幽谷：暗能量紫柱
  for (let x = 320; x < 355; x++) {
    const sy = heightMap[x];
    for (let y = sy + 55; y < sy + 70; y++) {
      if (y >= MAP_HEIGHT) break;
      tiles[y * MAP_WIDTH + x] = bi('void_barrier');
    }
  }

  // 3. 无声海：地表本身已是液态金属，不再额外垒 8 格高的金属墙（会挡路）

  // 4. 异兽巢穴：低矮蜂巢柱（1 格高，可正常跨越，不阻挡行走）
  for (let x = 250; x < 295; x += 3 + Math.floor(rng() * 3)) {
    const sy = heightMap[x];
    if (sy - 1 < 0) continue;
    tiles[(sy - 1) * MAP_WIDTH + x] = bi('chitin_hive');
  }

  // 5. 腐蚀沼泽：地表发光孢子（1 格高，可跨过）
  for (let x = 484; x < 536; x += 5 + Math.floor(rng() * 6)) {
    const sy = heightMap[x];
    if (sy - 1 < 0) continue;
    tiles[(sy - 1) * MAP_WIDTH + x] = bi('spore_glow');
  }

  // 6. 灰烬王庭：断裂石柱与王庭火盆（均 1 格高，可跨过）
  for (let x = 548; x < 594; x += 4 + Math.floor(rng() * 5)) {
    const sy = heightMap[x];
    if (sy - 1 < 0) continue;
    tiles[(sy - 1) * MAP_WIDTH + x] = rng() < 0.6 ? bi('court_column') : bi('court_brazier');
  }

  // 7. 雷鸣裂谷：导电尖峰（1 格高，可跨过）
  for (let x = 606; x < 654; x += 6 + Math.floor(rng() * 6)) {
    const sy = heightMap[x];
    if (sy - 1 < 0) continue;
    tiles[(sy - 1) * MAP_WIDTH + x] = bi('storm_spire');
  }

  // 8. 余烬圣所：长明圣火（非固体装饰，不阻挡行走）
  for (let x = 668; x < 712; x += 7 + Math.floor(rng() * 7)) {
    const sy = heightMap[x];
    if (sy - 1 < 0) continue;
    tiles[(sy - 1) * MAP_WIDTH + x] = bi('sanctum_flame');
  }

  // 9. 晶簇高原：棱晶簇（1 格高，可跨过）
  for (let x = 726; x < 774; x += 5 + Math.floor(rng() * 6)) {
    const sy = heightMap[x];
    if (sy - 1 < 0) continue;
    tiles[(sy - 1) * MAP_WIDTH + x] = bi('crystal_shard');
  }

  // 10. 黑雾边陲：暗能信标（非固体装饰，可穿行，作夜间路标）
  for (let x = 786; x < 834; x += 8 + Math.floor(rng() * 8)) {
    const sy = heightMap[x];
    if (sy - 1 < 0) continue;
    tiles[(sy - 1) * MAP_WIDTH + x] = bi('void_beacon');
  }
}

/**
 * 新区域地标：每区一座 1~3 格高的装饰性拱门 / 遗迹
 * 中间至少留 3 格通行宽度，柱体本身可跨过，不会把玩家挡在外面
 */
function buildLandmarks(tiles: Uint8Array, heightMap: Uint8Array) {
  const set = (tx: number, ty: number, id: string) => {
    if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return;
    tiles[ty * MAP_WIDTH + tx] = bi(id);
  };
  // 双柱拱门：两柱各 2 格高 + 顶端 1 格发光/材质点缀，中间 3 格可通行
  const arch = (cx: number, pillar: string, cap: string) => {
    for (const dx of [-2, 2]) {
      const x = cx + dx;
      const sy = heightMap[x];
      set(x, sy - 1, pillar);
      set(x, sy - 2, pillar);
      set(x, sy - 3, cap);
    }
  };
  arch(410, 'ice_layer', 'crystal_glow');        // 霜蚀冻原 · 冰晶拱门
  arch(462, 'basalt', 'ember_vein');             // 熔渣火山 · 玄武岩门
  arch(536, 'rot_bone', 'spore_glow');           // 腐蚀沼泽 · 枯骨拱门
  arch(588, 'court_column', 'court_brazier');    // 灰烬王庭 · 断柱门
  arch(645, 'charged_rock', 'thunder_crystal');  // 雷鸣裂谷 · 导电尖峰门
  arch(712, 'sanctum_bronze', 'sanctum_flame');  // 余烬圣所 · 圣火拱门
  arch(760, 'prism_rock', 'crystal_glow');       // 晶簇高原 · 棱晶拱门
  arch(820, 'void_crust', 'void_beacon');        // 黑雾边陲 · 黑雾门

  // 灰烬王庭 · 残王座：中央火盆仅 1 格高，可直接跨过
  const throneY = heightMap[588];
  set(588, throneY - 1, 'court_brazier');
}

export function regionNameAt(col: number): string {
  return REGIONS[regionIdxAt(col)].name;
}

export function regionIdAt(col: number): RegionId {
  return REGIONS[regionIdxAt(col)].id;
}

/**
 * 区块内结构生成：每个区块 1 个 NPC 小屋 / 据点
 * 小屋 = 4×3 内部空间 + rebel_brick 墙
 */
function buildStructures(tiles: Uint8Array, heightMap: Uint8Array, rng: () => number): RegionStructure[] {
  const structures: RegionStructure[] = [];

  // 每个区块各放一个小屋 / 营地（避开 underground_valley 的暗能量紫柱区）
  const hutPositions: { regionCol: [number, number]; kind: RegionStructure['kind']; name: RegionId }[] = [
    { regionCol: [30, 50],  kind: 'hut', name: 'wreck_zone' },
    { regionCol: [80, 100], kind: 'hut', name: 'crack_waste' },
    { regionCol: [140, 160], kind: 'hut', name: 'gobi_mine' },
    { regionCol: [200, 220], kind: 'camp', name: 'silent_sea' },
    { regionCol: [260, 280], kind: 'hut', name: 'beast_hive' },
    { regionCol: [305, 320], kind: 'camp', name: 'underground_valley' },
    { regionCol: [380, 400], kind: 'camp', name: 'frozen_waste' },
    { regionCol: [425, 442], kind: 'camp', name: 'ash_volcano' },
    { regionCol: [505, 514], kind: 'camp', name: 'rot_mire' },
    { regionCol: [560, 578], kind: 'camp', name: 'ashen_court' },
    { regionCol: [615, 632], kind: 'camp', name: 'storm_rift' },
    { regionCol: [675, 700], kind: 'camp', name: 'ember_sanctum' },
    { regionCol: [732, 752], kind: 'camp', name: 'crystal_highland' },
    { regionCol: [792, 812], kind: 'camp', name: 'void_frontier' },
  ];

  for (const hp of hutPositions) {
    // 选一个区块内的 col
    const col = hp.regionCol[0] + Math.floor(rng() * (hp.regionCol[1] - hp.regionCol[0]));
    const groundY = heightMap[col];
    const hutW = hp.kind === 'camp' ? 7 : 5;
    const hutH = hp.kind === 'camp' ? 4 : 3;
    const hutX = col - Math.floor(hutW / 2);
    const hutY = groundY - hutH;

    // 确保 hutX 范围合法
    if (hutX < 2 || hutX + hutW >= MAP_WIDTH - 2) continue;

    // 清出内部空间：按每一列自己的地表高度向上清，避免在坡地上削掉邻列地表
    for (let dx = 0; dx < hutW; dx++) {
      const tx = hutX + dx;
      if (tx < 0 || tx >= MAP_WIDTH) continue;
      const colY = heightMap[tx];
      for (let dy = 0; dy < hutH; dy++) {
        const ty = colY - hutH + dy;
        if (ty < 0 || ty >= MAP_HEIGHT) continue;
        tiles[ty * MAP_WIDTH + tx] = bi('empty');
      }
    }
    // 营地遗迹：不生成屋顶、围墙、地板或柱子 —— 保持地表完全开阔
    // （任何抬高/围挡都可能在坡地上形成挡路台阶，导致人物无法正常行走）

    structures.push({
      kind: hp.kind,
      x: hutX, y: hutY,
      width: hutW, height: hutH,
      region: hp.name,
    });

    // M20: wreck_zone 小屋内放流浪商人 NPC
    if (hp.name === 'wreck_zone') {
      const npcX = hutX + 1;
      const npcY = groundY - 1;
      if (npcX >= 0 && npcX < MAP_WIDTH && npcY >= 0 && npcY < MAP_HEIGHT) {
        tiles[npcY * MAP_WIDTH + npcX] = bi('merchant_npc');
      }
      // M21: 残骸试炼坛（小屋右侧）
      const wx = hutX + hutW + 3;
      if (wx >= 0 && wx < MAP_WIDTH && groundY - 1 >= 0) tiles[(groundY - 1) * MAP_WIDTH + wx] = bi('wreck_trial_altar');
    }
    // M21: 野兽试炼坛
    if (hp.name === 'beast_hive') {
      const bx = hutX + hutW + 3;
      if (bx >= 0 && bx < MAP_WIDTH && groundY - 1 >= 0) tiles[(groundY - 1) * MAP_WIDTH + bx] = bi('beast_trial_altar');
    }
    // M21: 虚空试炼坛（地底幽谷深层）
    if (hp.name === 'underground_valley') {
      const vx = hutX + 2;
      const vy = Math.min(MAP_HEIGHT - 10, groundY + 15);
      if (vx >= 0 && vx < MAP_WIDTH && vy >= 0 && vy < MAP_HEIGHT) {
        tiles[vy * MAP_WIDTH + vx] = bi('void_trial_altar');
      }
    }
  }

  // deep crystal altar（第二个 Boss 位置）
  for (let attempt = 0; attempt < 20; attempt++) {
    const cx = 310 + Math.floor(rng() * 40);
    const cy = 130 + Math.floor(rng() * 30);
    if (cx < 0 || cx >= MAP_WIDTH || cy < 0 || cy >= MAP_HEIGHT) continue;
    // 清出空间
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        if (dx * dx + dy * dy > 9) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
        if (tiles[ty * MAP_WIDTH + tx] !== bi('void_barrier')) {
          tiles[ty * MAP_WIDTH + tx] = bi('empty');
        }
      }
    }
    // 周围放 8 个 void_crystal 作为祭坛装饰
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const tx = cx + Math.round(Math.cos(angle) * 4);
      const ty = cy + Math.round(Math.sin(angle) * 4);
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
      tiles[ty * MAP_WIDTH + tx] = bi('void_crystal');
    }
    structures.push({
      kind: 'crystal_altar',
      x: cx - 3, y: cy - 3,
      width: 7, height: 7,
      region: 'underground_valley',
    });
    break;
  }

  // rock_altar（rock_titan 位置）— gobi_mine 深层
  for (let attempt = 0; attempt < 30; attempt++) {
    const cx = 135 + Math.floor(rng() * 30); // 135-165 col（gobi_mine 中央）
    const cy = 120 + Math.floor(rng() * 40); // 120-160 deep
    if (cx < 0 || cx >= MAP_WIDTH || cy < 0 || cy >= MAP_HEIGHT) continue;
    // 清出较大空间（比 crystal_altar 大一倍，泰坦需要更多场地）
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        if (dx * dx + dy * dy > 25) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
        tiles[ty * MAP_WIDTH + tx] = bi('empty');
      }
    }
    // 周围放 ore_rock 围圈 + 顶部 ore_gold 发光点
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const rad = 6;
      const tx = cx + Math.round(Math.cos(angle) * rad);
      const ty = cy + Math.round(Math.sin(angle) * rad);
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
      tiles[ty * MAP_WIDTH + tx] = bi('ore_rock');
    }
    // 顶部 4 个发光金矿
    tiles[(cy - 6) * MAP_WIDTH + cx] = bi('ore_gold');
    tiles[(cy - 5) * MAP_WIDTH + (cx - 2)] = bi('ore_gold');
    tiles[(cy - 5) * MAP_WIDTH + (cx + 2)] = bi('ore_gold');
    tiles[(cy - 4) * MAP_WIDTH + cx] = bi('ore_gold');
    structures.push({
      kind: 'rock_altar',
      x: cx - 6, y: cy - 6,
      width: 13, height: 13,
      region: 'gobi_mine',
    });
    break;
  }

  // 大框架: 地牢 — 地底幽谷深处的地下建筑（骷髅王门锁 + 守卫）
  {
    const DX = 316, DY = 108, DW = 34, DH = 16;
    const brick = bi('dungeon_brick');
    const door = bi('dungeon_door');
    // 2 格厚外壳，内部掏空
    for (let dy = 0; dy < DH; dy++) {
      for (let dx = 0; dx < DW; dx++) {
        const x = DX + dx, y = DY + dy;
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
        const edge = dx < 2 || dx >= DW - 2 || dy < 2 || dy >= DH - 2;
        tiles[y * MAP_WIDTH + x] = edge ? brick : bi('empty');
      }
    }
    // 内部陈设：宝箱（战利品由 main 初始化）+ 金矿点缀
    const chestSpots: [number, number][] = [
      [DX + 6, DY + DH - 3],
      [DX + DW - 8, DY + DH - 3],
    ];
    for (const [cx, cy] of chestSpots) {
      tiles[cy * MAP_WIDTH + cx] = bi('chest');
    }
    for (let i = 0; i < 6; i++) {
      const gx = DX + 4 + Math.floor(rng() * (DW - 8));
      const gy = DY + 2 + Math.floor(rng() * 3);
      tiles[gy * MAP_WIDTH + gx] = bi('ore_gold');
    }
    // 大框架: 地牢深处固定 2 簇水晶，作为深入探索的保底成长奖励
    tiles[(DY + 3) * MAP_WIDTH + (DX + 3)] = bi('life_crystal_node');
    tiles[(DY + DH - 4) * MAP_WIDTH + (DX + DW - 4)] = bi('mana_crystal_node');
    // 竖井：地表 → 地牢顶部，3 格宽（玩家 1.25 格宽，留出通行余量）
    const s0 = DX + Math.floor(DW / 2) - 1;
    const s1 = s0 + 1;
    const s2 = s0 + 2;
    const surfY = heightMap[s0];
    for (let y = Math.max(0, surfY); y <= DY + 1; y++) {
      tiles[y * MAP_WIDTH + (s0 - 1)] = brick;
      tiles[y * MAP_WIDTH + (s2 + 1)] = brick;
      tiles[y * MAP_WIDTH + s0] = bi('empty');
      tiles[y * MAP_WIDTH + s1] = bi('empty');
      tiles[y * MAP_WIDTH + s2] = bi('empty');
    }
    // 井口盖板：未击败骷髅王时用锁门封住地表，走路不会意外掉进竖井
    // （解锁时 unlockDungeon 会把所有 dungeon_door 变成空地，竖井才真正打开）
    for (const x of [s0, s1, s2]) {
      if (surfY >= 0 && surfY < MAP_HEIGHT) tiles[surfY * MAP_WIDTH + x] = door;
    }
    // 井底锁门：未击败骷髅王时不可破坏
    for (const x of [s0, s1, s2]) {
      for (let y = DY; y <= DY + 1; y++) {
        tiles[y * MAP_WIDTH + x] = door;
      }
    }
    // 井壁交错砖台：每 3 格一块，玩家可踩着跳回地表，不会被困在井底
    // 从井底向上铺设，但必须停在地表盖板以下（surfY + 2），不能盖住井口
    let ledgeSide = 0;
    for (let y = DY + 4; y >= surfY + 2; y -= 3) {
      const lx = ledgeSide % 2 === 0 ? s0 : s2;
      tiles[y * MAP_WIDTH + lx] = brick;
      ledgeSide++;
    }
    structures.push({
      kind: 'dungeon',
      x: DX, y: DY, width: DW, height: DH,
      region: 'underground_valley',
    });
    // 骷髅祭坛：井口右侧地表
    const altarX = s1 + 3;
    if (altarX < MAP_WIDTH && surfY - 1 >= 0) {
      tiles[(surfY - 1) * MAP_WIDTH + altarX] = bi('dungeon_altar');
      structures.push({
        kind: 'skeleton_altar',
        x: altarX, y: surfY - 1, width: 1, height: 1,
        region: 'underground_valley',
      });
    }
  }

  return structures;
}

/**
 * 旧存档地形迁移：把旧宽度存档按行拷贝进新地图的前 N 列
 * —— 保留玩家原有挖掘/建筑，右侧新扩展的列使用本次生成的地形
 */
export function importSavedColumns(data: TerrainData, savedTiles: Uint8Array, savedHeight: Uint8Array): boolean {
  const oldWidth = Math.floor(savedTiles.length / MAP_HEIGHT);
  if (oldWidth <= 0 || savedTiles.length % MAP_HEIGHT !== 0) return false;
  if (savedHeight.length !== oldWidth) return false;
  if (oldWidth > data.width) return false;
  if (oldWidth === data.width) {
    data.tiles = savedTiles;
    data.heightMap = savedHeight;
    return true;
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    data.tiles.set(savedTiles.subarray(y * oldWidth, (y + 1) * oldWidth), y * data.width);
  }
  data.heightMap.set(savedHeight);
  return true;
}

/**
 * 旧存档地图修补：拆除封闭小屋、加宽地牢竖井并加可攀爬砖台
 * 只应在旧存档首次载入时执行一次（save.mapPatch < 1），否则会误删玩家自建墙体
 */
export function patchSealedMap(data: TerrainData): number {
  const { width, height, tiles } = data;
  let changed = 0;
  const set = (tx: number, ty: number, id: string) => {
    if (tx < 0 || tx >= width || ty < 0 || ty >= height) return;
    const idx = ty * width + tx;
    const v = bi(id);
    if (tiles[idx] !== v) {
      tiles[idx] = v;
      changed++;
    }
  };

  const at = (tx: number, ty: number): string => {
    if (tx < 0 || tx >= width || ty < 0 || ty >= height) return 'empty';
    return BLOCK_ID_LIST[tiles[ty * width + tx]] ?? 'empty';
  };

  // 拆除旧版地表障碍：无声海的 8 格金属墙、异兽巢穴的高蜂巢柱（会挡路）
  for (let x = 180; x < 240; x++) {
    const sy = data.heightMap[x];
    for (let y = Math.max(0, sy - 8); y < sy; y++) {
      if (at(x, y) === 'liquid_metal') set(x, y, 'empty');
    }
    // 旧版把海面盖成了金属壳，这里还原为液态金属（可游泳）
    if (at(x, sy) === 'metal_float') set(x, sy, 'liquid_metal');
  }
  for (let x = 250; x < 295; x++) {
    const sy = data.heightMap[x];
    for (let y = Math.max(0, sy - 8); y < sy - 1; y++) {
      if (at(x, y) === 'chitin_hive') set(x, y, 'empty');
    }
  }

  // 封住地表破洞：旧版断口火焰等非固体方块会在地表留下 1 格洞，玩家会掉进地下
  for (let x = 0; x < width; x++) {
    const sy = data.heightMap[x];
    if (sy <= 0 || sy >= height) continue;
    const b = at(x, sy);
    if (b === 'empty' || (!isSolid(b) && !isLiquid(b))) {
      set(x, sy, 'cracked_ground');
    }
  }

  for (const s of data.structures) {
    if (s.kind === 'hut' || s.kind === 'camp') {
      // 拆屋顶与两侧墙，只保留地板（与新版生成一致）
      for (let dx = -1; dx <= s.width + 1; dx++) set(s.x + dx, s.y - 1, 'empty');
      for (let dy = 0; dy < s.height; dy++) {
        set(s.x - 1, s.y + dy, 'empty');
        set(s.x + s.width, s.y + dy, 'empty');
      }
    }

    if (s.kind === 'dungeon') {
      const DX = s.x, DY = s.y, DW = s.width;
      const s0 = DX + Math.floor(DW / 2) - 1;
      const s1 = s0 + 1, s2 = s0 + 2;
      const surfY = data.heightMap[s0];
      // 清理旧版修补堆到地表以上的砖块（会挡路）
      for (let y = Math.max(0, surfY - 3); y < surfY; y++) {
        for (const x of [s0 - 1, s0, s1, s2, s2 + 1]) {
          if (at(x, y) === 'dungeon_brick') set(x, y, 'empty');
        }
      }
      // 加宽为 3 格并重建两侧砖壁
      for (let y = Math.max(0, surfY); y <= DY + 1; y++) {
        set(s0 - 1, y, 'dungeon_brick');
        set(s2 + 1, y, 'dungeon_brick');
        set(s0, y, 'empty');
        set(s1, y, 'empty');
        set(s2, y, 'empty');
      }
      for (let y = Math.max(0, surfY - 3); y < surfY; y++) {
        if (at(s0 - 1, y) === 'dungeon_brick') set(s0 - 1, y, 'empty');
        if (at(s2 + 1, y) === 'dungeon_brick') set(s2 + 1, y, 'empty');
      }
      // 井底锁门
      for (const x of [s0, s1, s2]) {
        for (let y = DY; y <= DY + 1; y++) set(x, y, 'dungeon_door');
      }
      // 交错砖台：每 3 格一块，保证能跳回地表（不覆盖井口）
      let side = 0;
      for (let y = DY + 4; y >= surfY + 2; y -= 3) {
        set(side % 2 === 0 ? s0 : s2, y, 'dungeon_brick');
        side++;
      }
    }
  }
  return changed;
}
