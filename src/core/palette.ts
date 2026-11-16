/**
 * 烬海纪元 · 32 色调色板（锁定）
 * 方案约定：锈橙／铁灰／余烬金／骨白 —— 冷青／幽紫只留给能量和生物荧光
 * AI 管线第一审即校验所有 asset 是否落在这 32 色内
 */
export interface PaletteEntry {
  id: string;
  hex: string;
  group: 'rust' | 'iron' | 'ember' | 'bone' | 'cold' | 'void' | 'bg' | 'ui';
  usage: string;
}

export const PALETTE: PaletteEntry[] = [
  // === 锈橙组（主色）===
  { id: 'rust01', hex: '#ffb28a', group: 'rust', usage: '残骸铁锈高光' },
  { id: 'rust02', hex: '#e88a4a', group: 'rust', usage: '地表锈橙主色' },
  { id: 'rust03', hex: '#c4603a', group: 'rust', usage: '岩石中间调' },
  { id: 'rust04', hex: '#943a2a', group: 'rust', usage: '岩缝阴影' },
  { id: 'rust05', hex: '#5a2018', group: 'rust', usage: '深岩阴影' },

  // === 铁灰组（主色）===
  { id: 'iron01', hex: '#c8ccd0', group: 'iron', usage: '金属高光' },
  { id: 'iron02', hex: '#8a9096', group: 'iron', usage: '金属主色' },
  { id: 'iron03', hex: '#5a6066', group: 'iron', usage: '金属阴影' },
  { id: 'iron04', hex: '#3a3f44', group: 'iron', usage: '深铁阴影' },
  { id: 'iron05', hex: '#1f2226', group: 'iron', usage: '极深阴影' },

  // === 余烬金组（主色）===
  { id: 'ember01', hex: '#fff4c2', group: 'ember', usage: '火焰核心' },
  { id: 'ember02', hex: '#ffc85a', group: 'ember', usage: '火焰高光' },
  { id: 'ember03', hex: '#e89430', group: 'ember', usage: '余烬主色' },
  { id: 'ember04', hex: '#a85a18', group: 'ember', usage: '余烬阴影' },
  { id: 'ember05', hex: '#5a3010', group: 'ember', usage: '余烬暗部' },

  // === 骨白组（主色）===
  { id: 'bone01', hex: '#fff8e8', group: 'bone', usage: '骨白高光' },
  { id: 'bone02', hex: '#e8dcc0', group: 'bone', usage: '骨白主色' },
  { id: 'bone03', hex: '#b8a888', group: 'bone', usage: '骨白阴影' },
  { id: 'bone04', hex: '#706050', group: 'bone', usage: '骨白深阴影' },
  { id: 'bone05', hex: '#3a3028', group: 'bone', usage: '骨白极暗' },

  // === 冷青组（仅液态金属）===
  { id: 'cold01', hex: '#d4f4ff', group: 'cold', usage: '液态金属高光' },
  { id: 'cold02', hex: '#7ad4e8', group: 'cold', usage: '液态金属主色' },
  { id: 'cold03', hex: '#3a94a8', group: 'cold', usage: '液态金属阴影' },
  { id: 'cold04', hex: '#185868', group: 'cold', usage: '液态金属深暗' },

  // === 幽紫组（仅生物荧光/暗能量）===
  { id: 'void01', hex: '#f8d4ff', group: 'void', usage: '幽蓝荧光高光' },
  { id: 'void02', hex: '#a85ae8', group: 'void', usage: '幽紫主色' },
  { id: 'void03', hex: '#6018a8', group: 'void', usage: '幽紫阴影' },
  { id: 'void04', hex: '#2a0858', group: 'void', usage: '暗能量深暗' },

  // === 背景 / UI ===
  { id: 'bg01', hex: '#0a0a0a', group: 'bg', usage: '深空' },
  { id: 'bg02', hex: '#1a1410', group: 'bg', usage: '地面背景' },
  { id: 'ui01', hex: '#e8c547', group: 'ui', usage: 'HUD 主色' },
  { id: 'ui02', hex: '#ff7a3a', group: 'ui', usage: '警告/强调' },
];

/** 快速查找：id → hex */
export const PALETTE_MAP = new Map<string, string>(PALETTE.map(p => [p.id, p.hex]));

/** 校验颜色是否在调色板内（返回最接近色的 id） */
export function nearestPaletteId(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let best = PALETTE[0];
  let bestDist = Infinity;
  for (const p of PALETTE) {
    const pr = parseInt(p.hex.slice(1, 3), 16);
    const pg = parseInt(p.hex.slice(3, 5), 16);
    const pb = parseInt(p.hex.slice(5, 7), 16);
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best.id;
}
