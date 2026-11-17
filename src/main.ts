/**
 * 烬海纪元 · 主入口
 * M0-M3: 工程骨架 + 破坏 + 背包 + 放置 + 工具 + 合成 + 敌人 AI + 躯壳切换
 */
import './style.css';
import { generateTerrain, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, biToBlock, regionNameAt, regionIdAt } from './core/terrain.js';
import { BLOCKS, isSolid } from './core/blocks.js';
import { createCamera, follow, shake, updateShake, getShakeOffset } from './core/camera.js';
import { createPlayer, updatePlayer, placePlayerOnGround, playerOverlapsTile, Player } from './core/player.js';
import { Renderer } from './core/renderer.js';
import { createBreakState, startBreaking, stopBreaking, updateBreaking, updateParticles, BreakState } from './core/break.js';
import { Inventory } from './core/inventory.js';
import { TOOLS } from './core/tools.js';
import { WorkbenchUI } from './core/workbench.js';
import { Enemy, updateEnemy, hitEnemy, trySpawnEnemy } from './core/enemies.js';
import { createEnemy } from './core/enemies.js';
import { ShellManager, SHELLS } from './core/shells.js';
import { VoidEngine } from './core/voiding.js';
import { WorldEventManager } from './core/events.js';
import { createBoss, updateBoss, updateProjectiles, hitBoss, findNearestVoidBarrier, Boss, BossProjectile, bossHalfW, bossHalfH, BOSS_DEFS } from './core/bosses.js';
import { Companion, createCivilian, recruitCompanion, updateCompanion } from './core/companions.js';
import { sfx } from './core/sfx.js';
import { AccessoryManager, ACCESSORY_DEFS } from './core/accessories.js';
import { QuestManager, QuestState } from './core/tasks.js';
import { AchievementManager, AchievementState } from './core/achievements.js';
import { NPC_DEFS, SELL_PRICES, ShopItem } from './core/npcs.js';
import { TrialManager, TRIAL_DEFS } from './core/trial.js';
import { POTION_DEFS, aggregateBuffs } from './core/potions.js';
import { MOUNT_DEFS } from './core/mounts.js';
import { rollCatch, rollChestLoot, FISH_DEFS } from './core/fishing.js';
import { PET_DEFS, Pet, createPet, updatePet } from './core/pets.js';
import { ArmorManager, ARMOR_DEFS, ARMOR_SETS, ArmorSlot } from './core/armor.js';
import { ChestManager, ChestData, addToSlots } from './core/chest.js';
import { SmeltManager, SMELT_RECIPES, canSmelt } from './core/smelting.js';
import { SaveData, writeSave, readSave, clearSave, formatSaveTime, u8ToB64, b64ToU8, SAVE_VERSION, AUTOSAVE_INTERVAL } from './core/save.js';
import { GrowthManager, LIFE_CRYSTAL_MAX_USES, MANA_CRYSTAL_MAX_USES, LIFE_CRYSTAL_GAIN, MANA_CRYSTAL_GAIN } from './core/growth.js';
import { ProgressionManager } from './core/progression.js';
import { StoryManager, PROLOGUE, STAGE_STORY, REGION_STORY, BOSS_STORY, NPC_STORY } from './core/story.js';
import { CropManager } from './core/farming.js';
import { SettlementManager, SETTLER_DEFS, SETTLE_INTERVAL } from './core/settlement.js';

// ========== DOM ==========
const loading = document.getElementById('loading')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudPos = document.getElementById('hud-pos')!;
const hudBlock = document.getElementById('hud-block')!;
const hudRegion = document.getElementById('hud-region')!;
const storyEl = document.getElementById('story')!;
const storyTitleEl = document.getElementById('story-title')!;
const storyLinesEl = document.getElementById('story-lines')!;

// ========== 状态 ==========
let terrain = generateTerrain(20261116);
const renderer = new Renderer(canvas);
let cam = createCamera(window.innerWidth, window.innerHeight);
let player = createPlayer();
let breakState: BreakState = createBreakState();
const inv = new Inventory();

// 大框架: 阶段进度
const prog = new ProgressionManager();

// 剧情系统
const story = new StoryManager();
let lastStoryId = '';

interface PlayerExt extends Player {
  toolName: string;
  canDoubleJump: boolean;
  usedSecondJump: boolean;
  hurtEnemies: Set<number>; // 锈躯壳灼烧反击：本次被击中的敌人 id
}
const px = player as PlayerExt;
px.toolName = 'hand_pickaxe';
px.canDoubleJump = false;
px.usedSecondJump = false;
px.hurtEnemies = new Set();

// 工作台
const wb = new WorkbenchUI(inv, {
  onOpen: () => { inputBlocked = true; },
  onClose: () => { inputBlocked = false; },
  onCraftSuccess: (r) => {
    tasks.onCraft(r.resultBlockId, r.resultCount);
    prog.onCraft(); // 大框架: 阶段进度
    // M19: 初探者成就 — 合成工具
    if (TOOLS[r.resultBlockId]) ach.addProgress('first_tool', 1);
  },
});

// 躯壳
const shellMgr = new ShellManager();

// 黑雾同化系统
const voidEngine = new VoidEngine();

// 敌人系统
const enemies: Enemy[] = [];
let spawnTimer = 0;
let playerInvulnerable = 0;
let playerKnockback = { vx: 0, vy: 0 };
let swingCd = 0; // M16: 玩家攻击冷却
let meleeAnim = 0;            // 近战挥砍动作剩余时间
const MELEE_ANIM_DUR = 0.32;
let rangedAnim = 0;           // 远程射击/拉弓动作剩余时间
const RANGED_ANIM_DUR = 0.22;
let wasOnGround = false; // M16: 上一帧是否在地面（检测落地瞬间）
let lastRegion = '';     // M17: 玩家上一帧所在区块（检测区块变化）
let achCheckTimer = 0;   // M19: 收藏家成就检查间隔

// Boss 系统
const bosses: Boss[] = [];
const bossProjectiles: BossProjectile[] = [];
// M18: 玩家远程弹丸
const playerProjectiles: { x: number; y: number; vx: number; vy: number; damage: number; piercing: boolean; color: string; size: number; life: number; hitIds: Set<number> }[] = [];
let bossSpawnCooldown = 0;

// M14: 夜间 Boss 自动刷新
let nightBossSpawnCooldown = 8;
const nightBossSpawnedRegions = new Set<string>(); // 本夜间已刷过 Boss 的区块
let lastNightState = false; // 上一帧是否是夜间

// AI 队友系统
const companions: Companion[] = [];
interface CompProj { x: number; y: number; vx: number; vy: number; damage: number; ownerId: number; life: number; maxLife: number; }
const compProjs: CompProj[] = [];
let companionsInitialized = false;

// M11: 饰品系统
const acc = new AccessoryManager();
let dashKeyHeld = false;

// M26: 护甲系统
const armorMgr = new ArmorManager();

// M27: 宝箱储物
const chestMgr = new ChestManager();
let openChest: ChestData | null = null;
let chestPanel: HTMLDivElement | null = null;

// M28: 熔炉冶炼
const smeltMgr = new SmeltManager();
let furnacePanel: HTMLDivElement | null = null;
let furnaceProgressEl: HTMLDivElement | null = null;
let furnaceStatusEl: HTMLDivElement | null = null;

// M29: 自动保存计时
let autosaveTimer = 0;
let freshMode = false; // ?fresh=1 预览模式：不自动覆盖存档

// M30: 永久成长
const growth = new GrowthManager();

// M31: 种植
const cropMgr = new CropManager();

// M32: NPC 城镇入驻
const settlementMgr = new SettlementManager();
const settlerShops: Record<string, ShopItem[]> = {};

// M15: 世界事件系统
const ev = new WorldEventManager();
const eventTypesSeen = new Set<string>(); // M19: 事件幸存者成就
ev.onEventStart = (e) => {
  console.log(`[事件] ✨ ${e.emoji} ${e.name} 开始！${e.desc}`);
  shake(cam, 5);
  sfx.bossSummon(); // 复用（事件触发也有紧张感）
  // M19: 事件幸存者成就
  eventTypesSeen.add(e.type);
  ach.setProgress('survive_3_events', eventTypesSeen.size);
};
ev.onEventEnd = (e) => {
  console.log(`[事件] 💨 ${e.name} 结束`);
};

// M17: 任务系统
const tasks = new QuestManager();
let questPopup: { text: string; timer: number } | null = null;
tasks.onComplete = (q: QuestState) => {
  questPopup = { text: `✅ 任务完成：${q.def.name}`, timer: 3 };
  sfx.pickup();
  // 自动领取奖励
  const rewards = tasks.claimReward(q);
  for (const r of rewards) inv.add(r.blockId, r.count);
};

// M19: 成就系统
const ach = new AchievementManager();
let achPopup: { text: string; timer: number } | null = null;
ach.onUnlock = (a: AchievementState) => {
  achPopup = { text: `🏆 成就解锁：${a.def.emoji} ${a.def.name}`, timer: 4 };
  sfx.bossSummon(); // 复用（成就感音效）
  console.log(`[成就] 🏆 ${a.def.emoji} ${a.def.name} — ${a.def.desc}`);
  // 应用永久 buff（最大 HP 立即生效）
  if (a.def.reward.maxHpBonus) {
    player.maxHp += a.def.reward.maxHpBonus;
    player.hp = Math.min(player.maxHp, player.hp + a.def.reward.maxHpBonus);
  }
  // 烬海之王检测（其他 9 个全解锁）
  const othersUnlocked = ach.achievements.filter(x => x.def.id !== 'all_achievements').every(x => x.unlocked);
  if (othersUnlocked) ach.addProgress('all_achievements', 1);
};

// M20: 商店系统
let shopOpenLocal = false;
const merchantShop: ShopItem[] = NPC_DEFS.merchant.shop.map(s => ({ ...s }));
// M32: 当前打开的商店（流浪商人 / 定居者）
let activeShop: ShopItem[] = merchantShop;
let activeShopName = '流浪商人';
let shopMsg = '';
let shopMsgTimer = 0;

// M21: 试炼场系统
const trial = new TrialManager();
let trialMsg = '';
let trialMsgTimer = 0;
trial.onComplete = () => {
  if (!trial.currentTrial) return;
  const r = trial.currentTrial.reward;
  for (const item of r) inv.add(item.blockId, item.count);
  trialMsg = `🎉 试炼通关！获得 ${r.map(x => `${BLOCKS[x.blockId]?.name ?? x.blockId}×${x.count}`).join(', ')}`;
  trialMsgTimer = 5;
  shake(cam, 6);
  sfx.bossDie();
};
trial.onFail = () => {
  trialMsg = '💀 试炼失败...再来一次吧';
  trialMsgTimer = 4;
  sfx.error();
};
trial.onWaveStart = (idx, total) => {
  trialMsg = `⚔ 第 ${idx + 1}/${total} 波来袭！`;
  trialMsgTimer = 2.5;
  sfx.bossSummon();
};

// M20: 检测玩家附近 3 tile 内是否有 merchant_npc
function isNearMerchant(): boolean {
  const pc = Math.floor(player.x / TILE_SIZE);
  const pr = Math.floor(player.y / TILE_SIZE);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = pc + dx, ty = pr + dy;
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
      if (biToBlock(terrain.tiles[ty * MAP_WIDTH + tx]) === 'merchant_npc') return true;
    }
  }
  return false;
}

// M32: 检测玩家附近 3 tile 内的定居者，返回 NPC 类型 id
function nearbySettlerId(): string | null {
  const pc = Math.floor(player.x / TILE_SIZE);
  const pr = Math.floor(player.y / TILE_SIZE);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = pc + dx, ty = pr + dy;
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
      const id = SettlementManager.typeByBlock(biToBlock(terrain.tiles[ty * MAP_WIDTH + tx]));
      if (id) return id;
    }
  }
  return null;
}

// M20: 购买商品
function buyItem(index: number) {
  const item = activeShop[index];
  if (!item) return;
  if (item.stock === 0) { shopMsg = '已售罄'; shopMsgTimer = 2; return; }
  const gold = inv.count('gold_coin');
  if (gold < item.buyPrice) { shopMsg = `金币不足（需要 ${item.buyPrice}）`; shopMsgTimer = 2; sfx.error(); return; }
  inv.consume('gold_coin', item.buyPrice);
  inv.add(item.blockId, 1);
  if (item.stock > 0) item.stock--;
  shopMsg = `购买成功：${BLOCKS[item.blockId]?.name ?? item.blockId}`;
  shopMsgTimer = 2;
  sfx.pickup();
}

// M20: 出售选中快捷栏物品
function sellSelected() {
  const sel = inv.getSelected();
  if (!sel.blockId || sel.count <= 0) { shopMsg = '选中格为空'; shopMsgTimer = 2; return; }
  const price = SELL_PRICES[sel.blockId];
  if (!price) { shopMsg = '该物品无法出售'; shopMsgTimer = 2; return; }
  inv.consume(sel.blockId, 1);
  inv.add('gold_coin', price);
  shopMsg = `出售 ${BLOCKS[sel.blockId]?.name ?? sel.blockId} +${price} 金币`;
  shopMsgTimer = 2;
  sfx.pickup();
}

// M21: 检测玩家附近的试炼坛，返回试炼 id 或 null
function getNearbyTrial(): string | null {
  const pc = Math.floor(player.x / TILE_SIZE);
  const pr = Math.floor(player.y / TILE_SIZE);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = pc + dx, ty = pr + dy;
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
      const bid = biToBlock(terrain.tiles[ty * MAP_WIDTH + tx]);
      if (bid === 'wreck_trial_altar') return 'wreck_trial';
      if (bid === 'void_trial_altar') return 'void_trial';
      if (bid === 'beast_trial_altar') return 'beast_trial';
    }
  }
  return null;
}

// M21: 激活试炼
function activateTrial(trialId: string) {
  const def = TRIAL_DEFS[trialId];
  if (!def) return;
  // 检查消耗
  for (const c of def.cost) {
    if (inv.count(c.blockId) < c.count) {
      trialMsg = `材料不足：需要 ${BLOCKS[c.blockId]?.name ?? c.blockId} ×${c.count}`;
      trialMsgTimer = 3; sfx.error(); return;
    }
  }
  // 消耗材料
  for (const c of def.cost) inv.consume(c.blockId, c.count);
  trial.start(def);
  trialMsg = `🔥 ${def.emoji} ${def.name} 开始！`;
  trialMsgTimer = 3;
  shake(cam, 4);
  sfx.bossSummon();
}

// M21: 生成一波试炼敌人
function spawnTrialWave() {
  if (!trial.active || !trial.currentTrial || !trial.waveStarted) return;
  const wave = trial.currentTrial.waves[trial.waveIndex];
  const cx = player.x, cy = player.y;
  let enemyCount = 0, bossCount = 0;
  // 生成敌人
  for (const defType of wave.enemies) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 100;
    const ex = cx + Math.cos(angle) * dist;
    const ey = cy - 60; // 从上方生成
    const e = createEnemy(defType, ex, ey);
    enemies.push(e);
    enemyCount++;
  }
  // 生成 Boss
  if (wave.boss) {
    if (BOSS_DEFS[wave.boss]) {
      const b = createBoss(wave.boss, cx, cy - 100);
      bosses.push(b);
      bossCount++;
    }
  }
  trial.setWaveCounts(enemyCount, bossCount);
}

