/**
 * 烬海纪元 · 音效系统
 * 用 WebAudio API 程序化生成短音效 — 不依赖外部文件
 * 支持开关（按 V 键）
 */

export class SfxEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private masterGain: GainNode | null = null;

  private ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch { /* AudioContext 不可用 */ }
  }

  toggle() { this.enabled = !this.enabled; }
  isEnabled() { return this.enabled; }

  private beep(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.3, slideTo?: number) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + duration);
    }
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  private noise(duration: number, volume = 0.25, lowpassFreq = 1200) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(this.masterGain!);
    src.start();
  }

  // === 具体音效 ===
  dig() { this.beep(440, 0.05, 'square', 0.2, 320); }
  digHard() { this.beep(220, 0.08, 'triangle', 0.3, 80); this.noise(0.06, 0.2, 800); }
  place() { this.beep(660, 0.06, 'triangle', 0.25, 880); }
  swing() { this.noise(0.08, 0.2, 2000); this.beep(320, 0.04, 'sawtooth', 0.15, 160); }
  hitEnemy() { this.beep(180, 0.1, 'square', 0.3, 80); this.noise(0.05, 0.15, 1000); }
  hitPlayer() { this.beep(120, 0.2, 'sawtooth', 0.35, 40); }
  enemyDie() { this.beep(520, 0.15, 'triangle', 0.2, 180); }
  bossSummon() {
    this.beep(110, 0.4, 'sawtooth', 0.3, 60);
    setTimeout(() => this.beep(80, 0.5, 'sawtooth', 0.3, 40), 150);
    setTimeout(() => this.noise(0.4, 0.15, 500), 200);
  }
  bossDie() {
    this.beep(440, 0.6, 'triangle', 0.35, 880);
    setTimeout(() => this.beep(660, 0.4, 'square', 0.25, 1320), 200);
  }
  pickup() { this.beep(880, 0.05, 'sine', 0.2, 1320); }
  shellSwitch() {
    this.beep(660, 0.08, 'sine', 0.2, 880);
    setTimeout(() => this.beep(990, 0.08, 'sine', 0.15, 1320), 60);
  }
  recruit() {
    this.beep(440, 0.1, 'triangle', 0.2, 660);
    setTimeout(() => this.beep(660, 0.1, 'triangle', 0.2, 880), 80);
    setTimeout(() => this.beep(880, 0.15, 'triangle', 0.2, 1100), 160);
  }
  voidSpread() { this.noise(0.3, 0.08, 400); this.beep(80, 0.3, 'sawtooth', 0.1, 40); }
  nightBegin() {
    this.beep(220, 0.4, 'sine', 0.15, 110);
    setTimeout(() => this.beep(165, 0.6, 'sine', 0.12, 82), 200);
  }
  error() { this.beep(200, 0.2, 'square', 0.25, 100); }
}

export const sfx = new SfxEngine();
