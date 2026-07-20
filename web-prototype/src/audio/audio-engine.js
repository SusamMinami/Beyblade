import * as Tone from "tone";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.enabled = true;
    this.playerSpin = null;
    this.enemySpin = null;
  }

  async init() {
    if (this.ready) return;
    await Tone.start();
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.master = new Tone.Volume(-5).connect(this.limiter);

    this.uiSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.025 },
      volume: -15,
    }).connect(this.master);
    this.launchBody = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 3.6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
      volume: -7,
    }).connect(this.master);
    this.launchNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.16, sustain: 0 },
      volume: -13,
    }).connect(
      new Tone.Filter({
        frequency: 2600,
        type: "bandpass",
        Q: 1.1,
      }).connect(this.master),
    );
    this.hitMetal = new Tone.MetalSynth({
      frequency: 210,
      envelope: { attack: 0.001, decay: 0.16, release: 0.025 },
      harmonicity: 4.2,
      modulationIndex: 16,
      resonance: 3000,
      octaves: 1.6,
      volume: -10,
    }).connect(this.master);
    this.hitBody = new Tone.MembraneSynth({
      pitchDecay: 0.055,
      octaves: 3.2,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
      volume: -9,
    }).connect(this.master);
    this.warningSynth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 },
      volume: -17,
    }).connect(this.master);
    this.scrapeNoise = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.04 },
      volume: -20,
    }).connect(
      new Tone.Filter({
        frequency: 1450,
        type: "bandpass",
        Q: 2.2,
      }).connect(this.master),
    );
    this.rewardSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.05, release: 0.18 },
      volume: -13,
    }).connect(this.master);
    this.playerSpin = this._createSpinVoice(-23);
    this.enemySpin = this._createSpinVoice(-25);
    this.ready = true;
    this.setEnabled(this.enabled);
  }

  _createSpinVoice(volume) {
    const gain = new Tone.Gain(0).connect(this.master);
    const oscillator = new Tone.FMOscillator({
      frequency: 120,
      type: "sine",
      modulationType: "triangle",
      harmonicity: 2,
      modulationIndex: 1.8,
      volume,
    }).connect(gain);
    oscillator.start();
    return { oscillator, gain };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.mute = !enabled;
  }

  playUi() {
    if (!this.ready || !this.enabled) return;
    this.uiSynth.triggerAttackRelease("E6", 0.055, Tone.now(), 0.38);
  }

  playLaunch(power) {
    if (!this.ready || !this.enabled) return;
    const now = Tone.now();
    this.launchNoise.triggerAttackRelease(0.16, now, 0.5 + power * 0.35);
    this.launchBody.triggerAttackRelease(
      "G1",
      0.28,
      now + 0.055,
      0.55 + power * 0.42,
    );
  }

  playCollision(intensity) {
    if (!this.ready || !this.enabled) return;
    const amount = clamp(intensity, 0.08, 1);
    const now = Tone.now();
    this.hitMetal.frequency.value = 180 + amount * 120;
    this.hitMetal.triggerAttackRelease(0.08 + amount * 0.17, now, amount);
    this.hitBody.triggerAttackRelease(
      amount > 0.55 ? "C1" : "D2",
      0.1 + amount * 0.18,
      now + 0.006,
      amount,
    );
  }

  playRisk(type, state) {
    if (!this.ready || !this.enabled || state === "safe" || state === "stable") {
      return;
    }
    const now = Tone.now();
    if (type === "stability") {
      this.scrapeNoise.triggerAttackRelease(
        state === "critical" ? 0.18 : 0.1,
        now,
        state === "critical" ? 0.62 : 0.35,
      );
      this.warningSynth.triggerAttackRelease(
        state === "critical" ? "D3" : "A3",
        0.08,
        now,
        0.32,
      );
      return;
    }
    const note =
      type === "ring_out_risk"
        ? state === "critical"
          ? "C6"
          : "G5"
        : state === "critical"
          ? "E3"
          : "B3";
    this.warningSynth.triggerAttackRelease(
      note,
      state === "critical" ? 0.12 : 0.07,
      now,
      state === "critical" ? 0.48 : 0.28,
    );
  }

  playResult(won, reason) {
    if (!this.ready || !this.enabled) return;
    const now = Tone.now();
    if (won) {
      [
        ["C5", 0],
        ["E5", 0.11],
        ["G5", 0.22],
        [["C6", "E6"], 0.36],
      ].forEach(([note, offset], index) => {
        this.rewardSynth.triggerAttackRelease(
          note,
          index === 3 ? 0.32 : 0.16,
          now + offset,
          0.48,
        );
      });
      return;
    }
    const note = reason === "break" ? "C2" : "F2";
    this.launchBody.triggerAttackRelease(note, 0.6, now, 0.56);
  }

  update(playerSpin, enemySpin, running) {
    if (!this.ready) return;
    this._updateSpinVoice(this.playerSpin, playerSpin, running, 1);
    this._updateSpinVoice(this.enemySpin, enemySpin, running, 0.92);
  }

  _updateSpinVoice(voice, spin, running, pitchScale) {
    const normalized = clamp(spin / 65, 0, 1);
    const frequency = (62 + spin * 2.25) * pitchScale;
    voice.oscillator.frequency.rampTo(Math.max(frequency, 30), 0.06);
    voice.gain.gain.rampTo(
      running && this.enabled ? normalized * 0.16 : 0,
      0.08,
    );
  }
}
