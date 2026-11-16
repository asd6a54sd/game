/**
 * 烬海纪元 · 主入口
 * M0-M3: 工程骨架 + 破坏 + 背包 + 放置 + 工具 + 合成 + 敌人 AI + 躯壳切换
 */
import './style.css';
import { generateTerrain, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, biToBlock, regionNameAt } from './core/terrain.js';
import { BLOCKS, isSolid } from './core/blocks.js';
import { createCamera, follow, shake, updateShake, getShakeOffset } from './core/camera.js';
import { createPlayer, updatePlayer, placePlayerOnGround, Player } from './core/player.js';
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
import { createBoss, updateBoss, updateProjectiles, hitBoss, findNearestVoidBarrier, Boss, BossProjectile, bossHalfW, bossHalfH } from './core/bosses.js';
import { Companion, createCivilian, recruitCompanion, updateCompanion } from './core/companions.js';
import { sfx } from './core/sfx.js';
import { AccessoryManager, ACCESSORY_DEFS } from './core/accessories.js';
import { QuestManager, QuestState } from './core/tasks.js';

// ========== DOM ==========
const loading = document.getElementById('loading')!;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudPos = document.getElementById('hud-pos')!;
const hudBlock = document.getElementById('hud-block')!;
const hudRegion = document.getElementById('hud-region')!;

// ========== 状态 ==========
let terrain = generateTerrain(20261116);
const renderer = new Renderer(canvas);
let cam = createCamera(window.innerWidth, window.innerHeight);
let player = createPlayer();
let breakState: BreakState = createBreakState();
const inv = new Inventory();

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
  onCraftSuccess: (r) => { tasks.onCraft(r.resultBlockId, r.resultCount); }, // M17: 合成任务
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
let wasOnGround = false; // M16: 上一帧是否在地面（检测落地瞬间）
let lastRegion = '';     // M17: 玩家上一帧所在区块（检测区块变化）

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

