export class SpeechPlayer {
  constructor({ synth, Utterance, voice, rate, onchange, onerror }) {
    Object.assign(this, { synth, Utterance, voice, rate, onchange, onerror });
    this.queue = [];
    this.index = 0;
    this.state = 'idle';
    this.epoch = 0;
    this.utterance = null;
  }
  stop() {
    this.epoch++;
    this.utterance = null;
    this.pendingEnd = false;
    this.synth.cancel();
    this.state = 'idle';
    this.onchange(this);
  }
  start(queue, index = 0) {
    this.stop();
    this.queue = queue;
    this.index = Math.max(0, Math.min(queue.length - 1, index));
    if (queue.length) this.speak();
  }
  speak() {
    const token = ++this.epoch;
    this.synth.cancel();
    const item = this.queue[this.index];
    if (!item) return this.stop();
    const voice = this.voice(item.text);
    if (!voice) {
      this.stop();
      this.onerror('没有可用的本机音色。请安装系统语音，或在设置中明确允许浏览器联网音色。');
      return;
    }
    const u = new this.Utterance(item.text);
    this.utterance = u;
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = this.rate();
    this.state = 'playing';
    this.onchange(this);
    let ended = false;
    u.onend = () => {
      if (token !== this.epoch || ended) return;
      ended = true;
      // A paused utterance can finish in some engines. Resume advances exactly once.
      if (this.state === 'paused') { this.pendingEnd = true; return; }
      this.advance();
    };
    u.onerror = event => {
      if (token !== this.epoch || ended) return;
      this.stop();
      this.onerror(`语音未能继续（${String(event.error || 'unknown')}）。请点击播放重试，或更换音色。`);
    };
    try { this.synth.speak(u); } catch { this.stop(); this.onerror('浏览器拒绝启动语音，请点击播放后重试。'); }
  }
  advance() {
    this.pendingEnd = false;
    if (++this.index < this.queue.length) this.speak();
    else { this.state = 'ended'; this.utterance = null; this.onchange(this); }
  }
  toggle() {
    if (this.state === 'playing') { this.state = 'paused'; this.synth.pause(); }
    else if (this.state === 'paused') {
      this.state = 'playing';
      if (this.pendingEnd) { this.advance(); return; }
      this.synth.resume();
    }
    this.onchange(this);
  }
  seek(index) {
    if (!this.queue.length) return;
    this.pendingEnd = false;
    this.index = Math.max(0, Math.min(this.queue.length - 1, index));
    this.speak();
  }
}