// M22: 使用选中快捷栏的药水
function usePotion() {
  const sel = inv.getSelected();
  if (!sel.blockId || sel.count <= 0) return;
  const potion = POTION_DEFS[sel.blockId];
  if (!potion) return;
  inv.consume(sel.blockId, 1);
  sfx.pickup();
  if (potion.buffType === 'heal') {
    player.hp = Math.min(player.maxHp, player.hp + potion.value);
    spawnDmgText(player.x, player.y - player.height, potion.value, '#60ff60', 0, 1);
    return;
  }
  const existing = player.activeBuffs.find(b => b.type === potion.buffType);
  if (existing) {
    existing.value = Math.max(existing.value, potion.value);
    existing.remaining = Math.max(existing.remaining, potion.duration);
  } else {
    player.activeBuffs.push({ type: potion.buffType, value: potion.value, remaining: potion.duration });
  }
}

// M23: 上下马
function toggleMount() {
  if (player.mounted) {
    // 下马
    player.mounted = false;
    player.mountId = null;
    return;
  }
  // 上马 — 需要选中对应鞍
  const sel = inv.getSelected();
  if (!sel.blockId || sel.count <= 0) return;
  const mountMap: Record<string, string> = {
    wreck_horse_saddle: 'wreck_horse',
    slime_saddle: 'slime_mount',
    void_drake_saddle: 'void_drake',
  };
  const mountId = mountMap[sel.blockId];
  if (!mountId) return;
  player.mounted = true;
  player.mountId = mountId;
  sfx.pickup();
}

// M24: 钓鱼系统
interface FishingState {
  active: boolean;       // 是否正在钓鱼
  biteTimer: number;     // 距离上钩的剩余时间
  hasBite: boolean;      // 是否已上钩（等待收竿）
  biteWindow: number;    // 上钩后可收竿的时间窗口
  floatX: number;        // 浮标世界坐标
  floatY: number;
  rodQuality: number;    // 当前鱼竿品质
}
const fishing: FishingState = {
  active: false, biteTimer: 0, hasBite: false, biteWindow: 0,
  floatX: 0, floatY: 0, rodQuality: 1,
};
let fishingMsg = '';
let fishingMsgTimer = 0;

// 大框架: 阶段推进提示 + 阶段奖励（发放物品 + 回满状态）
prog.onStageChange = (stage, idx) => {
  const got: string[] = [];
  for (const r of stage.reward) {
    inv.add(r.blockId, r.count);
    got.push(`${BLOCKS[r.blockId]?.name ?? r.blockId}×${r.count}`);
  }
  player.hp = player.maxHp;
  player.mana = player.maxMana;
  story.show(STAGE_STORY[stage.id]); // 剧情：阶段章节
  fishingMsg = `🚩 阶段 ${idx + 1}/${prog.total} · ${stage.name}｜奖励：${got.join('、')}`;
  fishingMsgTimer = 5;
  sfx.pickup();
  shake(cam, 3);
};
let guardianWarned = false;

// M25: 宠物系统
let activePet: Pet | null = null;
// 召唤物品 → 宠物 id 映射
const petSummonMap: Record<string, string> = {
  ember_sprite_summon: 'ember_sprite',
  glow_wisp_summon: 'glow_wisp',
  void_whelp_summon: 'void_whelp',
};

// M25: 召唤/收回宠物
function togglePet() {
  if (activePet) {
    // 收回
    activePet = null;
    fishingMsg = '宠物已收回';
    fishingMsgTimer = 1.5;
    return;
  }
  const sel = inv.getSelected();
  if (!sel.blockId) { fishingMsg = '需要选中宠物召唤物'; fishingMsgTimer = 2; return; }
  const petId = petSummonMap[sel.blockId];
  if (!petId) { fishingMsg = '需要选中宠物召唤物'; fishingMsgTimer = 2; return; }
  activePet = createPet(petId, player.x, player.y - 40);
  fishingMsg = `召唤了 ${PET_DEFS[petId].name}！`;
  fishingMsgTimer = 2;
  sfx.pickup();
}

// M26: 装备/卸下护甲（O 键）
function equipArmorKey() {
  const sel = inv.getSelected();
  const def = sel.blockId && sel.count > 0 ? ARMOR_DEFS[sel.blockId] : null;
  if (def) {
    // 装备选中护甲
    const { ok, replaced } = armorMgr.equip(sel.blockId);
    if (!ok) return;
    inv.consumeSelected(1);
    if (replaced) inv.add(replaced, 1);
    fishingMsg = `装备 ${def.name}`;
    fishingMsgTimer = 2;
    sfx.pickup();
    return;
  }
  // 未选中护甲 → 依次卸下 head → chest → legs
  const order: ArmorSlot[] = ['head', 'chest', 'legs'];
  for (const slot of order) {
    const removed = armorMgr.unequip(slot);
    if (removed) {
      inv.add(removed, 1);
      fishingMsg = `卸下 ${ARMOR_DEFS[removed].name}`;
      fishingMsgTimer = 2;
      sfx.pickup();
      return;
    }
  }
  fishingMsg = '需要选中护甲（O 键装备 / 再按卸下）';
  fishingMsgTimer = 2;
}

// M30: 使用生命/魔力水晶（U 键，永久提升上限）
function useCrystalKey() {
  const sel = inv.getSelected();
  if (sel.count <= 0 || !sel.blockId) {
    fishingMsg = '需要选中生命/魔力水晶';
    fishingMsgTimer = 2;
    return;
  }
  if (sel.blockId === 'life_crystal') {
    if (!growth.useLifeCrystal()) {
      fishingMsg = `生命水晶已达上限（${LIFE_CRYSTAL_MAX_USES} 次）`;
      fishingMsgTimer = 2.5;
      return;
    }
    inv.consumeSelected(1);
    player.hp = Math.min(player.maxHp, player.hp + LIFE_CRYSTAL_GAIN);
    fishingMsg = `❤ 生命上限 +${LIFE_CRYSTAL_GAIN}！（${growth.hpUses}/${LIFE_CRYSTAL_MAX_USES}）`;
    fishingMsgTimer = 3;
    sfx.pickup();
    return;
  }
  if (sel.blockId === 'mana_crystal') {
    if (!growth.useManaCrystal()) {
      fishingMsg = `魔力水晶已达上限（${MANA_CRYSTAL_MAX_USES} 次）`;
      fishingMsgTimer = 2.5;
      return;
    }
    inv.consumeSelected(1);
    player.mana = player.maxMana;
    fishingMsg = `✦ 魔力上限 +${MANA_CRYSTAL_GAIN}！（${growth.mpUses}/${MANA_CRYSTAL_MAX_USES}）`;
    fishingMsgTimer = 3;
    sfx.pickup();
    return;
  }
  fishingMsg = '需要选中生命/魔力水晶';
  fishingMsgTimer = 2;
}

// M27: 宝箱 UI — 打开 / 关闭 / 重绘
function openChestUI() {
  const c = chestMgr.findNear(player.x, player.y, 3);
  if (!c) { fishingMsg = '附近没有宝箱（3 格内）'; fishingMsgTimer = 2; return; }
  openChest = c;
  inputBlocked = true;
  buildChestUI();
}

function closeChestUI() {
  openChest = null;
  inputBlocked = false;
  chestPanel?.remove();
  chestPanel = null;
}

function chestCellHTML(item: { blockId: string; count: number }): string {
  if (!item.blockId || item.count <= 0) return '<div class="chest-cell"></div>';
  const name = BLOCKS[item.blockId]?.name ?? item.blockId;
  return `<div class="chest-cell" title="${name}">${name.slice(0, 3)}<br><span style="color:#ffd060">${item.count}</span></div>`;
}

function buildChestUI() {
  if (!openChest) return;
  chestPanel?.remove();
  const panel = document.createElement('div');
  panel.id = 'chest-panel';
  panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;'
    + 'align-items:center;justify-content:center;gap:28px;z-index:1000;font:12px monospace;color:#ddd;';
  const styleEl = document.createElement('style');
  styleEl.textContent = '.chest-cell{width:40px;height:40px;background:#1e1e24;border:1px solid #4a4a55;'
    + 'border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;'
    + 'font-size:9px;line-height:1.1;cursor:pointer;user-select:none;overflow:hidden;white-space:nowrap;}'
    + '.chest-cell:hover{background:#2e2e38;border-color:#999;}';
  panel.appendChild(styleEl);

  // 左侧：背包
  const left = document.createElement('div');
  left.innerHTML = '<div style="margin-bottom:6px;color:#ffd060">背包（点击存入）</div>';
  const bagGrid = document.createElement('div');
  bagGrid.style.cssText = 'display:grid;grid-template-columns:repeat(7,40px);gap:3px;';
  const bagAll = [...inv.hotbar, ...inv.slots];
  bagAll.forEach(slot => {
    const cell = document.createElement('div');
    cell.innerHTML = chestCellHTML(slot);
    cell.firstElementChild?.addEventListener('click', () => {
      if (!openChest || !slot.blockId || slot.count <= 0) return;
      const leftover = addToSlots(openChest.slots, slot.blockId, slot.count);
      const moved = slot.count - leftover;
      if (moved > 0) {
        slot.count = leftover;
        if (slot.count <= 0) { slot.blockId = ''; slot.count = 0; }
        sfx.pickup();
        buildChestUI();
      }
    });
    bagGrid.appendChild(cell);
  });
  left.appendChild(bagGrid);

  // 右侧：宝箱
  const right = document.createElement('div');
  right.innerHTML = '<div style="margin-bottom:6px;color:#ffd060">储物箱（点击取出）</div>';
  const chestGrid = document.createElement('div');
  chestGrid.style.cssText = 'display:grid;grid-template-columns:repeat(5,40px);gap:3px;';
  openChest.slots.forEach(slot => {
    const cell = document.createElement('div');
    cell.innerHTML = chestCellHTML(slot);
    cell.firstElementChild?.addEventListener('click', () => {
      if (!openChest || !slot.blockId || slot.count <= 0) return;
      const added = inv.add(slot.blockId, slot.count);
      if (added > 0) {
        slot.count -= added;
        if (slot.count <= 0) { slot.blockId = ''; slot.count = 0; }
        sfx.pickup();
        buildChestUI();
      }
    });
    chestGrid.appendChild(cell);
  });
  right.appendChild(chestGrid);

  const tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:#aaa;';
  tip.textContent = '[K / ESC] 关闭';

  panel.appendChild(left);
  panel.appendChild(right);
  panel.appendChild(tip);
  document.body.appendChild(panel);
  chestPanel = panel;
}

// M28: 熔炉 — 检测附近 4 格内是否有熔炉方块
function findNearbyFurnace(): boolean {
  const ptx = Math.floor(player.x / TILE_SIZE);
  const pty = Math.floor(player.y / TILE_SIZE);
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (getBlock(ptx + dx, pty + dy) === 'furnace') return true;
    }
  }
  return false;
}

function openFurnaceUI() {
  if (!findNearbyFurnace()) {
    fishingMsg = '附近没有熔炉（4 格内）';
    fishingMsgTimer = 2;
    return;
  }
  inputBlocked = true;
  buildFurnaceUI();
}

function closeFurnaceUI() {
  inputBlocked = false;
  furnacePanel?.remove();
  furnacePanel = null;
  furnaceProgressEl = null;
  furnaceStatusEl = null;
}

function buildFurnaceUI() {
  furnacePanel?.remove();
  const panel = document.createElement('div');
  panel.id = 'furnace-panel';
  panel.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.68);display:flex;'
    + 'flex-direction:column;align-items:center;justify-content:center;gap:14px;'
    + 'z-index:1000;font:12px monospace;color:#ddd;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:16px;color:#ffb050;';
  title.textContent = '🔥 熔炉 · 矿石冶炼';
  panel.appendChild(title);

  // 状态 / 进度
  furnaceStatusEl = document.createElement('div');
  furnaceStatusEl.style.cssText = 'color:#ffd060;min-height:16px;';
  panel.appendChild(furnaceStatusEl);

  const barBg = document.createElement('div');
  barBg.style.cssText = 'width:320px;height:10px;background:#222;border:1px solid #555;border-radius:5px;overflow:hidden;';
  furnaceProgressEl = document.createElement('div');
  furnaceProgressEl.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#ff8a20,#ffd060);transition:width 0.08s linear;';
  barBg.appendChild(furnaceProgressEl);
  panel.appendChild(barBg);

  // 配方行
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:6px;';
  for (const r of SMELT_RECIPES) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;background:#1a1a20;'
      + 'border:1px solid #3a3a45;border-radius:4px;padding:6px 10px;min-width:460px;';
    const ok = canSmelt(r, inv);
    const inName = BLOCKS[r.inputBlockId]?.name ?? r.inputBlockId;
    const fuelName = BLOCKS[r.fuelBlockId]?.name ?? r.fuelBlockId;
    const outName = BLOCKS[r.outputBlockId]?.name ?? r.outputBlockId;
    row.innerHTML = `<span style="color:${ok ? '#8ce88c' : '#c06060'};font-weight:bold;">${r.name}</span>`
      + `<span style="flex:1;">${inName}×${r.inputCount} + ${fuelName}×${r.fuelCount} → ${outName}×${r.outputCount}</span>`
      + `<span style="color:#ffd060;">${r.duration}s</span>`;
    const btn = document.createElement('button');
    btn.textContent = '冶炼';
    btn.disabled = !ok || !!smeltMgr.job;
    btn.style.cssText = 'padding:3px 12px;font:11px monospace;cursor:pointer;'
      + 'background:' + (btn.disabled ? '#333' : '#5a3a18') + ';color:' + (btn.disabled ? '#777' : '#ffd060') + ';'
      + 'border:1px solid ' + (btn.disabled ? '#444' : '#a06a20') + ';border-radius:3px;';
    btn.addEventListener('click', () => {
      if (smeltMgr.start(r.id, inv)) {
        sfx.digHard();
        buildFurnaceUI();
      }
    });
    row.appendChild(btn);
    list.appendChild(row);
  }
  panel.appendChild(list);

  const tip = document.createElement('div');
  tip.style.cssText = 'color:#aaa;margin-top:8px;';
  tip.textContent = `燃料：余烬（${inv.count('ember_ash')} 个） · [L / ESC] 关闭`;
  panel.appendChild(tip);

  document.body.appendChild(panel);
  furnacePanel = panel;
}

/** 每帧刷新熔炉进度显示（仅面板打开时） */
function refreshFurnaceProgress() {
  if (!furnacePanel) return;
  if (furnaceStatusEl && furnaceProgressEl) {
    if (smeltMgr.job) {
      const r = SMELT_RECIPES.find(x => x.id === smeltMgr.job!.recipeId);
      const pct = Math.floor(smeltMgr.progressRatio * 100);
      furnaceStatusEl.textContent = `冶炼中：${r?.name ?? ''} ${pct}%`;
      furnaceProgressEl.style.width = `${pct}%`;
    } else {
      furnaceStatusEl.textContent = '空闲 — 选择下方配方开始冶炼';
      furnaceProgressEl.style.width = '0%';
    }
  }
}

// ========== M29: localStorage 存档 ==========
function collectSaveData(): SaveData {
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    tiles: u8ToB64(terrain.tiles),
    heightMap: u8ToB64(terrain.heightMap),
    player: { x: player.x, y: player.y, hp: player.hp },
    inv: {
      hotbar: inv.hotbar.map(s => ({ blockId: s.blockId, count: s.count })),
      slots: inv.slots.map(s => ({ blockId: s.blockId, count: s.count })),
      selectedHotbar: inv.selectedHotbar,
    },
    shellIdx: shellMgr.currentIdx,
    shellHp: shellMgr.shells.map(s => s.hp),
    accessory: { ids: acc.slots.map(s => s.accessoryId), slotIndex: acc.slotIndex },
    armor: { head: armorMgr.head, chest: armorMgr.chest, legs: armorMgr.legs },
    chests: chestMgr.serialize(),
    timeOfDay: renderer.timeOfDay,
    growth: growth.serialize(), // M30
    crops: cropMgr.serialize(), // M31
    settlement: settlementMgr.serialize(), // M32
    progression: prog.serialize(), // 大框架: 阶段进度
    storySeen: story.serialize(), // 剧情已看记录
  };
}

