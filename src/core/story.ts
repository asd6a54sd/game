/**
 * 烬海纪元 · 剧情系统
 * ====================
 * 在阶段主线 / 区块探索 / Boss / NPC 四个节点上播放叙事文本
 * 所有条目只播放一次（存档记录已看过的 id），按队列顺序淡入淡出
 */

export interface StoryEntry {
  id: string;
  title: string;
  lines: string[];
  /** 展示时长（秒），默认 7.5 */
  duration?: number;
}

/** 序章 */
export const PROLOGUE: StoryEntry = {
  id: 'prologue',
  title: '序章 · 冷却舱的余温',
  lines: [
    '烬海历 47 年，坠舰「远望号」把一半身子插进了特恩无人区。',
    '你从冷却舱里醒来，记忆像被烧穿的地图，只剩下一个名字：烬海。',
    '活下去，然后把这片荒原翻个底朝天。',
  ],
};

/** 阶段主线剧情（key = progression.ts 的 stage.id） */
export const STAGE_STORY: Record<string, StoryEntry> = {
  awaken: {
    id: 'stage_awaken',
    title: '第一章 · 苏醒',
    lines: [
      '你第一次听见自己的心跳，还有远处黑雾的低语。',
      '先挖开脚下的废土，让这具躯壳站得住。',
    ],
  },
  foothold: {
    id: 'stage_foothold',
    title: '第二章 · 立足',
    lines: [
      '一块铁、一捧火，你把第一座工作台钉进土里。',
      '烬海不欢迎活人，但它承认会建造的人。',
    ],
  },
  long_night: {
    id: 'stage_long_night',
    title: '第三章 · 长夜',
    lines: [
      '黑雾在夜里醒来。没有火光的地方，都会被它悄悄舔掉。',
      '杀够多的东西，它才会暂时退回地缝里。',
    ],
  },
  overlord: {
    id: 'stage_overlord',
    title: '第四章 · 霸主',
    lines: [
      '荒原的旧主倒下了，躯壳里滚出一枚还在发烫的核心。',
      '它裂开的地方，露出通往更深处的缝隙。',
    ],
  },
  curse: {
    id: 'stage_curse',
    title: '第五章 · 诅咒',
    lines: [
      '骷髅王的冠冕下没有王座，只有一道锁。',
      '地底传来回声：「别打开那扇门。」',
    ],
  },
  dungeon: {
    id: 'stage_dungeon',
    title: '第六章 · 地牢',
    lines: [
      '门开了。砖缝里渗出的黑色，比夜更浓。',
      '特恩无人区的故事到此为止——深渊的故事刚刚开始。',
    ],
  },
};

/** 区块初见剧情（key = RegionId） */
export const REGION_STORY: Record<string, StoryEntry> = {
  wreck_zone: {
    id: 'region_wreck_zone',
    title: '烬落残骸带',
    lines: [
      '远望号的龙骨斜插在山脊上，余烬从断裂的舱壁里漏出来。',
      '每隔一会儿，风就把新的金属碎片吹到地表。',
    ],
  },
  crack_waste: {
    id: 'region_crack_waste',
    title: '龟裂荒原',
    lines: [
      '风把地裂吹成一张网。',
      '有老拾荒者说，脚下埋着一座被从地图上抹掉的城市。',
    ],
  },
  gobi_mine: {
    id: 'region_gobi_mine',
    title: '戈壁矿脉',
    lines: [
      '矿带像年轮一样分层：铜、铁、金，一层比一层安静。',
      '越往下，金属的颜色越不像这个世界该有的。',
    ],
  },
  silent_sea: {
    id: 'region_silent_sea',
    title: '无声海',
    lines: [
      '液态金属没有波纹，也没有回声。',
      '倒影里的你，总比真实的慢半拍。',
    ],
  },
  beast_hive: {
    id: 'region_beast_hive',
    title: '异兽巢穴',
    lines: [
      '甲壳摩擦的声音从蜂巢深处传来。',
      '它们不进食，只是守着一颗还在发光的卵。',
    ],
  },
  underground_valley: {
    id: 'region_underground_valley',
    title: '地底幽谷',
    lines: [
      '叛军把据点建在暗能量结界后面。',
      '他们不信地面上的人，但愿意用金币说话。',
    ],
  },
  frozen_waste: {
    id: 'region_frozen_waste',
    title: '霜蚀冻原',
    lines: [
      '风在这里结成霜，落在锈上，像给废土盖了一层薄薄的白布。',
      '冰层下面的永冻土，封存着比无人区更早的脚印。',
    ],
  },
  ash_volcano: {
    id: 'region_ash_volcano',
    title: '熔渣火山',
    lines: [
      '火山锥还在呼吸，每一次喷气都把新的灰撒向山脚。',
      '岩浆湖红得发沉——它记得这座废墟熔化的样子。',
    ],
  },
  rot_mire: {
    id: 'region_rot_mire',
    title: '腐蚀沼泽',
    lines: [
      '泥水没有流动的方向，只有孢子在空中慢慢亮起又熄灭。',
      '每一步都像踩在别人的骨头上。',
    ],
  },
  ashen_court: {
    id: 'region_ashen_court',
    title: '灰烬王庭',
    lines: [
      '地砖还剩一半，断柱间摆着早已冷透的火盆。',
      '这里曾有人加冕，现在只有灰在加冕。',
    ],
  },
  storm_rift: {
    id: 'region_storm_rift',
    title: '雷鸣裂谷',
    lines: [
      '雷不落向地面，而是沿着岩层里的雷晶一路奔跑。',
      '你听见脚下有电流在数你的脚步。',
    ],
  },
  ember_sanctum: {
    id: 'region_ember_sanctum',
    title: '余烬圣所',
    lines: [
      '青铜墙被烧成暖色，圣火却一盏都没熄。',
      '有人相信只要火还亮着，烬海就还没真正结束。',
    ],
  },
};

