/**
 * 烬海纪元 · 工作台 UI（合成界面）
 * 对齐泰拉瑞亚：左背包 + 中配方 + 合成按钮
 * DOM 实现 — 不阻塞 Canvas，点击事件独立
 */
import { Inventory, ItemStack } from './inventory.js';
import { RECIPES, Recipe, canCraft, craft } from './crafting.js';
import { BLOCKS, isSolid } from './blocks.js';
import { TOOLS } from './tools.js';
import { PALETTE_MAP } from './palette.js';

export interface WorkbenchCallbacks {
  onOpen?(): void;
  onClose?(): void;
  onCraftSuccess?(recipe: Recipe): void;
  onCraftFail?(recipe: Recipe, reason: string): void;
}

export class WorkbenchUI {
  private container: HTMLDivElement;
  private invPanel: HTMLDivElement;
  private recipeList: HTMLDivElement;
  private recipeDetail: HTMLDivElement;
  private selectedRecipe: Recipe | null = null;
  public open = false;
  private nearWorkbench = true; // 先默认 true，后续接工作台方块判定

  constructor(private inv: Inventory, private callbacks: WorkbenchCallbacks = {}) {
    this.container = document.getElementById('workbench') as HTMLDivElement;
    this.invPanel = document.getElementById('wb-inventory') as HTMLDivElement;
    this.recipeList = document.getElementById('wb-recipes') as HTMLDivElement;
    this.recipeDetail = document.getElementById('wb-detail') as HTMLDivElement;
    this.buildInventoryGrid();
    this.buildRecipeList();
    this.buildRecipeDetail();
  }

  setNearWorkbench(v: boolean) { this.nearWorkbench = v; }

  toggle() {
    if (this.open) this.close(); else this.openWB();
  }

  openWB() {
    if (this.open) return;
    this.open = true;
    this.container.classList.remove('hidden');
    this.refresh();
    this.callbacks.onOpen?.();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.container.classList.add('hidden');
    this.callbacks.onClose?.();
  }

  refresh() {
    this.renderInventory();
    this.renderRecipeList();
    this.renderRecipeDetail();
  }

  // ========== DOM 构建 ==========
  private buildInventoryGrid() {
    this.invPanel.innerHTML = '';
    // 标题
    const title = document.createElement('div');
    title.className = 'wb-section-title';
    title.textContent = '背包';
    this.invPanel.appendChild(title);

    // 主背包 4×13 = 52 格
    const mainGrid = document.createElement('div');
    mainGrid.className = 'wb-grid';
    mainGrid.style.setProperty('--cols', '13');
    for (let i = 0; i < 52; i++) {
      mainGrid.appendChild(this.makeSlot(this.inv.slots[i]));
    }
    this.invPanel.appendChild(mainGrid);

    // 分隔
    const sep = document.createElement('div');
    sep.style.cssText = 'height:8px;';
    this.invPanel.appendChild(sep);

    // 快捷栏 9 格
    const hbTitle = document.createElement('div');
    hbTitle.className = 'wb-section-title';
    hbTitle.textContent = '快捷栏 (1-9)';
    this.invPanel.appendChild(hbTitle);

    const hbGrid = document.createElement('div');
    hbGrid.className = 'wb-grid';
    hbGrid.style.setProperty('--cols', '9');
    for (let i = 0; i < 9; i++) {
      hbGrid.appendChild(this.makeSlot(this.inv.hotbar[i]));
    }
    this.invPanel.appendChild(hbGrid);
  }