function doSave(silent = false): boolean {
  const ok = writeSave(collectSaveData());
  if (!silent) {
    fishingMsg = ok ? '💾 已保存存档' : '存档失败（存储空间不足？）';
    fishingMsgTimer = 2.5;
    if (ok) sfx.pickup();
  }
  return ok;
}

function applySaveData(save: SaveData) {
  // 世界
  terrain.tiles = b64ToU8(save.tiles);
  terrain.heightMap = b64ToU8(save.heightMap);
  // 玩家
  player.x = save.player.x;
  player.y = save.player.y;
  player.hp = save.player.hp;
  // 背包
  save.inv.hotbar.forEach((s, i) => {
    if (inv.hotbar[i]) { inv.hotbar[i].blockId = s.blockId; inv.hotbar[i].count = s.count; }
  });
  save.inv.slots.forEach((s, i) => {
    if (inv.slots[i]) { inv.slots[i].blockId = s.blockId; inv.slots[i].count = s.count; }
  });
  inv.selectedHotbar = Math.max(0, Math.min(8, save.inv.selectedHotbar));
  // 躯壳
  shellMgr.currentIdx = Math.max(0, Math.min(shellMgr.shells.length - 1, save.shellIdx));
  save.shellHp.forEach((hp, i) => { if (shellMgr.shells[i]) shellMgr.shells[i].hp = hp; });
  // 饰品
  acc.slots = save.accessory.ids.filter(id => ACCESSORY_DEFS[id]).map(id => ({ accessoryId: id }));
  acc.slotIndex = Math.max(0, Math.min(save.accessory.slotIndex, Math.max(0, acc.slots.length - 1)));
  // 护甲
  armorMgr.head = save.armor.head && ARMOR_DEFS[save.armor.head] ? save.armor.head : null;
  armorMgr.chest = save.armor.chest && ARMOR_DEFS[save.armor.chest] ? save.armor.chest : null;
  armorMgr.legs = save.armor.legs && ARMOR_DEFS[save.armor.legs] ? save.armor.legs : null;
  // 宝箱
  chestMgr.restore(save.chests ?? []);
  // M30: 永久成长
  growth.restore(save.growth);
  // M31: 作物
  cropMgr.restore(save.crops);
  // M32: 定居点
  settlementMgr.restore(save.settlement);
  // 大框架: 阶段进度（载入存档时不重复发放阶段奖励）
  const stageCb = prog.onStageChange;
  prog.onStageChange = undefined;
  prog.restore(save.progression);
  prog.onStageChange = stageCb;
  // 剧情：恢复已看记录，避免重复播放
  story.restore(save.storySeen);
  // 时间
  if (typeof save.timeOfDay === 'number') renderer.timeOfDay = save.timeOfDay;
  fishingMsg = `已载入存档（${formatSaveTime(save.timestamp)}）`;
  fishingMsgTimer = 4;
}

// M24: 钓鱼 — 检测玩家附近是否有液态方块
function findNearbyLiquid(): { tx: number; ty: number } | null {
  const ptx = Math.floor(player.x / TILE_SIZE);
  const pty = Math.floor(player.y / TILE_SIZE);
  for (let dy = -2; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = ptx + dx, ty = pty + dy;
      const b = getBlock(tx, ty);
      if (BLOCKS[b]?.liquid) return { tx, ty };
    }
  }
  return null;
}

// M24: 开始钓鱼
function startFishing() {
  const sel = inv.getSelected();
  if (!sel.blockId) { fishingMsg = '需要选中钓鱼竿'; fishingMsgTimer = 2; return; }
  const tool = TOOLS[sel.blockId];
  if (!tool || tool.category !== 'fishing') { fishingMsg = '需要选中钓鱼竿'; fishingMsgTimer = 2; return; }
  const liquid = findNearbyLiquid();
  if (!liquid) { fishingMsg = '附近没有水域'; fishingMsgTimer = 2; return; }
  fishing.active = true;
  fishing.hasBite = false;
  fishing.rodQuality = tool.rodQuality ?? 1;
  // 浮标位置 = 液态方块中心
  fishing.floatX = liquid.tx * TILE_SIZE + TILE_SIZE / 2;
  fishing.floatY = liquid.ty * TILE_SIZE + TILE_SIZE / 2;
  // 上钩等待时间 2~6 秒（强化竿更快）
  const baseWait = fishing.rodQuality >= 2 ? 1.5 : 2.5;
  fishing.biteTimer = baseWait + Math.random() * 4;
  fishingMsg = '抛竿…等待上钩';
  fishingMsgTimer = 2;
  sfx.pickup();
}

// M24: 收竿
function reelIn() {
  if (!fishing.active) return;
  if (fishing.hasBite) {
    // 成功钓到
    const pcol = Math.floor(player.x / TILE_SIZE);
    const region = regionIdAt(pcol);
    const catchId = rollCatch(region, fishing.rodQuality);
    if (catchId === 'old_chest') {
      // 旧宝箱：随机掉落
      const loot = rollChestLoot();
      for (const l of loot) inv.add(l.blockId, l.count);
      fishingMsg = `钓到旧宝箱！获得 ${loot.map(l => `${BLOCKS[l.blockId]?.name ?? l.blockId}×${l.count}`).join('、')}`;
    } else {
      inv.add(catchId, 1);
      const fish = FISH_DEFS[catchId];
      fishingMsg = `钓到 ${fish?.name ?? catchId}！${fish?.isRare ? '（稀有）' : ''}`;
    }
    fishingMsgTimer = 3;
    sfx.pickup();
  } else {
    fishingMsg = '收竿太早了…';
    fishingMsgTimer = 1.5;
  }
  fishing.active = false;
  fishing.hasBite = false;
}

// M24: 钓鱼按键 — 选中钓鱼竿时 F 键抛竿/收竿，否则招募队友
function handleFishingKey() {
  const sel = inv.getSelected();
  const tool = sel.blockId ? TOOLS[sel.blockId] : null;
  if (tool && tool.category === 'fishing') {
    if (fishing.active) reelIn();
    else startFishing();
    return true;
  }
  return false;
}

// M22: 药水系统
let currentPotionBuff = aggregateBuffs([]);

// M9a: 伤害弹出数字
interface DmgText { x: number; y: number; vy: number; text: string; color: string; life: number; maxLife: number; crit: boolean; }
const dmgTexts: DmgText[] = [];

// M9b: 掉落物理（吸引玩家）
function updateDropPhysics(dt: number) {
  const buff = acc.getAggregatedBuff();
  const magnetMult = buff.magnetBonus ?? 1;
  const pickupRange = (36 * magnetMult) * (36 * magnetMult);
  const magnetRange = (60 * magnetMult) * (60 * magnetMult);
  for (let i = breakState.drops.length - 1; i >= 0; i--) {
    const d = breakState.drops[i];
    d.life -= dt;
    if (d.life <= 0) { breakState.drops.splice(i, 1); continue; }
    // 吸引玩家
    const dx = player.x - d.x, dy = player.y - d.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < magnetRange) {
      const invDist = 1 / Math.sqrt(d2);
      d.vx += dx * invDist * 400 * dt;
      d.vy += dy * invDist * 400 * dt;
    }
    // 重力
    d.vy += 800 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    // 落地检测（简化：查下方 tile 是否是固体）
    const tx = Math.floor(d.x / TILE_SIZE);
    const ty = Math.floor(d.y / TILE_SIZE);
    if (getTileSolid(tx, ty + 1)) {
      d.y = ty * TILE_SIZE + TILE_SIZE - 2;
      d.vy = 0; d.vx *= 0.7;
    }
    // 拾取
    if (d2 < pickupRange) {
      const picked = inv.add(d.blockId, 1);
      if (picked > 0) { breakState.drops.splice(i, 1); sfx.pickup(); }
    }
  }
}

function spawnDmgText(x: number, y: number, damage: number, color = '#fff', critChance = 0.08, critMult = 1.5) {
  const crit = Math.random() < critChance;
  const finalDmg = crit ? Math.floor(damage * critMult) : Math.floor(damage);
  const text = crit ? `CRIT ${finalDmg}!` : String(finalDmg);
  dmgTexts.push({ x, y, vy: -60, text, color: crit ? '#ff8040' : color, life: crit ? 0.9 : 0.7, maxLife: crit ? 0.9 : 0.7, crit });
}

function updateDmgTexts(dt: number) {
  for (let i = dmgTexts.length - 1; i >= 0; i--) {
    const t = dmgTexts[i];
    t.life -= dt;
    if (t.life <= 0) { dmgTexts.splice(i, 1); continue; }
    t.y += t.vy * dt;
    t.vy += 30 * dt;
  }
}

// M9c: 小地图开关（按 M 切换）
let showMinimap = true;

// 输入
const input = { left: false, right: false, jump: false, sprint: false };
let mouseTile: { x: number; y: number } | null = null;
let mouseLeft = false;
let mouseWorldX = 0; // M18: 鼠标世界坐标（远程瞄准）
let mouseWorldY = 0;
let mouseRight = false;
let mouseRightEdge = false;
let inputBlocked = false;

// 给玩家挂上当前躯壳 HP
applyShellToPlayer(false);

// 初始测试物品
inv.add('wreck_scrap', 20);
inv.add('cracked_ground', 30);
inv.add('wind_rock', 15);
inv.add('ore_copper', 20);
inv.add('ore_iron', 15);
inv.add('ore_gold', 10);
inv.add('copper_pickaxe', 1);
inv.add('copper_sword', 1);
inv.selectHotbar(0);
inv.hotbar[1] = { blockId: 'copper_pickaxe', count: 1 };
inv.hotbar[2] = { blockId: 'copper_sword', count: 1 };

// M11: 初始饰品 — 给 2 个试玩
inv.add('dash_boots', 1);
inv.add('speed_glove', 1);
acc.equip('dash_boots');
acc.equip('speed_glove');

// ========== 躯壳 → 玩家属性 ==========
function applyShellToPlayer(applyHUD = true) {
  const cur = shellMgr.current;
  // HP: 用 ShellState 里的保存值
  const state = shellMgr.currentState;
  player.maxHp = cur.baseHp;
  player.hp = Math.min(state.hp, cur.baseHp);
  // 被动
  px.canDoubleJump = cur.passiveKey === 'doublejump';
  px.hurtEnemies.clear();
  // 镐等级加成（铁躯壳 pickaxePower+1）
  px.toolName = 'hand_pickaxe';
  if (applyHUD) updateHUD();
}

// ========== 启动 ==========
// Boss 位置缓存（必须在 init() 前声明，避免暂时性死区）
let _altarCenter: { x: number; y: number } | null = null;
let _barrierCenter: { x: number; y: number } | null = null;
let _rockAltarCenter: { x: number; y: number } | null = null;
init();

async function init() {
  // M29: 启动时自动加载存档（?fresh=1 强制生成新地图，忽略存档）
  const forceFresh = new URLSearchParams(location.search).has('fresh');
  freshMode = forceFresh;
  const save = forceFresh ? null : readSave();
  if (save) {
    applySaveData(save);
  } else {
    placePlayerOnGround(player, terrain.heightMap);
    initDungeonLoot(); // 大框架: 地牢宝箱战利品
  }
  if (forceFresh) {
    fishingMsg = '已生成新地图（?fresh=1）· Ctrl+Shift+S 清除存档';
    fishingMsgTimer = 6;
  }
  // 试玩便利：?gift=1 补齐宠物召唤材料（不写入正式平衡）
  if (new URLSearchParams(location.search).has('gift')) {
    const gifts: [string, number][] = [
      ['ember_ash', 8], ['crystal_glow', 2], ['bio_glow', 4],
      ['void_crystal', 3], ['dark_seed', 3], ['chitin', 4],
    ];
    for (const [id, n] of gifts) {
      const lack = n - inv.count(id);
      if (lack > 0) inv.add(id, lack);
    }
    fishingMsg = '🎁 已补齐宠物召唤材料（?gift=1）';
    fishingMsgTimer = 6;
  }
  voidEngine.initFromTerrain(terrain.tiles);
  initCompanions();
  initStoryGuides();
  resize();
  window.addEventListener('resize', resize);
  bindInput();
  bindWorkbenchClose();
  loading.classList.add('hidden');
  story.show(PROLOGUE); // 剧情：序章（只在从未看过时播放）
  requestAnimationFrame(loop);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.resize(w, h);
  cam.width = w; cam.height = h;
}

