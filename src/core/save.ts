/**
 * 烬海纪元 · localStorage 存档系统
 * ====================
 * 保存：世界地形（tiles/heightMap）、玩家位置与 HP、背包、躯壳、饰品、护甲、宝箱、时间
 * 自动加载：启动时若存在存档则恢复；Ctrl+S 手动保存；Ctrl+L 重载存档
 * 每 90 秒自动保存一次
 */
import { ItemStack } from './inventory.js';
import { ChestData } from './chest.js';
import { CropSave } from './farming.js';

const SAVE_KEY = 'ember_sea_save_v1';
export const SAVE_VERSION = 1;
export const AUTOSAVE_INTERVAL = 90; // 秒

export interface SaveData {
  version: number;
  timestamp: number;
  // 世界
  tiles: string;       // base64(Uint8Array)
  heightMap: string;   // base64(Uint8Array)
  // 玩家
  player: { x: number; y: number; hp: number };
  // 背包
  inv: { hotbar: ItemStack[]; slots: ItemStack[]; selectedHotbar: number };
  // 躯壳
  shellIdx: number;
  shellHp: number[];
  // 饰品
  accessory: { ids: string[]; slotIndex: number };
  // 护甲
  armor: { head: string | null; chest: string | null; legs: string | null };
  // 宝箱
  chests: ChestData[];
  // 时间
  timeOfDay: number;
  // M30: 永久成长（生命/魔力水晶使用次数）
  growth?: { hpUses: number; mpUses: number };
  // M31: 作物
  crops?: CropSave[];
}

/** Uint8Array → base64（分块避免参数过多爆栈） */
export function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** base64 → Uint8Array */
export function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** 写入存档（返回是否成功） */
export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('[存档] 写入失败', e);
    return false;
  }
}

/** 读取存档（无存档/解析失败返回 null） */
export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch (e) {
    console.warn('[存档] 读取失败', e);
    return null;
  }
}

export function hasSave(): boolean {
  return readSave() !== null;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

/** 存档时间格式化 */
export function formatSaveTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
