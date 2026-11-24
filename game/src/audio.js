// Porto Verde sound: everything is synthesised with WebAudio — engine hum,
// two-tone police sirens, gunshots, pickups and three switchable radio stations.
// No audio files, no network. All methods are safe to call before the audio
// context exists (before the player's first key press).

const STATIONS = [
  { name: 'Neon FM', bpm: 112, root: 55, scale: [0, 3, 5, 7, 10], wave: 'sawtooth' },
  { name: 'Sunset Drive', bpm: 92, root: 65.41, scale: [0, 2, 4, 7, 9], wave: 'triangle' },
  { name: 'Static Bloom', bpm: 128, root: 49, scale: [0, 3, 6, 7, 10], wave: 'square' },
];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioTimer = null;
    this.radioStep = 0;
    this.station = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // Called every frame with the player's speed and wanted level.
  update(speed, wanted, station, running) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) {
      const target = running && Math.abs(speed) > 5 ? 0.05 + Math.min(0.09, Math.abs(speed) / 5000) : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) * 0.35, t, 0.1);
    }
    if (this.sirenGain) {
      const target = wanted > 0 ? 0.045 : 0;
      this.sirenGain.gain.setTargetAtTime(target, t, 0.2);
      const f = 660 + 160 * Math.sin(t * 2.4);
      this.sirenOsc.frequency.setTargetAtTime(f, t, 0.05);
    }
    if (station !== this.station || (running && !this.radioTimer)) {
      this.station = station;
      this.startRadio();
    }
    if (!running && this.radioTimer) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }

  startRadio() {
    if (!this.ctx) return;
    if (this.radioTimer) clearInterval(this.radioTimer);
    const station = STATIONS[this.station % STATIONS.length];
    const stepDur = 60 / station.bpm / 2;
    this.radioStep = 0;
    this.radioTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.radioStep++;
      const degree = station.scale[step % station.scale.length];
      const octave = 2 + Math.floor(step / 8) % 2;
      const freq = station.root * Math.pow(2, degree / 12) * octave;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = station.wave;
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + stepDur);
      if (step % 4 === 0) this.thump();
    }, stepDur * 1000);
  }

  thump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  shot(weaponId) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, 2205, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = weaponId === 3 ? 0.35 : 0.2;
    src.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [i, f] of [523.25, 659.25, 783.99].entries()) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.3);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.32);
    }
  }
}