function bindInput() {
  window.addEventListener('keydown', e => {
    // M29: Ctrl+S 存档 / Ctrl+Shift+S 新游戏（清档重开）/ Ctrl+L 重新载入
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      if (e.shiftKey) {
        if (confirm('清除存档并生成新地图？此操作不可撤销。')) {
          clearSave();
          location.href = location.pathname + '?fresh=1';
        }
      } else {
        doSave();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyL') {
      e.preventDefault();
      fishingMsg = '正在重新载入存档…';
      fishingMsgTimer = 1;
      location.reload();
      return;
    }
    if (inputBlocked) {
      if (e.code === 'Escape') { if (openChest) closeChestUI(); if (furnacePanel) closeFurnaceUI(); wb.close(); }
      else if (e.code === 'KeyK' && openChest) closeChestUI();
      else if (e.code === 'KeyL' && furnacePanel) closeFurnaceUI();
      else if (e.code === 'KeyC') wb.craftSelected(e.shiftKey);
      return;
    }
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': input.left = true; break;
      case 'ArrowRight': case 'KeyD': input.right = true; break;
      case 'ArrowUp': case 'KeyW': case 'Space':
        if (!e.repeat) {
          input.jump = true;
          // 二段跳：如果已在空中且 canDoubleJump
          if (!player.onGround && px.canDoubleJump && !px.usedSecondJump) {
            player.vy = -shellMgr.current.jumpSpeed * 0.9;
            px.usedSecondJump = true;
          }
        }
        break;
      case 'ShiftLeft': case 'ShiftRight': input.sprint = true; break;
      // M20: 商店打开时，数字键购买商品
      case 'Digit1': case 'Numpad1': if (shopOpenLocal) buyItem(0); else inv.selectHotbar(0); break;
      case 'Digit2': case 'Numpad2': if (shopOpenLocal) buyItem(1); else inv.selectHotbar(1); break;
      case 'Digit3': case 'Numpad3': if (shopOpenLocal) buyItem(2); else inv.selectHotbar(2); break;
      case 'Digit4': case 'Numpad4': if (shopOpenLocal) buyItem(3); else inv.selectHotbar(3); break;
      case 'Digit5': case 'Numpad5': if (shopOpenLocal) buyItem(4); else inv.selectHotbar(4); break;
      case 'Digit6': case 'Numpad6': if (shopOpenLocal) buyItem(5); else inv.selectHotbar(5); break;
      case 'Digit7': case 'Numpad7': if (shopOpenLocal) buyItem(6); else inv.selectHotbar(6); break;
      case 'Digit8': case 'Numpad8': if (shopOpenLocal) buyItem(7); else inv.selectHotbar(7); break;
      case 'Digit9': case 'Numpad9': if (shopOpenLocal) buyItem(8); else inv.selectHotbar(8); break;
      case 'KeyE':
        if (shopOpenLocal) { shopOpenLocal = false; inputBlocked = false; }
        else wb.toggle();
        break;
      case 'Escape':
        wb.close();
        if (shopOpenLocal) { shopOpenLocal = false; inputBlocked = false; }
        break;
      // M20: 商店 — 出售选中快捷栏物品
      case 'KeyT':
        if (shopOpenLocal) sellSelected();
        break;
      // M22: 使用药水
      case 'KeyH':
        usePotion();
        break;
      // M23: 上下马
      case 'KeyJ':
        toggleMount();
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) shellMgr.prev();
        else shellMgr.next();
        applyShellToPlayer(true);
        sfx.shellSwitch();
        break;
      case 'KeyR':
        // M21: 优先检测试炼坛
        const nearbyTrial = getNearbyTrial();
        if (nearbyTrial) activateTrial(nearbyTrial);
        else trySummonBoss();
        break;
      case 'KeyF':
        // M24: 选中钓鱼竿时抛竿/收竿，否则招募队友
        if (!handleFishingKey()) tryRecruitCompanion();
        break;
      case 'KeyM':
        showMinimap = !showMinimap;
        break;
      // M25: 召唤/收回宠物
      case 'KeyP':
        togglePet();
        break;
      // M26: 装备/卸下护甲
      case 'KeyO':
        equipArmorKey();
        break;
      // M27: 打开/关闭宝箱
      case 'KeyK':
        if (openChest) closeChestUI();
        else openChestUI();
        break;
      // M28: 打开/关闭熔炉
      case 'KeyL':
        if (furnacePanel) closeFurnaceUI();
        else openFurnaceUI();
        break;
      // M30: 使用生命/魔力水晶
      case 'KeyU':
        useCrystalKey();
        break;
      case 'KeyV':
        sfx.toggle();
        console.log(`[音效] ${sfx.isEnabled() ? '开启' : '关闭'}`);
        break;
      // M20/M32: 打开商店（定居者优先，其次流浪商人）
      case 'KeyB':
        if (shopOpenLocal) {
          shopOpenLocal = false; inputBlocked = false;
        } else {
          const settlerId = nearbySettlerId();
          if (settlerId) {
            if (!settlerShops[settlerId]) {
              settlerShops[settlerId] = NPC_DEFS[settlerId].shop.map(s => ({ ...s }));
            }
            story.show(NPC_STORY[settlerId]); // 剧情：定居者初见对话
            activeShop = settlerShops[settlerId];
            activeShopName = NPC_DEFS[settlerId].name;
            shopOpenLocal = true; inputBlocked = true;
            shopMsg = `${activeShopName}：按数字键购买，按 T 出售选中`; shopMsgTimer = 3;
          } else if (isNearMerchant()) {
            story.show(NPC_STORY.merchant); // 剧情：流浪商人初见
            activeShop = merchantShop;
            activeShopName = '流浪商人';
            shopOpenLocal = true; inputBlocked = true;
            shopMsg = `欢迎！按数字键购买，按 T 出售选中`; shopMsgTimer = 3;
          } else {
            shopMsg = '附近没有商人或定居者'; shopMsgTimer = 2;
          }
        }
        break;
      // M11: 饰品系统
      case 'KeyQ':
        acc.nextSlot();
        sfx.shellSwitch();
        break;
      case 'KeyG': {
        const selG = inv.getSelected();
        if (selG.count > 0 && ACCESSORY_DEFS[selG.blockId]) {
          if (acc.equip(selG.blockId)) {
            // 消耗选中物品
            inv.consumeSelected(1);
            sfx.pickup();
            console.log(`[饰品] ✅ 已装备 ${ACCESSORY_DEFS[selG.blockId].name}`);
          } else {
            console.warn('[饰品] 槽已满或已装备同类');
          }
        } else {
          // 卸下当前饰品放回背包
          const removed = acc.unequip();
          if (removed) {
            inv.add(removed, 1);
            sfx.pickup();
            console.log(`[饰品] 已卸下 ${ACCESSORY_DEFS[removed].name}`);
          }
        }
        break;
      }
      case 'ControlLeft':
      case 'ControlRight':
        dashKeyHeld = true;
        break;
    }
  });
  window.addEventListener('keyup', e => {
    if (inputBlocked) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': input.left = false; break;
      case 'ArrowRight': case 'KeyD': input.right = false; break;
      case 'ArrowUp': case 'KeyW': case 'Space':
        input.jump = false;
        // 松开跳跃键重置二段跳标记（允许下次落地再跳）
        if (player.onGround) px.usedSecondJump = false;
        break;
      case 'ShiftLeft': case 'ShiftRight': input.sprint = false; break;
      case 'ControlLeft': case 'ControlRight': dashKeyHeld = false; break;
    }
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    mouseTile = { x: Math.floor((sx + cam.x) / TILE_SIZE), y: Math.floor((sy + cam.y) / TILE_SIZE) };
    mouseWorldX = sx + cam.x;
    mouseWorldY = sy + cam.y;
  });

  canvas.addEventListener('wheel', e => {
    if (inputBlocked) return;
    e.preventDefault();
    inv.scrollHotbar(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  canvas.addEventListener('mousedown', e => {
    if (inputBlocked) return;
    if (e.button === 0) mouseLeft = true;
    if (e.button === 2) { mouseRight = true; mouseRightEdge = true; }
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouseLeft = false;
    if (e.button === 2) mouseRight = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function bindWorkbenchClose() {
  document.getElementById('wb-close-btn')?.addEventListener('click', () => wb.close());
}

// ========== 世界查询 ==========
function getBlock(tx: number, ty: number): string {
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return 'empty';
  return biToBlock(terrain.tiles[ty * MAP_WIDTH + tx]);
}
function setBlock(tx: number, ty: number, id: string) {
  if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) return;
  const ids = Object.keys(BLOCKS);
  const idx = ids.indexOf(id);
  if (idx >= 0) terrain.tiles[ty * MAP_WIDTH + tx] = idx;
}
function getTileSolid(tx: number, ty: number) { return isSolid(getBlock(tx, ty)); }

// ========== 主循环 ==========
let lastT = performance.now();
let fpsAcc = 0, fpsFrames = 0, fpsNow = 0;

function loop(t: number) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 1) { fpsNow = fpsFrames; fpsFrames = 0; fpsAcc = 0; }

  update(dt);
  render();

  mouseRightEdge = false;
  requestAnimationFrame(loop);
}

function update(dt: number) {
  // 躯壳切换冷却
  shellMgr.update(dt);
  // 剧情字幕推进（即使打开合成台也继续计时）
  story.update(dt);

  if (inputBlocked) { updateHUD(); return; }

  // M11: 饰品系统更新
  acc.update(dt);

  // M15: 世界事件更新（先跑，让事件状态在当前帧内生效）
  const playerColForEvent = Math.floor(player.x / TILE_SIZE);
  ev.update(dt, renderer.timeOfDay, playerColForEvent);

  // M17: 任务 — 区块变化检测
  let curRegion = 'wreck_zone';
  if (playerColForEvent < 60) curRegion = 'wreck_zone';
  else if (playerColForEvent < 120) curRegion = 'crack_waste';
  else if (playerColForEvent < 180) curRegion = 'gobi_mine';
  else if (playerColForEvent < 240) curRegion = 'silent_sea';
  else if (playerColForEvent < 300) curRegion = 'beast_hive';
  else curRegion = 'underground_valley';
  if (curRegion !== lastRegion) {
    lastRegion = curRegion;
    tasks.onEnterRegion(curRegion);
    ach.addProgress('explore_all', 1); // M19: 探险家成就
    story.show(REGION_STORY[curRegion]); // 剧情：区块初见
  }

  // 日夜循环
  renderer.timeOfDay = (renderer.timeOfDay + dt / 240) % 1;

  // 玩家（躯壳属性 + 饰品 Buff）
  const armorBuff = armorMgr.getAggregatedBuff(); // M26
  player.maxHp = shellMgr.current.baseHp + (armorBuff.maxHpBonus ?? 0) + growth.hpBonus; // M30
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  // M30: 魔力上限与自动回复
  player.maxMana = 100 + growth.mpBonus;
  if (player.mana > player.maxMana) player.mana = player.maxMana;
  player.mana = Math.min(player.maxMana, player.mana + 8 * dt);
  const buff = acc.getAggregatedBuff();

  // 速度：躯壳速度 × 饰品速度倍率
  const baseSpeed = shellMgr.current.speed * (buff.moveSpeedBonus ?? 1);
  const savedSpeed = player.moveSpeed ?? 180;
  const savedJump = player.jumpSpeed ?? 380;
  const savedGravityMult = player.gravityMult ?? 1;
  player.moveSpeed = baseSpeed;
  // M19: 探险家成就 — 移速 buff
  player.moveSpeed *= ach.getAggregatedBuff().moveSpeedMult ?? 1;
  // M22: 敏捷药水 — 移速 buff
  player.moveSpeed *= currentPotionBuff.speedMult;
  // M23: 坐骑移速
  if (player.mounted && player.mountId) player.moveSpeed *= MOUNT_DEFS[player.mountId].speedMult;
  // M26: 护甲移速
  player.moveSpeed *= armorBuff.moveSpeedBonus ?? 1;
  // 疾跑：按住 Shift 额外提速 50%
  if (input.sprint) player.moveSpeed *= 1.5;
  // M13: jumpBonus（rock_titan_crown）
  player.jumpSpeed = shellMgr.current.jumpSpeed * (buff.jumpBonus ?? 1);
  // M13: gravityReduction（rock_titan_crown）
  player.gravityMult = 1 - (buff.gravityReduction ?? 0);
  // M23: 坐骑跳跃 + 重力
  if (player.mounted && player.mountId) {
    const m = MOUNT_DEFS[player.mountId];
    player.jumpSpeed *= m.jumpMult;
    player.gravityMult *= m.gravityMult;
  }
  // M26: 护甲跳跃
  player.jumpSpeed *= armorBuff.jumpBonus ?? 1;

  // 冲刺触发：按住 Ctrl 且有冲刺靴
  if (dashKeyHeld && !acc.isDashing) {
    const dashSpeed = acc.tryDash(player.facing as 1 | -1);
    if (dashSpeed > 0) {
      player.vx = dashSpeed * player.facing;
      player.vy = 0;
      sfx.swing(); // 复用 swing 音效
    }
  }
  // 冲刺中：强制水平速度
  if (acc.isDashing) {
    const b2 = acc.getAggregatedBuff();
    const ds = b2.dashSpeed ?? 520;
    player.vx = ds * acc.dashDir;
    player.vy = 0;
  }

  updatePlayer(player, dt, input, getTileSolid);
  player.moveSpeed = savedSpeed;
  player.jumpSpeed = savedJump;
  player.gravityMult = savedGravityMult;

  // 持远程武器时自动面向鼠标，瞄准方向与朝向一致
  const heldTool = TOOLS[px.toolName];
  if (heldTool.category === 'ranged' && !input.left && !input.right) {
    player.facing = mouseWorldX >= player.x ? 1 : -1;
  }

  // M16: 攻击冷却 tick
  if (swingCd > 0) swingCd -= dt;
  if (meleeAnim > 0) meleeAnim -= dt;
  if (rangedAnim > 0) rangedAnim -= dt;

  // M24: 钓鱼计时
  if (fishing.active) {
    if (!fishing.hasBite) {
      fishing.biteTimer -= dt;
      if (fishing.biteTimer <= 0) {
        fishing.hasBite = true;
        fishing.biteWindow = 2.5; // 2.5秒内收竿
        fishingMsg = '上钩了！快按 F 收竿！';
        fishingMsgTimer = 2.5;
        sfx.hitEnemy();
      }
    } else {
      fishing.biteWindow -= dt;
      if (fishing.biteWindow <= 0) {
        // 错过了
        fishing.active = false;
        fishing.hasBite = false;
        fishingMsg = '鱼跑了…';
        fishingMsgTimer = 1.5;
      }
    }
  }
  if (fishingMsgTimer > 0) { fishingMsgTimer -= dt; if (fishingMsgTimer <= 0) fishingMsg = ''; }

  // M28: 熔炉冶炼推进
  const smelted = smeltMgr.update(dt);
  if (smelted) {
    inv.add(smelted.blockId, smelted.count);
    sfx.pickup();
    fishingMsg = `冶炼完成：${BLOCKS[smelted.blockId]?.name ?? smelted.blockId} ×${smelted.count}`;
    fishingMsgTimer = 3;
    if (furnacePanel) buildFurnaceUI();
  }
  refreshFurnaceProgress();

  // M31: 作物生长推进
  cropMgr.update(dt, getBlock, setBlock);

  // M32: NPC 城镇入驻
  if (settlementMgr.hasFlag && getBlock(settlementMgr.flagTx, settlementMgr.flagTy) !== 'settlement_flag') {
    settlementMgr.removeFlag();
  }
  const newSettler = settlementMgr.update(dt, getBlock, setBlock, prog.stageIndex);
  if (newSettler) {
    const def = SETTLER_DEFS.find(d => d.id === newSettler);
    fishingMsg = `🏠 ${def?.name ?? newSettler} 已入驻定居点！（按 B 交易）`;
    fishingMsgTimer = 4;
    sfx.pickup();
  }

  // M29: 自动保存（每 90 秒，静默）
  autosaveTimer += dt;
  if (autosaveTimer >= AUTOSAVE_INTERVAL) {
    autosaveTimer = 0;
    if (!freshMode) doSave(true);
  }

  // M25: 宠物 AI 更新
  if (activePet) {
    updatePet(activePet, player.x, player.y, dt, enemies, (tx, ty, dmg) => {
      // 战斗召唤物攻击 — 找到目标敌人造成伤害
      for (const e of enemies) {
        if (e.state === 'dead') continue;
        const d2 = (e.x - tx) ** 2 + (e.y - ty) ** 2;
        if (d2 < 30 * 30) {
          hitEnemy(e, dmg, 50, Math.sign(e.x - activePet!.x) as 1 | -1 || 1);
          break;
        }
      }
    });
  }

  // M16: 熔岩核心 — 落地震伤（上一帧不在地面，这一帧在地面，且 vy 足够大）
  const buffLocalLanding = acc.getAggregatedBuff();
  if (wasOnGround === false && player.onGround && player.vy > 300 &&
      buffLocalLanding.jumpSplashDamage && buffLocalLanding.jumpSplashRadius) {
    const radius = buffLocalLanding.jumpSplashRadius;
    const dmg = buffLocalLanding.jumpSplashDamage;
    let hitAny = false;
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const dxe = e.x - player.x, dye = e.y - player.y;
      if (dxe * dxe + dye * dye < radius * radius) {
        const dir = Math.sign(dxe) || 1;
        hitEnemy(e, dmg, 100, dir as 1 | -1);
        spawnDmgText(e.x, e.y - e.def.height / 2, dmg, '#ff6020', 0, 1);
        hitAny = true;
      }
    }
    if (hitAny) {
      shake(cam, 2);
      sfx.hitEnemy();
    }
  }
  // 落地烟尘：强化落地与跳跃手感
  if (wasOnGround === false && player.onGround) {
    for (let i = 0; i < 6; i++) {
      breakState.particles.push({
        x: player.x + (Math.random() - 0.5) * player.width,
        y: player.y + player.height / 2 - 2,
        vx: (Math.random() - 0.5) * 140,
        vy: -Math.random() * 50,
        life: 0.35,
        maxLife: 0.35,
        color: 'bone02',
        size: 2 + Math.random() * 2,
        gravity: 220,
      });
    }
  }
  wasOnGround = player.onGround;

  // 滑翔：空中按住跳跃键时限制下落速度
  if (!player.onGround && input.jump && buff.glideFallSpeed && player.vy > buff.glideFallSpeed) {
    player.vy = buff.glideFallSpeed;
  }
  // M23: 飞行坐骑滞空 — 按住跳跃键限制下落速度
  if (player.mounted && player.mountId && !player.onGround && input.jump) {
    const m = MOUNT_DEFS[player.mountId];
    if (m.canFly && player.vy > m.flyFallSpeed) {
      player.vy = m.flyFallSpeed;
    }
  }
  // 落地重置二段跳
  if (player.onGround) px.usedSecondJump = false;

  // M11: 再生
  const regenGain = acc.updateRegen(dt);
  if (regenGain > 0) {
    player.hp = Math.min(player.maxHp, player.hp + regenGain);
    spawnDmgText(player.x, player.y - player.height / 2 - 10, regenGain, '#60e8a0', 0);
  }

  // 同步躯壳 state 的 HP
  shellMgr.currentState.hp = player.hp;

  // 摄像机
  follow(cam, player.x, player.y, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE);
  updateShake(cam, dt);

  // M17: 任务完成弹窗倒计时
  if (questPopup) {
    questPopup.timer -= dt;
    if (questPopup.timer <= 0) questPopup = null;
  }
  // M19: 成就解锁弹窗倒计时
  if (achPopup) {
    achPopup.timer -= dt;
    if (achPopup.timer <= 0) achPopup = null;
  }
  // M20: 商店消息倒计时
  if (shopMsgTimer > 0) { shopMsgTimer -= dt; if (shopMsgTimer <= 0) shopMsg = ''; }
  // M21: 试炼消息倒计时
  if (trialMsgTimer > 0) { trialMsgTimer -= dt; if (trialMsgTimer <= 0) trialMsg = ''; }

  // M22: 药水 buff 倒计时
  for (let i = player.activeBuffs.length - 1; i >= 0; i--) {
    player.activeBuffs[i].remaining -= dt;
    if (player.activeBuffs[i].remaining <= 0) player.activeBuffs.splice(i, 1);
  }
  currentPotionBuff = aggregateBuffs(player.activeBuffs);

  // M21: 试炼更新
  const trialResult = trial.update(dt);
  if (trialResult === 'spawn_wave') spawnTrialWave();

  // 破坏系统（考虑躯壳镐等级加成）
  const effectivePower = TOOLS[px.toolName].pickaxePower + (shellMgr.current.passiveKey === 'pickaxe' ? 1 : 0);
  // M19: 初探者成就 — 挖矿速度 buff
  breakState.miningSpeedMult = ach.getAggregatedBuff().miningSpeedMult ?? 1;
  if (mouseLeft && mouseTile) {
    const pcol = Math.floor(player.x / TILE_SIZE);
    const prow = Math.floor(player.y / TILE_SIZE);
    const colDist = Math.abs(mouseTile.x - pcol) + Math.abs(mouseTile.y - prow);
    if (colDist <= 6) {
      if (!breakState.targetTile) startBreaking(breakState, mouseTile.x, mouseTile.y, getBlock, px.toolName);
      else if (breakState.targetTile.x !== mouseTile.x || breakState.targetTile.y !== mouseTile.y) {
        stopBreaking(breakState);
        startBreaking(breakState, mouseTile.x, mouseTile.y, getBlock, px.toolName);
      }
    } else stopBreaking(breakState);
  } else stopBreaking(breakState);
  updateBreaking(breakState, dt, px.toolName, getBlock, setBlock);
  updateParticles(breakState, dt, getTileSolid);

  // 破坏音效（每帧清除）
  for (let i = 0; i < breakState.removedThisFrame; i++) {
    const power = TOOLS[px.toolName].pickaxePower + (shellMgr.current.passiveKey === 'pickaxe' ? 1 : 0);
    if (power >= 2) sfx.digHard(); else sfx.dig();
  }
  // M17: 任务 — 挖方块触发
  for (const bid of breakState.removedBlocks) tasks.onMine(bid);
  prog.onMine(breakState.removedBlocks.length); // 大框架: 阶段进度
  breakState.removedBlocks.length = 0;
  // M27: 被挖掉的宝箱 → 内容物掉落到地面
  for (const rc of breakState.removedChests) {
    const c = chestMgr.remove(rc.tx, rc.ty);
    if (c) {
      if (openChest === c) closeChestUI();
      for (const s of c.slots) {
        if (!s.blockId || s.count <= 0) continue;
        breakState.drops.push({
          x: rc.tx * TILE_SIZE + TILE_SIZE / 2,
          y: rc.ty * TILE_SIZE + TILE_SIZE / 2,
          vx: (Math.random() - 0.5) * 100,
          vy: -80 - Math.random() * 80,
          blockId: s.blockId, life: 60,
        });
      }
    }
  }
  breakState.removedChests.length = 0;
  breakState.removedThisFrame = 0;

  // 放置
  if (mouseRightEdge && mouseTile) {
    const selected = inv.getSelected();
    if (selected.count > 0 && selected.blockId) {
      const existing = getBlock(mouseTile.x, mouseTile.y);
      if (existing === 'empty') {
        const placeId = selected.blockId;
        // 禁止把方块放到自己身上（会导致人物卡进墙里）
        const blockedByPlayer = isSolid(placeId) && playerOverlapsTile(player, mouseTile.x, mouseTile.y);
        if (blockedByPlayer) {
          fishingMsg = '不能把方块放在自己身上';
          fishingMsgTimer = 1.5;
        } else {
          // M31: 种子 → 种植作物
          const cropDef = cropMgr.cropBySeed(placeId);
          if (cropDef) {
            setBlock(mouseTile.x, mouseTile.y, cropDef.stages[0]);
            cropMgr.plant(mouseTile.x, mouseTile.y, cropDef.id);
            inv.consumeSelected(1);
            sfx.place();
            fishingMsg = `🌱 已种下 ${cropDef.name}（约 ${cropDef.stageDuration * (cropDef.stages.length - 1)} 秒成熟）`;
            fishingMsgTimer = 2.5;
          } else {
            setBlock(mouseTile.x, mouseTile.y, placeId);
            inv.consumeSelected(1);
            // M27: 放置宝箱 → 建立储物数据
            if (placeId === 'chest') chestMgr.create(mouseTile.x, mouseTile.y);
            // M32: 放置定居旗 → 建立定居点
            if (placeId === 'settlement_flag') {
              settlementMgr.placeFlag(mouseTile.x, mouseTile.y);
              fishingMsg = `🏠 定居点已建立！每 ${SETTLE_INTERVAL} 秒会有定居者搬来`;
              fishingMsgTimer = 4;
            }
            sfx.place();
          }
        }
      }
    }
  }

  // M9b: 掉落物理 + 拾取 + M9a: 伤害数字更新
  updateDropPhysics(dt);
  updateDmgTexts(dt);

  // M19: 收藏家成就 — 每 2s 检查背包不同方块种类
  achCheckTimer -= dt;
  if (achCheckTimer <= 0) {
    achCheckTimer = 2;
    const uniqueBlocks = new Set<string>();
    for (const s of [...inv.hotbar, ...inv.slots]) {
      if (s.blockId && s.count > 0) uniqueBlocks.add(s.blockId);
    }
    ach.setProgress('collect_10', uniqueBlocks.size);
  }

  // 工具自动切换
  const sel = inv.getSelected();
  if (sel.count > 0 && TOOLS[sel.blockId]) px.toolName = sel.blockId;

  // ========== 黑雾同化系统 ==========
  voidEngine.updatePurifyTorches(terrain.tiles);
  // M15: 虚空裂隙事件 → 黑雾加速 ×3；同化之心饰品有 voidResistance 减免
  const buffLocal = acc.getAggregatedBuff();
  let voidMult = 1;
  if (ev.isEvent('void_rift')) {
    voidMult = 3 * (1 - (buffLocal.voidResistance ?? 0)); // 抗性 30% → 实际 3×0.7=2.1×
  }
  voidEngine.update(dt, renderer.timeOfDay, terrain.tiles, setBlock, voidMult);

  // ========== Boss 系统 ==========
  updateBossesSystem(dt);

  // ========== 大框架: 地牢守卫 ==========
  updateDungeonGate();

  // ========== 敌人系统 ==========
  updateEnemiesSystem(dt, effectivePower);

  // M18: 玩家远程弹丸更新
  updatePlayerProjectiles(dt);

  // ========== AI 队友 ==========
  updateCompanionsSystem(dt);

  updateHUD();
}

function updateEnemiesSystem(dt: number, _effectivePower: number) {
  if (playerInvulnerable > 0) {
    playerInvulnerable -= dt;
    player.x += playerKnockback.vx * dt;
    player.y += playerKnockback.vy * dt;
    playerKnockback.vx *= 0.85;
    playerKnockback.vy += 1400 * dt;
  }

  spawnTimer -= dt;
  const isNight = renderer.timeOfDay > 0.55 || renderer.timeOfDay < 0.1;
  if (spawnTimer <= 0) {
    spawnTimer = isNight ? 3 : 8;
    const params = { timeOfDay: renderer.timeOfDay, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT, cameraX: cam.x, cameraY: cam.y, cameraW: cam.width, cameraH: cam.height, getBlock, isSolid: getTileSolid };
    enemies.push(...trySpawnEnemy(enemies, 1, player, params));
  }

  for (const e of enemies) {
    updateEnemy(e, {
      dt,
      player: { x: player.x, y: player.y, width: player.width, height: player.height, onGround: player.onGround },
      isSolid: getTileSolid,
      onHitPlayer: (damage, dir, enemyId) => {
        if (playerInvulnerable > 0) return;
        // 锈躯壳灼烧反击
        if (shellMgr.current.passiveKey === 'burn' && !px.hurtEnemies.has(enemyId)) {
          px.hurtEnemies.add(enemyId);
          hitEnemy(e, 3, 80, -dir as 1 | -1);
        }
        const dmg = reduceDamage(damage);
        player.hp = Math.max(0, player.hp - dmg);
        shellMgr.currentState.hp = player.hp;
        playerInvulnerable = 0.6;
        playerKnockback.vx = dir * 180;
        playerKnockback.vy = -180;
        if (player.hp <= 0) respawnPlayer();
      },
    });
  }

  // 玩家反击
  if (isPlayerSwingingWeapon()) {
    const sword = TOOLS[px.toolName];
    const reach = 28;
    const hitHalfW = 22;
    const attackX = player.x + player.facing * (player.width / 2 + reach / 2);
    const attackY = player.y;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.state === 'dead') continue;
      if (Math.abs(e.x - attackX) < hitHalfW && Math.abs(e.y - attackY) < 24) {
        const buffLocal = acc.getAggregatedBuff();
        const achBuff = ach.getAggregatedBuff();
        const isNight = renderer.timeOfDay > 0.55 || renderer.timeOfDay < 0.1;
        const meleeDmg = (sword.damage + shellMgr.current.damage * 0.5)
          * (achBuff.damageMult ?? 1) * (isNight ? (achBuff.nightDamageMult ?? 1) : 1)
          * currentPotionBuff.damageMult * (armorMgr.getAggregatedBuff().damageMult ?? 1);
        const baseCrit = 0.10 + (buffLocal.critBonus ?? 0) + (achBuff.critBonus ?? 0)
          + (armorMgr.getAggregatedBuff().critBonus ?? 0);
        const died = hitEnemy(e, meleeDmg, 160, player.facing as 1 | -1);
        spawnDmgText(e.x, e.y - e.def.height / 2, meleeDmg, '#ff8040', baseCrit, 1.5 * (buffLocal.critDamageMult ?? 1));
        sfx.hitEnemy();
        // M16: 毒刺护符 — 剑击附加持续伤害
        if (buffLocal.poisonDps && buffLocal.poisonDuration) {
          e.dotDps = buffLocal.poisonDps;
          e.dotDuration = buffLocal.poisonDuration;
          e.dotTick = 0;
          spawnDmgText(e.x, e.y - e.def.height / 2 - 14, buffLocal.poisonDps, '#60c040', 0, 1);
        }
        if (died) {
          tasks.onKill(false); // M17: 击杀敌人任务
          prog.onKill(); // 大框架: 阶段进度
          ach.addProgress('kill_50', 1); // M19: 战士成就
          if (trial.active) trial.enemyDied(); // M21: 试炼计数
          sfx.enemyDie();
          if (e.def.dropTable) {
            const dropMultM = 1 + (ach.getAggregatedBuff().dropChanceBonus ?? 0);
            for (const drop of e.def.dropTable) {
              if (Math.random() < drop.chance * dropMultM) {
                for (let k = 0; k < drop.count; k++) {
                  breakState.drops.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 120, vy: -100 - Math.random() * 80, blockId: drop.blockId, life: 30 });
                }
              }
            }
          }
          // M13: 精英敌人有 accessoryDropChance 命中则掉随机普通饰品
          if (e.isElite && e.def.accessoryDropChance && Math.random() < e.def.accessoryDropChance) {
            const REGULAR_ACCESSORIES = ['dash_boots', 'regen_ring', 'defense_charm', 'magnet_crystal', 'speed_glove', 'wing_charm'];
            const picked = REGULAR_ACCESSORIES[Math.floor(Math.random() * REGULAR_ACCESSORIES.length)];
            breakState.drops.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 180, vy: -160, blockId: picked, life: 60 });
          }
        }
      }
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].state === 'dead' && enemies[i].deathProgress >= 1) enemies.splice(i, 1);
  }
}