// M15: 世界事件系统
const ev = new WorldEventManager();
ev.onEventStart = (e) => {
  console.log(`[事件] ✨ ${e.emoji} ${e.name} 开始！${e.desc}`);
  shake(cam, 5);
  sfx.bossSummon(); // 复用（事件触发也有紧张感）
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
const input = { left: false, right: false, jump: false, brake: false };
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
init();

async function init() {
  placePlayerOnGround(player, terrain.heightMap);
  voidEngine.initFromTerrain(terrain.tiles);
  initCompanions();
  initStoryGuides();
  resize();
  window.addEventListener('resize', resize);
  bindInput();
  bindWorkbenchClose();
  loading.classList.add('hidden');
  requestAnimationFrame(loop);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.resize(w, h);
  cam.width = w; cam.height = h;
}

function bindInput() {
  window.addEventListener('keydown', e => {
    if (inputBlocked) {
      if (e.code === 'Escape') wb.close();
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
      case 'ShiftLeft': case 'ShiftRight': input.brake = true; break;
      case 'Digit1': case 'Numpad1': inv.selectHotbar(0); break;
      case 'Digit2': case 'Numpad2': inv.selectHotbar(1); break;
      case 'Digit3': case 'Numpad3': inv.selectHotbar(2); break;
      case 'Digit4': case 'Numpad4': inv.selectHotbar(3); break;
      case 'Digit5': case 'Numpad5': inv.selectHotbar(4); break;
      case 'Digit6': case 'Numpad6': inv.selectHotbar(5); break;
      case 'Digit7': case 'Numpad7': inv.selectHotbar(6); break;
      case 'Digit8': case 'Numpad8': inv.selectHotbar(7); break;
      case 'Digit9': case 'Numpad9': inv.selectHotbar(8); break;
      case 'KeyE': wb.toggle(); break;
      case 'Escape': wb.close(); break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) shellMgr.prev();
        else shellMgr.next();
        applyShellToPlayer(true);
        sfx.shellSwitch();
        break;
      case 'KeyR':
        trySummonBoss();
        break;
      case 'KeyF':
        tryRecruitCompanion();
        break;
      case 'KeyM':
        showMinimap = !showMinimap;
        break;
      case 'KeyV':
        sfx.toggle();
        console.log(`[音效] ${sfx.isEnabled() ? '开启' : '关闭'}`);
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
      case 'ShiftLeft': case 'ShiftRight': input.brake = false; break;
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
  }

  // 日夜循环
  renderer.timeOfDay = (renderer.timeOfDay + dt / 240) % 1;

  // 玩家（躯壳属性 + 饰品 Buff）
  player.maxHp = shellMgr.current.baseHp;
  const buff = acc.getAggregatedBuff();

  // 速度：躯壳速度 × 饰品速度倍率
  const baseSpeed = shellMgr.current.speed * (buff.moveSpeedBonus ?? 1);
  const savedSpeed = player.moveSpeed ?? 180;
  const savedJump = player.jumpSpeed ?? 380;
  const savedGravityMult = player.gravityMult ?? 1;
  player.moveSpeed = baseSpeed;
  // M13: jumpBonus（rock_titan_crown）
  player.jumpSpeed = shellMgr.current.jumpSpeed * (buff.jumpBonus ?? 1);
  // M13: gravityReduction（rock_titan_crown）
  player.gravityMult = 1 - (buff.gravityReduction ?? 0);

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

  // M16: 攻击冷却 tick
  if (swingCd > 0) swingCd -= dt;

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
  wasOnGround = player.onGround;

  // 滑翔：空中按住跳跃键时限制下落速度
  if (!player.onGround && input.jump && buff.glideFallSpeed && player.vy > buff.glideFallSpeed) {
    player.vy = buff.glideFallSpeed;
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

  // 破坏系统（考虑躯壳镐等级加成）
  const effectivePower = TOOLS[px.toolName].pickaxePower + (shellMgr.current.passiveKey === 'pickaxe' ? 1 : 0);
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
  breakState.removedBlocks.length = 0;
  breakState.removedThisFrame = 0;

  // 放置
  if (mouseRightEdge && mouseTile) {
    const selected = inv.getSelected();
    if (selected.count > 0 && selected.blockId) {
      const existing = getBlock(mouseTile.x, mouseTile.y);
      if (existing === 'empty') {
        setBlock(mouseTile.x, mouseTile.y, selected.blockId);
        inv.consumeSelected(1);
        sfx.place();
      }
    }
  }

  // M9b: 掉落物理 + 拾取 + M9a: 伤害数字更新
  updateDropPhysics(dt);
  updateDmgTexts(dt);

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
        const baseCrit = 0.10 + (buffLocal.critBonus ?? 0);
        const died = hitEnemy(e, sword.damage + shellMgr.current.damage * 0.5, 160, player.facing as 1 | -1);
        spawnDmgText(e.x, e.y - e.def.height / 2, sword.damage + shellMgr.current.damage * 0.5, '#ff8040', baseCrit, 1.5 * (buffLocal.critDamageMult ?? 1));
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
          sfx.enemyDie();
          if (e.def.dropTable) {
            for (const drop of e.def.dropTable) {
              if (Math.random() < drop.chance) {
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
      inv.consume(tool.ammoType, 1);
      // 朝鼠标方向发射
      const dx = mouseWorldX - player.x, dy = mouseWorldY - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      const spd = tool.projectileSpeed ?? 500;
      const isArrow = tool.ammoType === 'wooden_arrow';
      playerProjectiles.push({
        x: player.x, y: player.y - 8,
        vx: (dx / dist) * spd, vy: (dy / dist) * spd,
        damage: tool.damage + shellMgr.current.damage * 0.5,
        piercing: !!tool.piercing,
        color: isArrow ? '#d8b060' : '#a040e8',
        size: isArrow ? 4 : 6,
        life: 1.5,
        hitIds: new Set<number>(),
      });
      sfx.swing();
      swingCd = (tool.shootCooldown ?? 0.5) / (acc.getAggregatedBuff().attackSpeedBonus ?? 1);
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
          sfx.enemyDie();
          if (e.def.dropTable) {
            for (const drop of e.def.dropTable) {
              if (Math.random() < drop.chance) {
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

// Boss 位置（缓存）
let _altarCenter: { x: number; y: number } | null = null;
let _barrierCenter: { x: number; y: number } | null = null;
let _rockAltarCenter: { x: number; y: number } | null = null;

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
}

/** M11: 饰品减伤 + M15 闪避几率（shadow_cowl 25%）*/
function reduceDamage(damage: number): number {
  const buff = acc.getAggregatedBuff();
  // M15: dodgeChance（暗影兜帽 25% 几率完全豁免）
  if (buff.dodgeChance && Math.random() < buff.dodgeChance) {
    spawnDmgText(player.x, player.y - player.height / 2, 0, '#a080e0', 0, 1);
    return 0; // 完全闪避
  }
  const reduction = buff.damageReduction ?? 0;
  return Math.max(1, Math.round(damage * (1 - reduction)));
}

function render() {
  const ctx = renderer.ctx;
  const { ox, oy } = getShakeOffset(cam);
  renderer.clear();

  // 震屏偏移：世界层（地形/实体）偏移，HUD 固定屏幕
  ctx.save();
  ctx.translate(ox, oy);
  renderer.drawBackground(cam);
  renderer.drawWorld(terrain.tiles, cam, breakState);

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
  renderer.drawPlayer(player, cam, shellMgr.current, shellMgr.alpha);
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
  renderer.drawHotbar(inv);
  if (showMinimap) renderer.drawMinimap(cam, terrain.tiles, player.x, player.y);
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

  // 故事引导 HUD（区块目标 + Boss 召唤提示）
  const guideParts: string[] = [`${regionNameAt(pcol)} · ${guide.subtitle} · 目标: ${guide.goal}`];
  if (guide.bossHint) guideParts.push(guide.bossHint);
  hudRegion.textContent = guideParts.join(' | ');

  // 躯壳选择条（右下角）
  const bar = document.getElementById('shell-bar') || createShellBar();
  bar.innerHTML = sList;
  (bar as HTMLElement).textContent = `[Tab 切换] ${sList}`;
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
        console.log('[Boss] 💎 幽紫晶体守卫 已降临！');
      },
    });
  }

  // 3. void_assimilator（靠近暗能量结界）
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
        const baseCrit = 0.12 + (buffLocal.critBonus ?? 0);
        const died = hitBoss(boss, TOOLS[px.toolName].damage + shellMgr.current.damage * 0.5, 80, player.facing as 1 | -1);
        spawnDmgText(boss.x, boss.y - bossHalfH(boss), TOOLS[px.toolName].damage + shellMgr.current.damage * 0.5, '#c040e8', baseCrit, 1.5 * (buffLocal.critDamageMult ?? 1));
        if (died) {
          tasks.onKill(true, !!boss.def.isNightBoss); // M17: 击杀 Boss 任务
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
            console.log('[Boss] ✅ 岩石泰坦 已崩塌！→ 岩石泰坦王冠');
          } else if (boss.def.id === 'crystal_warden') {
            breakState.drops.push({ x: boss.x, y: boss.y, vx: 0, vy: -100, blockId: 'void_crystal', life: 60 });
            breakState.drops.push({ x: boss.x + 20, y: boss.y, vx: 50, vy: -80, blockId: 'void_crystal', life: 60 });
            breakState.drops.push({ x: boss.x - 20, y: boss.y, vx: -50, vy: -80, blockId: 'dark_seed', life: 60 });
            // M13: 100% 晶守核心
            breakState.drops.push({ x: boss.x, y: boss.y - 30, vx: 0, vy: -160, blockId: 'crystal_warden_core', life: 60 });
            purifyNearbyVoidBarrier(boss.x, boss.y);
            sfx.bossDie();
            console.log('[Boss] ✅ 幽紫晶体守卫 已被净化！→ 晶守核心');
          } else {
            breakState.drops.push({ x: boss.x, y: boss.y, vx: 0, vy: -100, blockId: 'dark_seed', life: 60 });
            breakState.drops.push({ x: boss.x + 20, y: boss.y, vx: 50, vy: -80, blockId: 'dark_seed', life: 60 });
            breakState.drops.push({ x: boss.x - 20, y: boss.y, vx: -50, vy: -80, blockId: 'dark_filament', life: 60 });
            // M13: 100% 同化之心
            breakState.drops.push({ x: boss.x, y: boss.y - 30, vx: 0, vy: -160, blockId: 'void_assimilator_heart', life: 60 });
            purifyNearbyVoidBarrier(boss.x, boss.y);
            sfx.bossDie();
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