/** Boss 剧情（key 为自定义事件 id） */
export const BOSS_STORY: Record<string, StoryEntry> = {
  rock_titan_summon: {
    id: 'boss_rock_titan_summon',
    title: '岩石泰坦苏醒',
    lines: [
      '祭坛裂开，整座矿脉站了起来。',
      '它胸腔里的金脉还在跳。',
    ],
    duration: 6,
  },
  rock_titan_defeat: {
    id: 'boss_rock_titan_defeat',
    title: '泰坦崩塌',
    lines: [
      '岩石碎成雨，露出藏在核心里的王冠。',
      '矿脉安静了，仿佛刚才什么都没发生。',
    ],
    duration: 6,
  },
  crystal_warden_summon: {
    id: 'boss_crystal_warden_summon',
    title: '晶体守卫成形',
    lines: [
      '幽紫晶体在结界中央拼合、立起。',
      '它没有脸，却一直「看」着你。',
    ],
    duration: 6,
  },
  crystal_warden_defeat: {
    id: 'boss_crystal_warden_defeat',
    title: '净化完成',
    lines: [
      '晶体碎成无数个你，然后一并熄灭。',
      '暗能量退开，露出一条窄路。',
    ],
    duration: 6,
  },
  void_assimilator_summon: {
    id: 'boss_void_assimilator_summon',
    title: '黑雾同化体降临',
    lines: [
      '黑雾在结界上聚成人形，模仿着你的动作。',
      '它学得太像了，连伤口都一样。',
    ],
    duration: 6,
  },
  void_assimilator_defeat: {
    id: 'boss_void_assimilator_defeat',
    title: '同化失败',
    lines: [
      '同化体散成雾，结界后面露出一段旧路。',
      '你听见自己心跳的回声，比刚才多了一拍。',
    ],
    duration: 6,
  },
  dungeon_guardian: {
    id: 'boss_dungeon_guardian',
    title: '地牢守卫苏醒',
    lines: [
      '砖墙里渗出金属摩擦声。',
      '它不看守宝箱——它看守的是门后的东西。快退出去。',
    ],
    duration: 5.5,
  },
  skeleton_king_summon: {
    id: 'boss_skeleton_king_summon',
    title: '骷髅王苏醒了',
    lines: [
      '王座从祭坛下升起，冠冕缺了一角。',
      '它抬起剑指向你，像在确认一笔旧债。',
    ],
    duration: 6,
  },
  skeleton_king_defeat: {
    id: 'boss_skeleton_king_defeat',
    title: '地牢之门已开',
    lines: [
      '冠冕落地，门锁应声而开。',
      '地牢在下面等着——那里没有王座，只有更深的黑。',
    ],
    duration: 6.5,
  },
};

/** NPC 初见对话（key = NPC id） */
export const NPC_STORY: Record<string, StoryEntry> = {
  merchant: {
    id: 'npc_merchant',
    title: '流浪商人',
    lines: [
      '货摊被推到你的面前，铁皮上还沾着别人的血。',
      '「活人？稀客。东西都在台面上，价钱不还。」',
    ],
    duration: 6,
  },
  medic: {
    id: 'npc_medic',
    title: '医师',
    lines: [
      '医师扫了你一眼，眉头皱起来。',
      '「把手伸过来。……嗯，还能救。」',
    ],
    duration: 6,
  },
  engineer: {
    id: 'npc_engineer',
    title: '工程师',
    lines: [
      '工程师敲了敲你的护甲，发出空心的响。',
      '「你居然真把门打开了。想活久一点，就听我的。」',
    ],
    duration: 6,
  },
};

export interface StorySave {
  seen: string[];
}

export class StoryManager {
  seen = new Set<string>();
  current: { entry: StoryEntry; timer: number } | null = null;
  private queue: StoryEntry[] = [];

  hasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  /** 入队播放（once = true 时同一 id 只播放一次） */
  show(entry: StoryEntry | undefined, once = true) {
    if (!entry) return;
    if (once && this.seen.has(entry.id)) return;
    this.seen.add(entry.id);
    if (this.current?.entry.id === entry.id) return;
    if (this.queue.some(e => e.id === entry.id)) return;
    this.queue.push(entry);
    if (!this.current) this.next();
  }

  update(dt: number) {
    if (!this.current) {
      if (this.queue.length > 0) this.next();
      return;
    }
    this.current.timer -= dt;
    if (this.current.timer <= 0) {
      this.current = null;
      this.next();
    }
  }

  private next() {
    const e = this.queue.shift();
    this.current = e ? { entry: e, timer: e.duration ?? 7.5 } : null;
  }

  serialize(): StorySave {
    return { seen: Array.from(this.seen) };
  }

  restore(save: StorySave | undefined) {
    if (!save) return;
    for (const id of save.seen ?? []) this.seen.add(id);
  }
}