function isPlayerSwingingWeapon(): boolean {
  if (swingCd > 0) return false; // M16: 冷却中不能攻击
  const tool = TOOLS[px.toolName];
  // M18: 远程武器射击（消耗弹药）
  if (tool.category === 'ranged') {
    if (mouseLeft && tool.ammoType) {
      if (inv.count(tool.ammoType) <= 0) return false; // 没弹药
      // M30: 魔力消耗检查
      if (tool.manaCost) {
        if (player.mana < tool.manaCost) return false;
        player.mana -= tool.manaCost;
      }
      inv.consume(tool.ammoType, 1);
      // 朝鼠标方向发射
      const dx = mouseWorldX - player.x, dy = mouseWorldY - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      const spd = tool.projectileSpeed ?? 500;
      const isArrow = tool.ammoType === 'wooden_arrow';
      const isNight = renderer.timeOfDay > 0.55 || renderer.timeOfDay < 0.1;
      const achBuffR = ach.getAggregatedBuff();
      const rangedDmg = (tool.damage + shellMgr.current.damage * 0.5)
        * (achBuffR.damageMult ?? 1) * (achBuffR.rangedDamageMult ?? 1)
        * (isNight ? (achBuffR.nightDamageMult ?? 1) : 1)
        * currentPotionBuff.damageMult * (armorMgr.getAggregatedBuff().damageMult ?? 1);
      playerProjectiles.push({
        x: player.x, y: player.y - 8,
        vx: (dx / dist) * spd, vy: (dy / dist) * spd,
        damage: rangedDmg,
        piercing: !!tool.piercing,
        color: isArrow ? '#d8b060' : '#a040e8',
        size: isArrow ? 4 : 6,
        life: 1.5,
        hitIds: new Set<number>(),
      });
      sfx.swing();
      swingCd = (tool.shootCooldown ?? 0.5) / (acc.getAggregatedBuff().attackSpeedBonus ?? 1);
      rangedAnim = RANGED_ANIM_DUR;
      return true;
    }
    return false;
  }
  // 近战（sword）
  if (mouseLeft && tool.category === 'sword') {
    if (!(window as any).__swingSfxPlayed) {
      sfx.swing(); (window as any).__swingSfxPlayed = true;
    }
    const buffLocal = acc.getAggregatedBuff();
    swingCd = 0.35 / (buffLocal.attackSpeedBonus ?? 1);
    meleeAnim = MELEE_ANIM_DUR;
    return true;
  }
  (window as any).__swingSfxPlayed = false;
  return false;
}

