/**
 * 烬海纪元 · 主入口
 * M0-M3: 工程骨架 + 破坏 + 背包 + 放置 + 工具 + 合成 + 敌人 AI + 躯壳切换
 */
import './style.css';
import { generateTerrain, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, biToBlock, regionNameAt } from './core/terrain.js';
import { BLOCKS, isSolid } from './core/blocks.js';
import { createCamera, follow } from './core/camera.js';
import { createPlayer, updatePlayer, placePlayerOnGround, Player } from './core/player.js';
import { Renderer } from './core/renderer.js';
import { createBreakState, startBreaking, stopBreaking, updateBreaking, updateParticles, BreakState } from './core/break.js';
import { Inventory } from './core/inventory.js';
import { TOOLS } from './core/tools.js';
import { WorkbenchUI } from './core/workbench.js';
import { Enemy, updateEnemy, hitEnemy, trySpawnEnemy } from './core/enemies.js';
import { ShellManager, SHELLS } from './core/shells.js';

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
});

// 躯壳
const shellMgr = new ShellManager();

// 敌人系统
const enemies: Enemy[] = [];
let spawnTimer = 0;
let playerInvulnerable = 0;
let playerKnockback = { vx: 0, vy: 0 };

// 输入
const input = { left: false, right: false, jump: false, brake: false };
let mouseTile: { x: number; y: number } | null = null;
let mouseLeft = false;
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
    }
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    mouseTile = { x: Math.floor((sx + cam.x) / TILE_SIZE), y: Math.floor((sy + cam.y) / TILE_SIZE) };
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

  // 日夜循环
  renderer.timeOfDay = (renderer.timeOfDay + dt / 240) % 1;

  // 玩家（躯壳属性覆盖）
  player.maxHp = shellMgr.current.baseHp;
  // 速度 & 跳跃：通过临时覆盖 player 后调用 updatePlayer
  const savedSpeed = player.moveSpeed ?? 180;
  const savedJump = player.jumpSpeed ?? 380;
  player.moveSpeed = shellMgr.current.speed;
  player.jumpSpeed = shellMgr.current.jumpSpeed;
  updatePlayer(player, dt, input, getTileSolid);
  player.moveSpeed = savedSpeed;
  player.jumpSpeed = savedJump;
  // 落地重置二段跳
  if (player.onGround) px.usedSecondJump = false;

  // 同步躯壳 state 的 HP
  shellMgr.currentState.hp = player.hp;

  // 摄像机
  follow(cam, player.x, player.y, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE);

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

  // 放置
  if (mouseRightEdge && mouseTile) {
    const selected = inv.getSelected();
    if (selected.count > 0 && selected.blockId) {
      const existing = getBlock(mouseTile.x, mouseTile.y);
      if (existing === 'empty') {
        setBlock(mouseTile.x, mouseTile.y, selected.blockId);
        inv.consumeSelected(1);
      }
    }
  }

  // 掉落拾取
  for (let i = breakState.drops.length - 1; i >= 0; i--) {
    const d = breakState.drops[i];
    const dx = d.x - player.x, dy = d.y - player.y;
    if (dx * dx + dy * dy < 28 * 28) {
      const picked = inv.add(d.blockId, 1);
      if (picked > 0) breakState.drops.splice(i, 1);
    }
  }

  // 工具自动切换
  const sel = inv.getSelected();
  if (sel.count > 0 && TOOLS[sel.blockId]) px.toolName = sel.blockId;

  // ========== 敌人系统 ==========
  updateEnemiesSystem(dt, effectivePower);

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
        player.hp = Math.max(0, player.hp - damage);
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
        const died = hitEnemy(e, sword.damage + shellMgr.current.damage * 0.5, 160, player.facing as 1 | -1);
        if (died && e.def.dropTable) {
          for (const drop of e.def.dropTable) {
            if (Math.random() < drop.chance) {
              for (let k = 0; k < drop.count; k++) {
                breakState.drops.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 120, vy: -100 - Math.random() * 80, blockId: drop.blockId, life: 30 });
              }
            }
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
  return mouseLeft && TOOLS[px.toolName].category === 'sword';
}

function respawnPlayer() {
  player.hp = player.maxHp;
  shellMgr.currentState.hp = player.hp;
  placePlayerOnGround(player, terrain.heightMap);
  player.vx = player.vy = 0;
  playerInvulnerable = 2;
}

function render() {
  renderer.clear();
  renderer.drawBackground(cam);
  renderer.drawWorld(terrain.tiles, cam, breakState);

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
  renderer.drawPlayer(player, cam, shellMgr.current, shellMgr.alpha);
  renderer.drawHotbar(inv);
}

function updateHUD() {
  const pcol = Math.floor(player.x / TILE_SIZE);
  const prow = Math.floor(player.y / TILE_SIZE);
  const tool = TOOLS[px.toolName];
  const s = shellMgr.current;
  const sIdx = shellMgr.currentIdx;
  const sList = SHELLS.map((sh, i) => `${i === sIdx ? '✓' : ' '}${sh.name}`).join(' | ');

  const cd = shellMgr.switchCooldown > 0 ? ` [冷却 ${shellMgr.switchCooldown.toFixed(1)}s]` : '';

  if (inputBlocked) { hudBlock.textContent = '工作台已打开 (ESC 关闭)'; hudRegion.textContent = `区块: ${regionNameAt(pcol)}`; return; }

  hudPos.textContent = `坐标: (${pcol}, ${prow}) | FPS: ${fpsNow} | 时间: ${formatTime(renderer.timeOfDay)} | ${s.name}${cd}`;

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
    hudRegion.textContent = `区块: ${regionNameAt(mouseTile.x)}`;
  } else {
    hudBlock.textContent = `${tool.name} (速度 ${tool.miningSpeed}/s) · 被动: ${s.passive}`;
    hudRegion.textContent = `区块: ${regionNameAt(pcol)}`;
  }

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