  private makeSlot(slot: ItemStack): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'wb-slot';
    if (slot.count > 0 && slot.blockId) {
      const def = BLOCKS[slot.blockId];
      const tool = TOOLS[slot.blockId];
      let paletteId: string;
      if (def) paletteId = def.paletteId;
      else if (tool) paletteId = tool.paletteId;
      else paletteId = 'iron02';

      const color = PALETTE_MAP.get(paletteId) ?? '#888';
      el.style.backgroundColor = color;
      // 暗边
      el.style.boxShadow = `inset 0 0 0 1px rgba(0,0,0,0.4)`;
      // 数量
      if (slot.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'wb-slot-count';
        cnt.textContent = String(slot.count);
        el.appendChild(cnt);
      }
      // tooltip
      const name = def?.name ?? tool?.name ?? slot.blockId;
      el.title = name;
    }
    return el;
  }

  private buildRecipeList() {
    this.recipeList.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'wb-section-title';
    title.textContent = '配方列表';
    this.recipeList.appendChild(title);

    const listDiv = document.createElement('div');
    listDiv.className = 'wb-recipe-list';
    for (let i = 0; i < RECIPES.length; i++) {
      const r = RECIPES[i];
      const el = document.createElement('div');
      el.className = 'wb-recipe-item';
      const def = BLOCKS[r.resultBlockId];
      const tool = TOOLS[r.resultBlockId];
      const name = def?.name ?? tool?.name ?? r.resultBlockId;
      el.textContent = `[${r.resultCount}×] ${name}`;
      el.dataset.idx = String(i);
      el.addEventListener('click', () => {
        this.selectedRecipe = RECIPES[i];
        this.renderRecipeList();
        this.renderRecipeDetail();
      });
      listDiv.appendChild(el);
    }
    this.recipeList.appendChild(listDiv);
  }

  private buildRecipeDetail() {
    this.recipeDetail.innerHTML = '';
  }

  // ========== 渲染 ==========
  private renderInventory() {
    // 重绘所有 slot 内容
    const grids = this.invPanel.querySelectorAll('.wb-grid');
    const mainSlots = grids[0].querySelectorAll('.wb-slot');
    const hbSlots = grids[1].querySelectorAll('.wb-slot');
    for (let i = 0; i < 52; i++) this.updateSlot(mainSlots[i] as HTMLDivElement, this.inv.slots[i]);
    for (let i = 0; i < 9; i++) this.updateSlot(hbSlots[i] as HTMLDivElement, this.inv.hotbar[i]);
  }

  private updateSlot(el: HTMLDivElement, slot: ItemStack) {
    el.innerHTML = '';
    el.style.backgroundColor = '';
    el.style.boxShadow = '';
    el.title = '';
    if (slot.count > 0 && slot.blockId) {
      const def = BLOCKS[slot.blockId];
      const tool = TOOLS[slot.blockId];
      let paletteId: string;
      if (def) paletteId = def.paletteId;
      else if (tool) paletteId = tool.paletteId;
      else paletteId = 'iron02';
      el.style.backgroundColor = PALETTE_MAP.get(paletteId) ?? '#888';
      el.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.4)';
      if (slot.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'wb-slot-count';
        cnt.textContent = String(slot.count);
        el.appendChild(cnt);
      }
      const name = def?.name ?? tool?.name ?? slot.blockId;
      el.title = name;
    }
  }

  private renderRecipeList() {
    const items = this.recipeList.querySelectorAll('.wb-recipe-item');
    items.forEach((el) => {
      const idx = Number((el as HTMLElement).dataset.idx);
      const r = RECIPES[idx];
      const ok = canCraft(r, this.inv, this.nearWorkbench);
      el.classList.toggle('wb-selected', this.selectedRecipe === r);
      el.classList.toggle('wb-available', ok);
      el.classList.toggle('wb-locked', !ok);
    });
  }

  private renderRecipeDetail() {
    const detail = this.recipeDetail;
    detail.innerHTML = '';

    if (!this.selectedRecipe) {
      const hint = document.createElement('div');
      hint.className = 'wb-hint';
      hint.textContent = '点击左侧配方查看详情';
      detail.appendChild(hint);
      return;
    }

    const r = this.selectedRecipe;
    const def = BLOCKS[r.resultBlockId];
    const tool = TOOLS[r.resultBlockId];
    const name = def?.name ?? tool?.name ?? r.resultBlockId;
    const ok = canCraft(r, this.inv, this.nearWorkbench);

    // 产物名
    const header = document.createElement('div');
    header.className = 'wb-detail-header';
    header.textContent = `[${r.resultCount}×] ${name}`;
    detail.appendChild(header);

    // 产物预览
    const preview = document.createElement('div');
    preview.className = 'wb-detail-preview';
    let paletteId = def?.paletteId ?? tool?.paletteId ?? 'iron02';
    preview.style.backgroundColor = PALETTE_MAP.get(paletteId) ?? '#888';
    detail.appendChild(preview);

    // 材料列表
    const matTitle = document.createElement('div');
    matTitle.className = 'wb-mat-title';
    matTitle.textContent = '所需材料:';
    detail.appendChild(matTitle);

    for (const ing of r.ingredients) {
      const row = document.createElement('div');
      row.className = 'wb-mat-row';
      const have = this.inv.count(ing.blockId);
      const enough = have >= ing.count;
      const iDef = BLOCKS[ing.blockId];
      const iTool = TOOLS[ing.blockId];
      const iName = iDef?.name ?? iTool?.name ?? ing.blockId;
      row.innerHTML = `
        <span class="wb-mat-color" style="background:${PALETTE_MAP.get(iDef?.paletteId ?? iTool?.paletteId ?? 'iron02') ?? '#888'}"></span>
        <span class="wb-mat-name">${iName}</span>
        <span class="wb-mat-count ${enough ? 'ok' : 'bad'}">${have} / ${ing.count}</span>
      `;
      detail.appendChild(row);
    }

    // 工作台要求
    if (r.requiresWorkbench && !this.nearWorkbench) {
      const warn = document.createElement('div');
      warn.className = 'wb-warn';
      warn.textContent = '⚠ 需要靠近工作台';
      detail.appendChild(warn);
    }

    // 合成按钮
    const btn = document.createElement('button');
    btn.className = `wb-craft-btn ${ok ? '' : 'wb-disabled'}`;
    btn.textContent = '合成 (C)';
    btn.disabled = !ok;
    btn.addEventListener('click', () => this.doCraft(1));
    detail.appendChild(btn);

    const btnMax = document.createElement('button');
    btnMax.className = `wb-craft-btn wb-secondary ${ok ? '' : 'wb-disabled'}`;
    btnMax.textContent = '全合成 (Shift+C)';
    btnMax.disabled = !ok;
    btnMax.addEventListener('click', () => this.doCraft(-1));
    detail.appendChild(btnMax);
  }

  /** 合成 count 次，-1 = 全部能合几次 */
  doCraft(count = 1): number {
    if (!this.selectedRecipe) return 0;
    const r = this.selectedRecipe;
    let times = count;
    if (times < 0) {
      // 计算能合几次
      let minTimes = Infinity;
      for (const ing of r.ingredients) {
        const t = Math.floor(this.inv.count(ing.blockId) / ing.count);
        if (t < minTimes) minTimes = t;
      }
      times = Math.max(0, minTimes);
    }

    let success = 0;
    for (let i = 0; i < times; i++) {
      if (canCraft(r, this.inv, this.nearWorkbench)) {
        if (craft(r, this.inv)) {
          success++;
          this.callbacks.onCraftSuccess?.(r);
        }
      }
    }

    if (success > 0) {
      this.refresh();
    } else {
      this.callbacks.onCraftFail?.(r, '材料不足或未靠近工作台');
    }
    return success;
  }

  /** 快捷键合成 */
  craftSelected(holdingShift = false) {
    return this.doCraft(holdingShift ? -1 : 1);
  }
}

// 未使用引用防告警
void isSolid;