// ========== 玩家远程弹丸更新（M18） ==========
function updatePlayerProjectiles(dt: number) {
  for (let i = playerProjectiles.length - 1; i >= 0; i--) {
    const p = playerProjectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    // 出界或超时
    if (p.life <= 0 || p.x < 0 || p.x > MAP_WIDTH * TILE_SIZE || p.y < 0 || p.y > MAP_HEIGHT * TILE_SIZE) {
      playerProjectiles.splice(i, 1);
      continue;
    }
    // 命中敌人
    let hitSomething = false;
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      if (p.hitIds.has(e.id)) continue; // 穿透弹丸不重复打同一目标
      if (Math.abs(e.x - p.x) < e.def.width / 2 + p.size && Math.abs(e.y - p.y) < e.def.height / 2 + p.size) {
        const buffLocal = acc.getAggregatedBuff();
        const baseCrit = 0.10 + (buffLocal.critBonus ?? 0);
        const died = hitEnemy(e, p.damage, 80, p.vx > 0 ? 1 : -1);
        spawnDmgText(e.x, e.y - e.def.height / 2, p.damage, p.color, baseCrit, 1.5 * (buffLocal.critDamageMult ?? 1));
        sfx.hitEnemy();
        p.hitIds.add(e.id);
        if (died) {
          tasks.onKill(false);
          prog.onKill(); // 大框架: 阶段进度
          ach.addProgress('kill_50', 1);
          ach.addProgress('ranged_kill_20', 1); // M19: 神射手成就
          if (trial.active) trial.enemyDied(); // M21: 试炼计数
          sfx.enemyDie();
          if (e.def.dropTable) {
            const dropMult = 1 + (ach.getAggregatedBuff().dropChanceBonus ?? 0);
            for (const drop of e.def.dropTable) {
              if (Math.random() < drop.chance * dropMult) {
                for (let k = 0; k < drop.count; k++) {
                  breakState.drops.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 120, vy: -100 - Math.random() * 80, blockId: drop.blockId, life: 30 });
                }
              }
            }
          }
          if (e.isElite && e.def.accessoryDropChance && Math.random() < e.def.accessoryDropChance) {
            const REG = ['dash_boots', 'regen_ring', 'defense_charm', 'magnet_crystal', 'speed_glove', 'wing_charm'];
            breakState.drops.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 180, vy: -160, blockId: REG[Math.floor(Math.random() * REG.length)], life: 60 });
          }
        }
        if (!p.piercing) { hitSomething = true; break; }
      }
    }
    // 命中 Boss
    if (!hitSomething) {
      for (const b of bosses) {
        if (b.isDead) continue;
        if (p.hitIds.has(-b.id - 1000)) continue;
        if (Math.abs(b.x - p.x) < bossHalfW(b) + p.size && Math.abs(b.y - p.y) < bossHalfH(b) + p.size) {
          const buffLocal = acc.getAggregatedBuff();
          const baseCrit = 0.12 + (buffLocal.critBonus ?? 0);
          hitBoss(b, p.damage, 50, p.vx > 0 ? 1 : -1);
          spawnDmgText(b.x, b.y - bossHalfH(b), p.damage, p.color, baseCrit, 1.5 * (buffLocal.critDamageMult ?? 1));
          p.hitIds.add(-b.id - 1000);
          if (!p.piercing) { hitSomething = true; break; }
        }
      }
    }
    if (hitSomething) playerProjectiles.splice(i, 1);
  }
}

// ========== 区块故事引导（M8b） ==========
const REGION_GUIDANCE: Record<string, { subtitle: string; goal: string; hint: string }> = {
  'wreck_zone': { subtitle: '残骸带', goal: '搜刮残骸碎片与铜矿', hint: '破坏 wrec_scrap → 8 个铜矿 + 2 残骸碎片 = 铜镐' },
  'crack_waste': { subtitle: '龟裂荒原', goal: '小心夜行者风蝎', hint: '白天几乎没有敌人，趁白天挖矿' },
  'gobi_mine': { subtitle: '戈壁矿脉', goal: '三层矿带 → 铁脉 / 金矿', hint: '向下挖 85→100→115 深度可找到铜→铁→金' },
  'silent_sea': { subtitle: '无声海', goal: '金属湖上的浮游金属体', hint: '液态金属可从上方穿越（不造成伤害）' },
  'beast_hive': { subtitle: '异兽巢穴', goal: '甲壳蜂巢与幽蓝荧光囊', hint: 'chitin_hive 可招募骸兵队友' },
  'underground_valley': { subtitle: '地底幽谷', goal: '暗能量结界 + 叛军据点', hint: '⚠ 靠近紫色暗能量区可召唤 Boss（按 R）' },
};

function initStoryGuides() {
  // 计算晶体祭坛中心
  const altar = terrain.structures.find(s => s.kind === 'crystal_altar');
  if (altar) {
    _altarCenter = {
      x: (altar.x + altar.width / 2) * TILE_SIZE,
      y: (altar.y + altar.height / 2) * TILE_SIZE,
    };
  }
  // 岩石泰坦祭坛中心（gobi_mine 深层）
  const rockAltar = terrain.structures.find(s => s.kind === 'rock_altar');
  if (rockAltar) {
    _rockAltarCenter = {
      x: (rockAltar.x + rockAltar.width / 2) * TILE_SIZE,
      y: (rockAltar.y + rockAltar.height / 2) * TILE_SIZE,
    };
  }
  // 找最近 void_barrier 作为参考点（简单用第一个就行）
  const spot = findNearestVoidBarrier(terrain.tiles, MAP_WIDTH * TILE_SIZE - 400, terrain.heightMap[MAP_WIDTH - 30] * TILE_SIZE);
  if (spot) _barrierCenter = spot;
}

function getRegionGuidance(playerCol: number): { subtitle: string; goal: string; hint: string; bossHint: string } {
  let region = 'wreck_zone';
  if (playerCol >= 120 && playerCol < 180) region = 'gobi_mine';
  else if (playerCol >= 60 && playerCol < 120) region = 'crack_waste';
  else if (playerCol >= 180 && playerCol < 240) region = 'silent_sea';
  else if (playerCol >= 240 && playerCol < 300) region = 'beast_hive';
  else if (playerCol >= 300) region = 'underground_valley';
  const g = REGION_GUIDANCE[region] ?? REGION_GUIDANCE['wreck_zone'];

  // Boss 召唤提示（按距离最近优先）
  let bossHint = '';

  // 1. 最近 rock_altar（gobi_mine）
  if (_rockAltarCenter) {
    const d2 = (_rockAltarCenter.x - player.x) ** 2 + (_rockAltarCenter.y - player.y) ** 2;
    if (d2 < (24 * TILE_SIZE) ** 2) {
      bossHint = d2 < (18 * TILE_SIZE) ** 2
        ? '⛰ [按 R] 召唤 岩石泰坦'
        : `⛰ 岩石祭坛 距离 ${Math.sqrt(d2) | 0} / 360px`;
    }
  }
  // 2. 最近 crystal_altar（underground_valley）
  if (!bossHint && _altarCenter) {
    const d2 = (_altarCenter.x - player.x) ** 2 + (_altarCenter.y - player.y) ** 2;
    if (d2 < (20 * TILE_SIZE) ** 2) {
      bossHint = d2 < (15 * TILE_SIZE) ** 2
        ? '💎 [按 R] 召唤 幽紫晶体守卫'
        : `💎 晶体祭坛 距离 ${Math.sqrt(d2) | 0} / 240px`;
    }
  }
  // 3. void_barrier 兜底
  if (!bossHint && _barrierCenter) {
    const d2 = (_barrierCenter.x - player.x) ** 2 + (_barrierCenter.y - player.y) ** 2;
    if (d2 < (20 * TILE_SIZE) ** 2) {
      bossHint = d2 < (15 * TILE_SIZE) ** 2
        ? '☠ [按 R] 召唤 黑雾同化体'
        : `☠ 暗能量结界 距离 ${Math.sqrt(d2) | 0} / 240px`;
    }
  }
  return { ...g, bossHint };
}
function respawnPlayer() {
  player.hp = player.maxHp;
  shellMgr.currentState.hp = player.hp;
  placePlayerOnGround(player, terrain.heightMap);
  player.vx = player.vy = 0;
  playerInvulnerable = 2;
  if (trial.active) trial.fail(); // M21: 试炼失败
}

/** M11: 饰品减伤 + M15 闪避几率（shadow_cowl 25%）*/
function reduceDamage(damage: number): number {
  const buff = acc.getAggregatedBuff();
  const armorBuff = armorMgr.getAggregatedBuff(); // M26
  // M15: dodgeChance（暗影兜帽 25% 几率完全豁免）
  if (buff.dodgeChance && Math.random() < buff.dodgeChance) {
    spawnDmgText(player.x, player.y - player.height / 2, 0, '#a080e0', 0, 1);
    return 0; // 完全闪避
  }
  // M26: 护甲固定防御（泰拉瑞亚式：damage - defense*0.5）
  const defense = armorMgr.getTotalDefense();
  let dmg = damage - defense * 0.5;
  const reduction = (buff.damageReduction ?? 0) + currentPotionBuff.defenseReduction
    + (armorBuff.damageReduction ?? 0);
  dmg = dmg * (1 - reduction);
  return Math.max(1, Math.round(dmg));
}

function render() {
  const ctx = renderer.ctx;
  const { ox, oy } = getShakeOffset(cam);
  renderer.clear();

  // 震屏偏移：世界层（地形/实体）偏移，HUD 固定屏幕
  ctx.save();
  ctx.translate(ox, oy);
  renderer.drawBackground(cam, terrain.heightMap);
  renderer.drawScenery(cam, terrain.tiles, terrain.heightMap);
  renderer.drawWorld(terrain.tiles, cam, breakState, terrain.heightMap);

  // M15: 世界事件滤镜层（在震屏偏移内）
  renderer.drawEventOverlay(ev.current);

  // 同化进度紫色覆盖层
  renderer.drawVoidProgressOverlay(cam, voidEngine);

  if (!inputBlocked) {
    if (mouseRight && mouseTile) {
      const sel = inv.getSelected();
      if (sel.count > 0 && sel.blockId && BLOCKS[sel.blockId]) {
        const below = getBlock(mouseTile.x, mouseTile.y);
        renderer.drawPlacementGhost(sel.blockId, mouseTile.x, mouseTile.y, cam, below !== 'empty');
      }
    }
    if (mouseTile) {
      const sx = mouseTile.x * TILE_SIZE - cam.x + TILE_SIZE / 2;
      const sy = mouseTile.y * TILE_SIZE - cam.y + TILE_SIZE / 2;
      renderer.drawCrosshair(sx, sy);
    }
  }

  // 金躯壳荧光光环（passive glow）
  if (shellMgr.current.passiveKey === 'glow') {
    renderer.drawGlowAura(player, cam);
  }

  renderer.drawEnemies(enemies, cam);
  renderer.drawBossProjectiles(bossProjectiles, cam);
  // M18: 玩家弹丸渲染
  for (const p of playerProjectiles) {
    const sx = Math.floor(p.x - cam.x), sy = Math.floor(p.y - cam.y);
    renderer.ctx.fillStyle = p.color;
    renderer.ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    // 拖尾
    renderer.ctx.fillStyle = p.color + '80';
    renderer.ctx.fillRect(sx - p.vx * 0.01 - 1, sy - p.vy * 0.01 - 1, p.size + 2, p.size + 2);
  }
  for (const b of bosses) renderer.drawBoss(b, cam);
  renderer.drawVoidParticles(cam, voidEngine);
  renderer.drawCompanions(companions, cam);
  renderer.drawCompanionProjs(compProjs, cam);
  renderer.drawMount(player, cam);
  renderer.drawFishing(fishing.active, fishing.hasBite, fishing.floatX, fishing.floatY, player.x, player.y, cam);
  if (activePet) renderer.drawPet(activePet, cam);
  // 角色动作状态：走跑 / 跳跃 / 挥砍 / 采矿摆动 / 远程瞄准
  const renderTool = TOOLS[px.toolName];
  const mining = breakState.targetTile !== null;
  const attackAnim = meleeAnim > 0
    ? meleeAnim / MELEE_ANIM_DUR
    : mining
      ? 0.5 + 0.5 * Math.sin(performance.now() / 110)
      : rangedAnim > 0
        ? (rangedAnim / RANGED_ANIM_DUR) * 0.45
        : 0;
  const aimAngle = renderTool.category === 'ranged'
    ? Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x)
    : undefined;
  renderer.drawPlayer(player, cam, shellMgr.current, shellMgr.alpha, {
    moving: Math.abs(player.vx) > 25,
    onGround: player.onGround,
    sprint: input.sprint && Math.abs(player.vx) > 120,
    attack: attackAnim,
    aim: aimAngle,
  });
  // 光照层：地下黑暗 + 光源挖洞（泰拉瑞亚式观感）
  renderer.drawLighting(cam, terrain.tiles, terrain.heightMap, player.x, player.y);
  renderer.drawDamageTexts(dmgTexts, cam);

  // 恢复 — HUD 层不受震屏
  ctx.restore();

  // HUD（固定屏幕位置）
  renderer.drawPlayerHUD(player.hp, player.maxHp, shellMgr.current.name, shellMgr.switchCooldown, playerInvulnerable > 0, acc);
  renderer.drawBossHUD(bosses.filter(b => !b.isDead), player.x, player.y);
  // M15: 事件 HUD（固定屏幕位置）
  if (ev.current) renderer.drawEventHUD(ev.current);
  // M17: 任务 HUD + 完成弹窗
  renderer.drawQuestHUD(tasks.quests);
  if (questPopup) renderer.drawQuestPopup(questPopup.text);
  // M19: 成就 HUD + 解锁弹窗
  renderer.drawAchievementHUD(ach.achievements);
  if (achPopup) renderer.drawAchievementPopup(achPopup.text);
  // M20: 商店面板
  if (shopOpenLocal) renderer.drawShop(activeShop, inv.count('gold_coin'), shopMsg);
  // M21: 试炼 HUD + 消息
  if (trial.active || trialMsg) renderer.drawTrialHUD(trial, trialMsg);
  // M22: 药水 buff HUD
  renderer.drawPotionBuffs(player.activeBuffs);
  renderer.drawHotbar(inv);
  if (showMinimap) renderer.drawMinimap(cam, terrain.tiles, player.x, player.y);
  refreshStoryUI();
}

// ========== 剧情字幕 UI ==========
function refreshStoryUI() {
  const cur = story.current;
  if (!cur) {
    if (lastStoryId) {
      lastStoryId = '';
      storyEl.classList.add('hidden');
    }
    return;
  }
  if (cur.entry.id === lastStoryId) return;
  lastStoryId = cur.entry.id;
  storyTitleEl.textContent = cur.entry.title;
  storyLinesEl.innerHTML = cur.entry.lines.map(l => `<div>${l}</div>`).join('');
  storyEl.classList.remove('hidden', 'story-in');
  void storyEl.offsetWidth; // 触发重排，保证动画重播
  storyEl.classList.add('story-in');
}

function updateHUD() {
  const pcol = Math.floor(player.x / TILE_SIZE);
  const prow = Math.floor(player.y / TILE_SIZE);
  const tool = TOOLS[px.toolName];
  const s = shellMgr.current;
  const sIdx = shellMgr.currentIdx;
  const sList = SHELLS.map((sh, i) => `${i === sIdx ? '✓' : ' '}${sh.name}`).join(' | ');

  const cd = shellMgr.switchCooldown > 0 ? ` [冷却 ${shellMgr.switchCooldown.toFixed(1)}s]` : '';
  const guide = getRegionGuidance(pcol);

  if (inputBlocked) { hudBlock.textContent = '工作台已打开 (ESC 关闭)'; hudRegion.textContent = `区块: ${regionNameAt(pcol)} · ${guide.subtitle}`; return; }

  hudPos.textContent = `坐标: (${pcol}, ${prow}) | FPS: ${fpsNow} | 时间: ${formatTime(renderer.timeOfDay)} | ${s.name}${cd}`;

  // 黑雾警告
  const voidNearby = voidEngine.getProgress(pcol, prow);
  if (voidNearby > 0) {
    hudPos.textContent += ` | ⚠ 黑雾污染 ${(voidNearby * 100).toFixed(0)}%`;
  }

  if (mouseTile) {
    const id = getBlock(mouseTile.x, mouseTile.y);
    const def = BLOCKS[id];
    if (def && id !== 'empty') {
      const curTool = TOOLS[px.toolName];
      const canBreak = curTool.pickaxePower + (s.passiveKey === 'pickaxe' ? 1 : 0) >= def.toolLevel;
      hudBlock.textContent = `方块: ${def.name} (硬度 ${def.hardness} · 需镐Lv${def.toolLevel} ${canBreak ? '✓' : '✗'})`;
    } else {
      hudBlock.textContent = `当前工具: ${tool.name} · ${tool.category} | 被动: ${s.passive}`;
    }
  } else {
    hudBlock.textContent = `${tool.name} (速度 ${tool.miningSpeed}/s) · 被动: ${s.passive}`;
  }
  // M24: 钓鱼消息
  if (fishingMsg) hudBlock.textContent = `🎣 ${fishingMsg}`;

  // 故事引导 HUD（区块目标 + Boss 召唤提示）
  const guideParts: string[] = [`${regionNameAt(pcol)} · ${guide.subtitle} · 目标: ${guide.goal}`];
  if (guide.bossHint) guideParts.push(guide.bossHint);
  guideParts.push(prog.hudText); // 大框架: 阶段主线
  hudRegion.textContent = guideParts.join(' | ');

  // M26: 护甲栏 HUD
  const armorBar = document.getElementById('armor-bar') || createArmorBar();
  const slotTxt = (id: string | null, label: string) => id ? `${label}${ARMOR_DEFS[id].name}` : `${label}—`;
  const activeSets = armorMgr.getActiveSets().map(s => ARMOR_SETS[s].name);
  const defVal = armorMgr.getTotalDefense();
  armorBar.textContent = `[O 装备/卸下] 防御 ${defVal} | ${slotTxt(armorMgr.head, '头:')} ${slotTxt(armorMgr.chest, '胸:')} ${slotTxt(armorMgr.legs, '腿:')}`
    + (activeSets.length ? ` ★${activeSets.join('/')}套装生效` : '');

  // M30: 魔力条 + 永久成长进度
  const mpBar = document.getElementById('mp-bar') || createMpBar();
  const mpPct = player.maxMana > 0 ? Math.round((player.mana / player.maxMana) * 100) : 0;
  mpBar.innerHTML = `✦ 魔力 ${Math.floor(player.mana)} / ${player.maxMana}`
    + `<div style="height:4px;background:#222;margin-top:2px;border-radius:2px;overflow:hidden;">`
    + `<div style="height:100%;width:${mpPct}%;background:linear-gradient(90deg,#3a8ad8,#7ad4e8);"></div></div>`
    + `<span style="color:#888;font-size:10px;">❤${growth.hpUses}/${LIFE_CRYSTAL_MAX_USES} · ✦${growth.mpUses}/${MANA_CRYSTAL_MAX_USES} · [U] 使用水晶</span>`;

  // 躯壳选择条（右下角）
  const bar = document.getElementById('shell-bar') || createShellBar();
  bar.innerHTML = sList;
  (bar as HTMLElement).textContent = `[Tab 切换] ${sList}`;
}

function createArmorBar(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'armor-bar';
  el.style.cssText = 'position:fixed;left:12px;bottom:64px;font:11px monospace;color:#d8c8a0;'
    + 'background:rgba(10,10,14,0.6);padding:3px 8px;border-radius:4px;pointer-events:none;z-index:20;';
  document.body.appendChild(el);
  return el;
}

// M30: 魔力条容器
function createMpBar(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'mp-bar';
  el.style.cssText = 'position:fixed;left:12px;bottom:86px;font:11px monospace;color:#a8d8ff;'
    + 'background:rgba(10,10,14,0.6);padding:3px 8px;border-radius:4px;'
    + 'pointer-events:none;z-index:20;min-width:210px;';
  document.body.appendChild(el);
  return el;
}

function createShellBar(): HTMLDivElement {
  const bar = document.createElement('div');
  bar.id = 'shell-bar';
  bar.style.cssText = 'position:fixed;bottom:56px;left:50%;transform:translateX(-50%);background:rgba(26,16,8,0.9);border:1px solid #5a3828;border-radius:3px;padding:4px 12px;font-size:11px;color:#c8b898;pointer-events:none;z-index:40;';
  document.body.appendChild(bar);
  return bar;
}

function formatTime(t: number): string {
  const h = Math.floor(t * 24);
  const m = Math.floor((t * 24 - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ========== Boss 召唤（M7/M12：三个 Boss，按距离最近优先检测）==========
function trySummonBoss() {
  if (bosses.length > 0) return;
  if (bossSpawnCooldown > 0) return;

  // 收集所有可召唤的祭坛候选
  const candidates: { kind: string; ax: number; ay: number; costCheck: () => boolean; costText: string; summon: () => void; }[] = [];

  // 1. rock_titan 祭坛（gobi_mine 深层）
  const rockAltar = terrain.structures.find(s => s.kind === 'rock_altar');
  if (rockAltar) {
    const ax = (rockAltar.x + rockAltar.width / 2) * TILE_SIZE;
    const ay = (rockAltar.y + rockAltar.height / 2) * TILE_SIZE;
    candidates.push({
      kind: 'rock_titan',
      ax, ay,
      costCheck: () => inv.count('ore_rock') >= 8 && inv.count('ore_gold') >= 3,
      costText: '8 矿岩 + 3 金矿',
      summon: () => {
        inv.consume('ore_rock', 8);
        inv.consume('ore_gold', 3);
        const boss = createBoss('rock_titan', ax, ay - 40);
        bosses.push(boss);
        shake(cam, 6);
        sfx.bossSummon();
        story.show(BOSS_STORY.rock_titan_summon); // 剧情：泰坦苏醒
        console.log('[Boss] ⛰ 岩石泰坦 已苏醒！');
      },
    });
  }

  // 2. crystal_warden 祭坛（underground_valley）
  const crystalAltar = terrain.structures.find(s => s.kind === 'crystal_altar');
  if (crystalAltar) {
    const ax = (crystalAltar.x + crystalAltar.width / 2) * TILE_SIZE;
    const ay = (crystalAltar.y + crystalAltar.height / 2) * TILE_SIZE;
    candidates.push({
      kind: 'crystal_warden',
      ax, ay,
      costCheck: () => inv.count('dark_seed') >= 5 && inv.count('void_crystal') >= 3,
      costText: '5 暗种 + 3 虚空晶体',
      summon: () => {
        inv.consume('dark_seed', 5);
        inv.consume('void_crystal', 3);
        const boss = createBoss('crystal_warden', ax, ay - 40);
        bosses.push(boss);
        sfx.bossSummon();
        story.show(BOSS_STORY.crystal_warden_summon); // 剧情：晶体守卫成形
        console.log('[Boss] 💎 幽紫晶体守卫 已降临！');
      },
    });
  }

  // 3. 骷髅王祭坛（地牢竖井口，未击败时无消耗召唤）
  const skelAltar = terrain.structures.find(s => s.kind === 'skeleton_altar');
  if (skelAltar && !prog.skeletonDefeated) {
    const ax = (skelAltar.x + 0.5) * TILE_SIZE;
    const ay = skelAltar.y * TILE_SIZE;
    candidates.push({
      kind: 'skeleton_king',
      ax, ay,
      costCheck: () => true,
      costText: '无',
      summon: () => {
        bosses.push(createBoss('skeleton_king', ax, ay - 40));
        shake(cam, 6);
        sfx.bossSummon();
        story.show(BOSS_STORY.skeleton_king_summon); // 剧情：骷髅王登场
        fishingMsg = '💀 骷髅王苏醒了！击败它才能解开地牢之门';
        fishingMsgTimer = 4;
        console.log('[Boss] 💀 骷髅王 已苏醒！');
      },
    });
  }

  // 4. void_assimilator（靠近暗能量结界）
  const barrier = findNearestVoidBarrier(terrain.tiles, player.x, player.y);
  if (barrier) {
    candidates.push({
      kind: 'void_assimilator',
      ax: barrier.x, ay: barrier.y,
      costCheck: () => inv.count('dark_filament') >= 3,
      costText: '3 暗能丝',
      summon: () => {
        inv.consume('dark_filament', 3);
        const boss = createBoss('void_assimilator', barrier.x, barrier.y - 30);
        bosses.push(boss);
        sfx.bossSummon();
        story.show(BOSS_STORY.void_assimilator_summon); // 剧情：同化体降临
        console.log('[Boss] ☠ 黑雾同化体 已降临！');
      },
    });
  }

  if (candidates.length === 0) {
    console.warn('[Boss] 附近没有可召唤 Boss 的祭坛或结界');
    return;
  }

  // 找距离最近的候选
  let best = candidates[0];
  let bestD2 = (best.ax - player.x) ** 2 + (best.ay - player.y) ** 2;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    const d2 = (c.ax - player.x) ** 2 + (c.ay - player.y) ** 2;
    if (d2 < bestD2) { bestD2 = d2; best = c; }
  }

  // 距离判定（rock_altar 较大，范围放宽到 20TILE）
  const range = best.kind === 'rock_titan' ? (20 * TILE_SIZE) : (15 * TILE_SIZE);
  if (bestD2 > range * range) {
    console.warn(`[Boss] 太远了，靠近 ${best.kind === 'rock_titan' ? '岩石祭坛' : best.kind === 'crystal_warden' ? '晶体祭坛' : '暗能量结界'}`);
    return;
  }

  if (!best.costCheck()) {
    console.warn(`[Boss·${best.kind}] 需要 ${best.costText}`);
    return;
  }

  best.summon();
  bossSpawnCooldown = 30;
}

// ========== 大框架: 地牢门锁 / 守卫 / 战利品 ==========

/** 骷髅王倒下：全图地牢门化为空气，解除门锁 */
function unlockDungeon() {
  let opened = 0;
  for (let ty = 0; ty < MAP_HEIGHT; ty++) {
    for (let tx = 0; tx < MAP_WIDTH; tx++) {
      if (biToBlock(terrain.tiles[ty * MAP_WIDTH + tx]) === 'dungeon_door') {
        setBlock(tx, ty, 'empty');
        opened++;
      }
    }
  }
  shake(cam, 8);
  sfx.pickup();
  fishingMsg = '🔓 地牢之门已被解开！';
  fishingMsgTimer = 5;
  console.log(`[地牢] 门锁解除，共打开 ${opened} 格`);
}

/** 玩家闯入地牢且未击败骷髅王 → 生成守卫（接触秒杀，几乎不可击杀） */
function updateDungeonGate() {
  const d = terrain.structures.find(s => s.kind === 'dungeon');
  if (!d) return;
  const tx = Math.floor(player.x / TILE_SIZE);
  const ty = Math.floor(player.y / TILE_SIZE);
  const inside = tx >= d.x + 2 && tx < d.x + d.width - 2 && ty >= d.y + 2 && ty < d.y + d.height - 2;
  if (!inside) return;

  prog.enterDungeon();
  if (prog.skeletonDefeated) return;

  const hasGuardian = enemies.some(e => e.def.type === 'dungeon_guardian' && e.state !== 'dead');
  if (hasGuardian) return;

  const gx = (d.x + d.width / 2) * TILE_SIZE;
  const gy = (d.y + d.height - 3) * TILE_SIZE;
  enemies.push(createEnemy('dungeon_guardian', gx, gy));
  shake(cam, 9);
  sfx.bossSummon();
  if (!guardianWarned) {
    guardianWarned = true;
    story.show(BOSS_STORY.dungeon_guardian); // 剧情：守卫警告
    fishingMsg = '☠ 地牢守卫被惊醒了！击败骷髅王之前不要踏入地牢！';
    fishingMsgTimer = 5;
  }
  console.log('[地牢] ☠ 地牢守卫苏醒');
}

/** 新地图首次生成：给地牢宝箱预填战利品 */
function initDungeonLoot() {
  const d = terrain.structures.find(s => s.kind === 'dungeon');
  if (!d) return;
  let idx = 0;
  for (let ty = d.y; ty < d.y + d.height; ty++) {
    for (let tx = d.x; tx < d.x + d.width; tx++) {
      if (getBlock(tx, ty) !== 'chest') continue;
      if (chestMgr.get(tx, ty)) continue;
      const c = chestMgr.create(tx, ty);
      addToSlots(c.slots, idx === 0 ? 'life_crystal' : 'mana_crystal', 1);
      for (const item of rollChestLoot()) addToSlots(c.slots, item.blockId, item.count);
      addToSlots(c.slots, 'gold_coin', 5 + Math.floor(Math.random() * 10));
      idx++;
    }
  }
  console.log(`[地牢] 已预填 ${idx} 个宝箱战利品`);
}

// ========== Boss 更新 ==========
function updateBossesSystem(dt: number) {
  if (bossSpawnCooldown > 0) bossSpawnCooldown -= dt;

  // M14: 夜间 Boss 自动刷新
  const isNight = renderer.timeOfDay > 0.55 || renderer.timeOfDay < 0.1;
  // 刚进入夜间：重置已刷列表
  if (isNight !== lastNightState) {
    if (isNight) nightBossSpawnedRegions.clear();
    lastNightState = isNight;
  }
  nightBossSpawnCooldown -= dt;
  if (isNight && nightBossSpawnCooldown <= 0 && bosses.length < 5) {
    nightBossSpawnCooldown = 8 + Math.random() * 7; // 8-15 秒
    // 找区块对应夜间 Boss
    const playerCol = Math.floor(player.x / TILE_SIZE);
    let region = 'wreck_zone';
    if (playerCol < 60) region = 'wreck_zone';
    else if (playerCol < 120) region = 'crack_waste';
    else if (playerCol < 180) region = 'gobi_mine';
    else if (playerCol < 240) region = 'silent_sea';
    else if (playerCol < 300) region = 'beast_hive';
    else region = 'underground_valley';
    if (nightBossSpawnedRegions.has(region)) return; // 本夜已刷过
    // M15: 血月 ×2；沙暴/幽光潮/虚空裂隙 ×1.5
    let spawnChance = 0.05;
    if (ev.isEvent('blood_moon')) spawnChance = 0.10;
    else if (ev.isEvent('sandstorm') || ev.isEvent('glow_tide') || ev.isEvent('void_rift')) spawnChance = 0.075;
    if (Math.random() < spawnChance) {
      const NIGHT_BOSS_MAP: Record<string, string> = {
        wreck_zone: 'night_wreck_chief',
        crack_waste: 'storm_titan',
        gobi_mine: 'magma_golem',
        silent_sea: 'frost_kraken',
        beast_hive: 'hive_overlord',
        underground_valley: 'shadow_lich',
      };
      const bossId = NIGHT_BOSS_MAP[region];
      if (bossId) {
        // 在玩家附近 15-25 tile 处刷新
        const spawnCol = Math.max(2, Math.min(MAP_WIDTH - 2, playerCol + (Math.random() < 0.5 ? -1 : 1) * (15 + Math.floor(Math.random() * 10))));
        const spawnY = (terrain.heightMap[Math.max(0, Math.min(MAP_WIDTH - 1, spawnCol))] + 1) * TILE_SIZE;
        const b = createBoss(bossId, spawnCol * TILE_SIZE, spawnY - 40);
        bosses.push(b);
        nightBossSpawnedRegions.add(region);
        shake(cam, 4);
        sfx.bossSummon();
        console.log(`[夜间Boss] ⚠ ${b.def.name} 在你的 ${region} 区域出现！`);
      }
    }
  }

  // Boss AI
  for (const boss of bosses) {
    if (boss.isDead) continue;
    const projs = updateBoss(boss, {
      dt,
      player: { x: player.x, y: player.y, width: player.width, height: player.height, onGround: player.onGround },
      isSolid: getTileSolid,
      spawnEnemy: (type, x, y) => { enemies.push(createEnemy(type, x, y)); },
      onHitPlayer: (damage) => {
        if (playerInvulnerable > 0) return;
        const dmg = reduceDamage(damage);
        player.hp = Math.max(0, player.hp - dmg);
        shellMgr.currentState.hp = player.hp;
        playerInvulnerable = 0.6;
        if (player.hp <= 0) respawnPlayer();
      },
      onShakePlayer: (intensity) => shake(cam, intensity),
    });
    bossProjectiles.push(...projs);

    // 玩家反击（剑砍命中 Boss）
    if (isPlayerSwingingWeapon()) {
      const attackX = player.x + player.facing * (player.width / 2 + 32);
      const attackY = player.y;
      if (Math.abs(attackX - boss.x) < bossHalfW(boss) + 10 &&
          Math.abs(attackY - boss.y) < bossHalfH(boss) + 10) {
        const buffLocal = acc.getAggregatedBuff();
        const achBuffB = ach.getAggregatedBuff();
        const isNightB = renderer.timeOfDay > 0.55 || renderer.timeOfDay < 0.1;
        const bossDmg = (TOOLS[px.toolName].damage + shellMgr.current.damage * 0.5)
          * (achBuffB.damageMult ?? 1) * (isNightB ? (achBuffB.nightDamageMult ?? 1) : 1)
          * currentPotionBuff.damageMult * (armorMgr.getAggregatedBuff().damageMult ?? 1);
        const baseCrit = 0.12 + (buffLocal.critBonus ?? 0) + (achBuffB.critBonus ?? 0)
          + (armorMgr.getAggregatedBuff().critBonus ?? 0);
        const died = hitBoss(boss, bossDmg, 80, player.facing as 1 | -1);
        spawnDmgText(boss.x, boss.y - bossHalfH(boss), bossDmg, '#c040e8', baseCrit, 1.5 * (buffLocal.critDamageMult ?? 1));
        if (died) {
          tasks.onKill(true, !!boss.def.isNightBoss); // M17: 击杀 Boss 任务
          prog.onBossKill(boss.def.id); // 大框架: 阶段进度
          if (boss.def.id === 'skeleton_king') {
            unlockDungeon();
            story.show(BOSS_STORY.skeleton_king_defeat); // 剧情：门开
          }
          // M19: 成就
          ach.addProgress('kill_boss_1', 1);
          ach.addProgress('all_bosses', 1);
          if (boss.def.isNightBoss) ach.addProgress('kill_night_boss_1', 1);
          if (trial.active) trial.bossDied(); // M21: 试炼计数
          // 击败掉落（按 Boss 类型区分）
          if (boss.def.isNightBoss) {
            // M14: 夜间 Boss 专属掉落
            const NIGHT_BOSS_LOOT: Record<string, { accessory: string; mats: string[] }> = {
              night_wreck_chief: { accessory: 'wreck_warlord_medal', mats: ['ore_iron', 'wreck_scrap', 'ore_copper'] },
              storm_titan: { accessory: 'storm_banner', mats: ['wind_rock', 'ore_iron', 'cracked_ground'] },
              magma_golem: { accessory: 'magma_core', mats: ['ore_rock', 'ore_gold', 'ore_iron'] },
              frost_kraken: { accessory: 'frost_veil', mats: ['crystal_glow', 'liquid_metal', 'metal_float'] },
              hive_overlord: { accessory: 'hive_stinger', mats: ['chitin_hive', 'bio_glow', 'dark_seed'] },
              shadow_lich: { accessory: 'shadow_cowl', mats: ['dark_seed', 'dark_filament', 'void_crystal'] },
            };
            const loot = NIGHT_BOSS_LOOT[boss.def.id] ?? NIGHT_BOSS_LOOT['night_wreck_chief'];
            // 材料掉落（每种 1-2 个）
            for (let i = 0; i < 3; i++) {
              const blockId = loot.mats[i];
              const count = 1 + Math.floor(Math.random() * 2);
              for (let k = 0; k < count; k++) {
                breakState.drops.push({
                  x: boss.x + (Math.random() - 0.5) * 60,
                  y: boss.y + (Math.random() - 0.5) * 40,
                  vx: (Math.random() - 0.5) * 140,
                  vy: -100 - Math.random() * 80,
                  blockId, life: 60,
                });
              }
            }
            // 专属饰品 100%
            breakState.drops.push({ x: boss.x, y: boss.y - 40, vx: 0, vy: -180, blockId: loot.accessory, life: 60 });
            shake(cam, 6);
            sfx.bossDie();
            console.log(`[夜间Boss] ✅ ${boss.def.name} 已倒下！→ ${loot.accessory}`);
          } else if (boss.def.id === 'rock_titan') {
            shake(cam, 12);
            breakState.drops.push({ x: boss.x, y: boss.y, vx: 0, vy: -100, blockId: 'ore_gold', life: 60 });
            breakState.drops.push({ x: boss.x + 20, y: boss.y, vx: 50, vy: -80, blockId: 'ore_gold', life: 60 });
            breakState.drops.push({ x: boss.x - 20, y: boss.y, vx: -50, vy: -80, blockId: 'void_crystal', life: 60 });
            breakState.drops.push({ x: boss.x + 40, y: boss.y, vx: 80, vy: -120, blockId: 'dark_filament', life: 60 });
            // M13: 100% 岩石泰坦王冠
            breakState.drops.push({ x: boss.x, y: boss.y - 30, vx: 0, vy: -160, blockId: 'rock_titan_crown', life: 60 });
            purifyNearbyVoidBarrier(boss.x, boss.y);
            sfx.bossDie();
            story.show(BOSS_STORY.rock_titan_defeat); // 剧情：泰坦崩塌
            console.log('[Boss] ✅ 岩石泰坦 已崩塌！→ 岩石泰坦王冠');
          } else if (boss.def.id === 'crystal_warden') {
            breakState.drops.push({ x: boss.x, y: boss.y, vx: 0, vy: -100, blockId: 'void_crystal', life: 60 });
            breakState.drops.push({ x: boss.x + 20, y: boss.y, vx: 50, vy: -80, blockId: 'void_crystal', life: 60 });
            breakState.drops.push({ x: boss.x - 20, y: boss.y, vx: -50, vy: -80, blockId: 'dark_seed', life: 60 });
            // M13: 100% 晶守核心
            breakState.drops.push({ x: boss.x, y: boss.y - 30, vx: 0, vy: -160, blockId: 'crystal_warden_core', life: 60 });
            purifyNearbyVoidBarrier(boss.x, boss.y);
            sfx.bossDie();
            story.show(BOSS_STORY.crystal_warden_defeat); // 剧情：净化完成
            console.log('[Boss] ✅ 幽紫晶体守卫 已被净化！→ 晶守核心');
          } else if (boss.def.id === 'skeleton_king') {
            // 大框架: 骷髅王专属掉落（地牢钥匙主题）
            breakState.drops.push({ x: boss.x, y: boss.y, vx: 0, vy: -100, blockId: 'gold_coin', life: 60 });
            breakState.drops.push({ x: boss.x + 20, y: boss.y, vx: 50, vy: -80, blockId: 'gold_coin', life: 60 });
            breakState.drops.push({ x: boss.x - 20, y: boss.y, vx: -50, vy: -80, blockId: 'dungeon_brick', life: 60 });
            breakState.drops.push({ x: boss.x, y: boss.y - 30, vx: 0, vy: -160, blockId: 'life_crystal', life: 60 });
            sfx.bossDie();
            console.log('[Boss] 💀 骷髅王 已倒下！地牢之门开启');
          } else {
            breakState.drops.push({ x: boss.x, y: boss.y, vx: 0, vy: -100, blockId: 'dark_seed', life: 60 });
            breakState.drops.push({ x: boss.x + 20, y: boss.y, vx: 50, vy: -80, blockId: 'dark_seed', life: 60 });
            breakState.drops.push({ x: boss.x - 20, y: boss.y, vx: -50, vy: -80, blockId: 'dark_filament', life: 60 });
            // M13: 100% 同化之心
            breakState.drops.push({ x: boss.x, y: boss.y - 30, vx: 0, vy: -160, blockId: 'void_assimilator_heart', life: 60 });
            purifyNearbyVoidBarrier(boss.x, boss.y);
            sfx.bossDie();
            story.show(BOSS_STORY.void_assimilator_defeat); // 剧情：同化失败
            console.log('[Boss] ✅ 黑雾同化体 已被净化！→ 同化之心');
          }
          // M13: 每个 Boss 30% 概率额外掉 1 件随机普通饰品
          if (Math.random() < 0.30) {
            const REGULAR = ['dash_boots', 'regen_ring', 'defense_charm', 'magnet_crystal', 'speed_glove', 'wing_charm'];
            const picked = REGULAR[Math.floor(Math.random() * REGULAR.length)];
            breakState.drops.push({ x: boss.x + 30, y: boss.y, vx: 80, vy: -150, blockId: picked, life: 60 });
          }
        }
      }
    }
  }

  // 清理死亡 Boss
  for (let i = bosses.length - 1; i >= 0; i--) {
    if (bosses[i].isDead && bosses[i].deathProgress >= 1) bosses.splice(i, 1);
  }

  // 弹幕更新
  bossProjectiles.splice(0, bossProjectiles.length, ...updateProjectiles(bossProjectiles, dt, player, (dmg) => {
    if (playerInvulnerable > 0) return;
    const finalDmg = reduceDamage(dmg);
    player.hp = Math.max(0, player.hp - finalDmg);
    shellMgr.currentState.hp = player.hp;
    playerInvulnerable = 0.4;
    if (player.hp <= 0) respawnPlayer();
  }));
}

function purifyNearbyVoidBarrier(bx: number, by: number) {
  const blockIds = ['empty', 'wreck_scrap', 'wreck_hull', 'ember_ash', 'fire_crack',
    'wind_rock', 'cracked_ground', 'surface_dust', 'desert_ground',
    'ore_rock', 'ore_copper', 'ore_iron', 'ore_gold',
    'deep_rock', 'crystal_glow', 'void_crystal',
    'liquid_metal', 'metal_float',
    'chitin_hive', 'bio_glow',
    'rebel_brick', 'void_barrier',
    'dark_seed', 'dark_filament', 'purify_torch'];
  const vbIdx = blockIds.indexOf('void_barrier');
  const tx = Math.floor(bx / TILE_SIZE), ty = Math.floor(by / TILE_SIZE);
  for (let dx = -8; dx <= 8; dx++) {
    for (let dy = -8; dy <= 8; dy++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
      if ((dx * dx + dy * dy) > 64) continue;
      if (terrain.tiles[y * MAP_WIDTH + x] === vbIdx) {
        setBlock(x, y, 'ore_rock');
      }
    }
  }
}

// ========== AI 队友初始化（M7：从 terrain.structures 读取） ==========
function initCompanions() {
  if (companionsInitialized) return;
  companionsInitialized = true;

  // 区块 → NPC 类型映射
  const regionNpcPool: Record<string, string[]> = {
    wreck_zone: ['iron_guard', 'rust_archer'],
    crack_waste: ['bone_scout', 'rust_archer'],
    gobi_mine: ['iron_guard', 'cold_engineer'],
    silent_sea: ['cold_engineer', 'ember_mage'],
    beast_hive: ['bone_scout'],
    underground_valley: ['iron_guard', 'ember_mage', 'cold_engineer'],
  };

  // 每个 hut/camp 门口放 1 个 civilian
  for (const s of terrain.structures) {
    if (s.kind === 'crystal_altar') continue;
    const pool = regionNpcPool[s.region] ?? ['iron_guard'];
    const npcId = pool[Math.floor(Math.random() * pool.length)];
    // 门口 = 结构底部中心
    const doorX = (s.x + Math.floor(s.width / 2)) * TILE_SIZE + TILE_SIZE / 2;
    const doorY = (s.y + s.height) * TILE_SIZE;
    companions.push(createCivilian(npcId, doorX, doorY));
  }
}

// ========== 招募 ==========
function tryRecruitCompanion() {
  const followCount = companions.filter(c => c.state === 'follow' && c.hp > 0).length;
  if (followCount >= 2) { console.warn('[队友] 已满员（最多 2 人）'); return; }
  // 找最近的 civilian
  let nearest: Companion | null = null;
  let bestD = 200 * 200;
  for (const c of companions) {
    if (c.state !== 'civilian') continue;
    if (c.hp <= 0) continue;
    const d2 = (c.x - player.x) ** 2 + (c.y - player.y) ** 2;
    if (d2 < bestD) { bestD = d2; nearest = c; }
  }
  if (!nearest) { console.warn('[队友] 附近没有可招募的 NPC'); return; }
  if (bestD > 100 * 100) { console.warn('[队友] 走远一点（靠近 NPC）'); return; }
  const cost = nearest.def.recruitCost;
  if (cost && inv.count(cost.blockId) < cost.count) {
    console.warn(`[队友] 需要 ${cost.count} 个 ${cost.blockId}`); return;
  }
  if (cost) inv.consume(cost.blockId, cost.count);
  recruitCompanion(nearest);
  sfx.recruit();
  console.log(`[队友] ✅ ${nearest.def.name} 已加入队伍！`);
}

// ========== 队友 AI ==========
function updateCompanionsSystem(dt: number) {
  const enemiesForComp = enemies.map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp }));
  for (const c of companions) {
    if (c.hp <= 0) continue;
    updateCompanion(c, {
      dt,
      player: { x: player.x, y: player.y },
      enemies: enemiesForComp,
      isSolid: getTileSolid,
      onProj: (x, y, vx, vy, damage, ownerId) => {
        compProjs.push({ x, y, vx, vy, damage, ownerId, life: 0, maxLife: 2 });
      },
    });
    // 近战队友命中敌人
    if (c.state === 'attack' && c.def.weapon === 'melee' && c.attackTimer > 0.5 && c.attackTimer < 0.7) {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (Math.abs(e.x - c.x) < 30 && Math.abs(e.y - c.y) < 24) {
          hitEnemy(e, c.def.damage, 100, c.facing as 1 | -1);
        }
      }
    }
  }
  // 远程弹更新
  for (let i = compProjs.length - 1; i >= 0; i--) {
    const p = compProjs[i];
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life >= p.maxLife) { compProjs.splice(i, 1); continue; }
    // 命中敌人
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (Math.abs(p.x - e.x) < 16 && Math.abs(p.y - e.y) < 16) {
        hitEnemy(e, p.damage, 80, Math.sign(p.vx) as 1 | -1);
        compProjs.splice(i, 1);
        break;
      }
    }
    // 命中 Boss
    for (const b of bosses) {
      if (b.isDead) continue;
      if (Math.abs(p.x - b.x) < 30 && Math.abs(p.y - b.y) < 30) {
        hitBoss(b, p.damage, 50, Math.sign(p.vx) as 1 | -1);
        compProjs.splice(i, 1);
        break;
      }
    }
  }
}
